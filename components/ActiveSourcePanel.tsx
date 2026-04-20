"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toHebrewNumeral } from "@/lib/hebrewNumerals";
import type { ParsedSource } from "@/lib/parser";
import type { CommentaryEntry } from "@/app/siman/[chelek]/[number]/store";
import CommentatorSuggestions from "./CommentatorSuggestions";
import RedefineSourcePanel from "./RedefineSourcePanel";

type Props = {
  source: ParsedSource;
  sourceText: string;
  segments: Array<{ ref: string; text: string }>;
  onApprove: (selectedText: string, commentaries: CommentaryEntry[]) => void;
  onSkip: () => void;
  onNotASource: () => void;
  onRedefine?: (newRef: string, newText: string, newSegments: Array<{ ref: string; text: string }>) => void;
  isLoading: boolean;
};

type Segment = { ref: string; text: string };
type Phase = "selecting" | "confirming" | "commenting";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function normalizeText(t: string): string {
  return t
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u05B0-\u05C7\u05F3\u05F4]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findSegmentRefs(
  chunks: string[],
  segs: Array<{ ref: string; text: string }>
): string[] {
  if (segs.length === 0) return [];

  const normalSegs = segs.map((s) => normalizeText(s.text));
  const matchedIndices = new Set<number>();

  for (const chunk of chunks) {
    const normalChunk = normalizeText(chunk);
    // Try matching every 30-char window of the chunk against each segment
    // This catches segments that are covered by the middle/end of a long chunk
    const windowSize = 30;
    const windows: string[] = [];
    for (let i = 0; i < normalChunk.length - windowSize + 1; i += windowSize) {
      windows.push(normalChunk.slice(i, i + windowSize));
    }
    if (windows.length === 0 && normalChunk.length > 0) {
      windows.push(normalChunk.slice(0, 30));
    }

    for (let si = 0; si < normalSegs.length; si++) {
      for (const w of windows) {
        if (normalSegs[si].includes(w)) {
          matchedIndices.add(si);
          break;
        }
      }
    }
  }

  if (matchedIndices.size === 0) return [];

  // Include all segments between first and last match (they're contiguous in the daf)
  const sorted = Array.from(matchedIndices).sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const expanded: string[] = [];
  for (let i = first; i <= last; i++) {
    expanded.push(segs[i].ref);
  }
  return expanded;
}

function parseTalmudRef(ref: string) {
  const m = ref.match(/^(.+)\.(\d+)(a|b)$/);
  if (!m) return null;
  return { tractate: m[1], daf: parseInt(m[2]), amud: m[3] as "a" | "b" };
}

function adjacentRef(ref: string, dir: "next" | "prev"): string | null {
  const p = parseTalmudRef(ref);
  if (!p) return null;
  if (dir === "next") {
    return p.amud === "a" ? `${p.tractate}.${p.daf}b` : `${p.tractate}.${p.daf + 1}a`;
  } else {
    if (p.amud === "b") return `${p.tractate}.${p.daf}a`;
    if (p.daf <= 2) return null;
    return `${p.tractate}.${p.daf - 1}b`;
  }
}

const TRACTATE_HE: Record<string, string> = {
  Kiddushin: "קידושין", Shabbat: "שבת", Berakhot: "ברכות",
  Pesachim: "פסחים", Yevamot: "יבמות", Ketubot: "כתובות",
  Bava_Kamma: "בבא קמא", Bava_Metzia: "בבא מציעא", Bava_Batra: "בבא בתרא",
  Sanhedrin: "סנהדרין", Gittin: "גיטין", Sotah: "סוטה",
  Chullin: "חולין", Niddah: "נידה", Avodah_Zarah: "עבודה זרה",
  Nedarim: "נדרים", Nazir: "נזיר", Makkot: "מכות", Shevuot: "שבועות",
  Rosh_Hashanah: "ראש השנה", Yoma: "יומא", Sukkah: "סוכה",
  Taanit: "תענית", Megillah: "מגילה", Moed_Katan: "מועד קטן",
};

function refLabel(ref: string): string {
  const p = parseTalmudRef(ref);
  if (!p) return ref;
  const name = TRACTATE_HE[p.tractate] ?? p.tractate;
  // Strip geresh — daf numbers don't need it
  const dafHe = toHebrewNumeral(p.daf).replace(/[׳״]/g, "");
  const amud = p.amud === "b" ? ":" : ".";
  return `${name} דף ${dafHe}${amud}`;
}

export default function ActiveSourcePanel({
  source,
  sourceText,
  segments: propSegments,
  onApprove,
  onSkip,
  onNotASource,
  onRedefine,
  isLoading,
}: Props) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loadingDir, setLoadingDir] = useState<"next" | "prev" | null>(null);
  const [pendingSelection, setPendingSelection] = useState<string>("");
  const [chunks, setChunks] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("selecting");
  const [confirmedSegmentRefs, setConfirmedSegmentRefs] = useState<string[]>([]);
  const [editingRef, setEditingRef] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [commentaries, setCommentaries] = useState<CommentaryEntry[]>([]);
  // Holds text fetched via the redefine flow (overrides sourceText prop)
  const [redefinedText, setRedefinedText] = useState<string | null>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const needsRedefine =
    !redefinedText && (source.unresolved || (source.author && !source.sefariaRef));

  // Reset when source changes
  useEffect(() => {
    setRedefinedText(null);
    if (source.sefariaRef && sourceText) {
      setSegments([{ ref: source.sefariaRef, text: sourceText }]);
    } else {
      setSegments([]);
    }
    setChunks([]);
    setPendingSelection("");
    setPhase("selecting");
    setCommentaries([]);
  }, [source.sefariaRef, sourceText]);

  // Track text selection in real-time
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const text = sel.toString().trim();
      if (text && textRef.current?.contains(sel.anchorNode)) {
        setPendingSelection(text);
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  async function loadAdjacent(dir: "next" | "prev") {
    const edgeRef = dir === "next" ? segments[segments.length - 1]?.ref : segments[0]?.ref;
    const nextRef = edgeRef ? adjacentRef(edgeRef, dir) : null;
    if (!nextRef) return;
    setLoadingDir(dir);
    try {
      const res = await fetch(`/api/source?ref=${encodeURIComponent(nextRef)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSegments((prev) =>
        dir === "next"
          ? [...prev, { ref: nextRef, text: data.text ?? "" }]
          : [{ ref: nextRef, text: data.text ?? "" }, ...prev]
      );
    } catch {/* silent */}
    finally { setLoadingDir(null); }
  }

  function addChunk() {
    if (!pendingSelection) return;
    setChunks((prev) => [...prev, pendingSelection]);
    setPendingSelection("");
    window.getSelection()?.removeAllRanges();
  }

  function removeChunk(i: number) {
    setChunks((prev) => prev.filter((_, idx) => idx !== i));
  }

  const effectiveText = redefinedText ?? sourceText;
  const displayText = segments.length > 0
    ? segments.map((s) => stripHtml(s.text)).join(" ")
    : stripHtml(effectiveText);

  const confirmedText = chunks.length > 0 ? chunks.join(" ... ") : displayText;

  const firstRef = segments[0]?.ref ?? source.sefariaRef ?? "";
  const lastRef = segments[segments.length - 1]?.ref ?? source.sefariaRef ?? "";
  const isTalmud = !!parseTalmudRef(source.sefariaRef ?? "");

  function addCommentary(entry: CommentaryEntry) {
    setCommentaries((prev) => [...prev, entry]);
  }
  function removeCommentary(ref: string) {
    setCommentaries((prev) => prev.filter((c) => c.ref !== ref));
    if (editingRef === ref) setEditingRef(null);
  }
  function saveCommentaryEdit(ref: string) {
    setCommentaries((prev) =>
      prev.map((c) => c.ref === ref ? { ...c, text: editingText } : c)
    );
    setEditingRef(null);
  }

  function handleFinalApprove() {
    onApprove(confirmedText, commentaries);
    setChunks([]);
    setPendingSelection("");
    setPhase("selecting");
    setCommentaries([]);
  }

  const sourceTitle = source.sefariaRef
    ? refLabel(source.sefariaRef)
    : source.book ?? source.raw;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <span className="animate-pulse">טוען מקור...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Source header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-amber-900">{sourceTitle}</h2>
          {source.section && <p className="text-sm text-gray-500">{source.section}</p>}
        </div>
        {source.author && (
          <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-1">{source.author}</span>
        )}
      </div>

      {/* ── Redefine flow: shown for unresolved / author-only sources ── */}
      {needsRedefine && (
        <RedefineSourcePanel
          source={source}
          onResolved={(ref, text, segs) => {
            setRedefinedText(text);
            setSegments(segs.length > 0 ? segs : [{ ref, text }]);
            onRedefine?.(ref, text, segs);
          }}
          onSkip={onSkip}
          onNotASource={onNotASource}
        />
      )}

      {/* ── PHASE: selecting ── */}
      {!needsRedefine && phase === "selecting" && (
        <>
          {/* Daf navigation */}
          {isTalmud && (
            <div className="flex gap-2 items-center">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => loadAdjacent("prev")}
                disabled={!adjacentRef(firstRef, "prev") || loadingDir === "prev"}
                className="text-xs px-3 py-1 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full disabled:opacity-40 transition"
              >
                {loadingDir === "prev" ? "..." : `← ${adjacentRef(firstRef, "prev") ? refLabel(adjacentRef(firstRef, "prev")!) : ""}`}
              </button>
              <div className="flex-1 text-center text-xs text-gray-400">
                {segments.map((s) => refLabel(s.ref)).join(" | ")}
              </div>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => loadAdjacent("next")}
                disabled={!adjacentRef(lastRef, "next") || loadingDir === "next"}
                className="text-xs px-3 py-1 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full disabled:opacity-40 transition"
              >
                {loadingDir === "next" ? "..." : `${adjacentRef(lastRef, "next") ? refLabel(adjacentRef(lastRef, "next")!) : ""} →`}
              </button>
            </div>
          )}

          {/* Selectable text */}
          <div
            ref={textRef}
            className="bg-white rounded-lg border border-gray-200 p-4 text-sm leading-loose cursor-text select-text min-h-[100px] max-h-[400px] overflow-y-auto"
            dir="rtl"
          >
            {segments.length > 0 ? (
              segments.map((seg, i) => (
                <span key={seg.ref}>
                  {i > 0 && (
                    <span className="block text-center text-xs text-gray-300 my-2 select-none">
                      ─── {refLabel(seg.ref)} ───
                    </span>
                  )}
                  {stripHtml(seg.text)}
                </span>
              ))
            ) : displayText ? (
              displayText
            ) : (
              <span className="text-gray-400">לא נמצא טקסט עבור מקור זה</span>
            )}
          </div>

          {/* Pending selection toast */}
          {pendingSelection && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
              <p className="flex-1 text-gray-700 leading-snug">
                <span className="font-medium text-yellow-800">נבחר: </span>
                {pendingSelection.slice(0, 120)}{pendingSelection.length > 120 ? "…" : ""}
              </p>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={addChunk}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1 rounded-full transition"
              >
                + הוסף לבחירה
              </button>
            </div>
          )}

          {/* Confirm selection button */}
          {chunks.length > 0 && (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-amber-700">{chunks.length} קטעים נבחרו</span>
              <button
                onClick={() => { setChunks([]); setPendingSelection(""); }}
                className="text-xs text-gray-400 hover:text-red-500 underline"
              >
                נקה
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setPhase("confirming")}
                className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
              >
                אשר נוסח ←
              </button>
            </div>
          )}
        </>
      )}

      {/* ── PHASE: confirming ── */}
      {!needsRedefine && phase === "confirming" && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">האם לאשר את הנוסח הבא?</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm leading-loose" dir="rtl">
            {confirmedText}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase("selecting")}
              className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm"
            >
              חזור לעריכה
            </button>
            <button
              onClick={() => {
                const matched = findSegmentRefs(chunks, propSegments.length > 0 ? propSegments : segments);
                setConfirmedSegmentRefs(
                  matched.length > 0
                    ? matched
                    : (propSegments.length > 0 ? propSegments : segments).map((s) => s.ref)
                );
                setPhase("commenting");
              }}
              className="flex-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              כן, אשר ←
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: commenting ── */}
      {!needsRedefine && phase === "commenting" && (
        <div className="space-y-4">
          {/* Confirmed text (read-only) */}
          <div className="bg-amber-50 border-r-4 border-amber-400 rounded-lg p-4 text-sm leading-loose" dir="rtl">
            {confirmedText}
          </div>

          {/* Commentaries */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">מפרשים</h3>
            <CommentatorSuggestions
              segmentRefs={confirmedSegmentRefs}
              added={commentaries}
              onAdd={addCommentary}
              onRemove={removeCommentary}
            />
          </div>

          {commentaries.length > 0 && (
            <div className="space-y-3 pr-4 border-r-2 border-amber-300">
              {commentaries.map((c) => (
                <div key={c.ref}>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-amber-800 text-sm flex-1">{c.heRef}</h4>
                    {editingRef !== c.ref && (
                      <button
                        onClick={() => { setEditingRef(c.ref); setEditingText(c.text); }}
                        className="text-xs text-gray-400 hover:text-amber-700 underline"
                      >
                        ערוך
                      </button>
                    )}
                    <button
                      onClick={() => removeCommentary(c.ref)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>

                  {editingRef === c.ref ? (
                    <div className="space-y-1">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full text-xs text-gray-700 border border-amber-300 rounded p-2 leading-relaxed resize-y min-h-[80px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                        dir="rtl"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveCommentaryEdit(c.ref)}
                          className="text-xs bg-amber-700 text-white px-3 py-1 rounded hover:bg-amber-800 transition"
                        >
                          שמור
                        </button>
                        <button
                          onClick={() => setEditingRef(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600 space-y-1">
                      {c.text.split("\n").filter(Boolean).map((line, j) => (
                        <p key={j}>{line}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setPhase("selecting")}
              className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm"
            >
              חזור לעריכה
            </button>
            <button
              onClick={handleFinalApprove}
              className="flex-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              אשר ועבור למקור הבא ←
            </button>
          </div>
        </div>
      )}

      {/* Bottom action row — always visible */}
      {!needsRedefine && phase === "selecting" && chunks.length === 0 && (
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => onApprove(displayText, [])}
            className="flex-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            אשר ועבור למקור הבא ←
          </button>
          <button onClick={onSkip} className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm">
            דלג
          </button>
          <button onClick={onNotASource} className="px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition text-sm">
            לא מקור ✕
          </button>
        </div>
      )}

      {!needsRedefine && phase === "selecting" && chunks.length > 0 && (
        <div className="flex gap-3">
          <button onClick={onSkip} className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm">
            דלג
          </button>
          <button onClick={onNotASource} className="px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition text-sm">
            לא מקור ✕
          </button>
        </div>
      )}
    </div>
  );
}
