"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "./store";
import type { CommentaryEntry, Annotation } from "@/lib/types";
import TextPanel from "@/components/TextPanel";
import SelectionPopover from "@/components/SelectionPopover";
import SourceDocSidebar from "@/components/SourceDocSidebar";
import SourcePullView from "@/components/SourcePullView";
import { buildSourceLabel, buildSectionNumber, getHex } from "@/lib/sourceLabels";
// buildSourceLabel is used by SelectionPopover via handleDefineSource's sectionLabel
import { toHebrewNumeral } from "@/lib/hebrewNumerals";
import { getSimanTopic } from "@/lib/simanTopics";
import { HeadingToolbar } from "@/components/HeadingToolbar";
import type { HeadingAlign } from "@/components/HeadingToolbar";
import { useUser } from "@/lib/userContext";

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim: "אורח חיים",
  YorehDeah: "יורה דעה",
  EvenHaEzer: "אבן העזר",
  ChoshenMishpat: "חושן משפט",
};

const SOURCE_ORDER = [
  { key: "shulchanArukh", title: "שולחן ערוך" },
  { key: "tur",           title: "טור" },
  { key: "beitYosef",     title: "בית יוסף" },
  { key: "taz",           title: 'ט"ז' },
  { key: "shakh",         title: 'ש"ך' },
  { key: "pitcheiTeshuva",title: "פתחי תשובה" },
] as const;

type TextsData = {
  tur: { ref: string; text: string } | null;
  beitYosef: { ref: string; text: string[] } | null;
  shulchanArukh: { ref: string; text: string[] } | null;
  taz: { ref: string; text: string[] } | null;
  shakh: { ref: string; text: string[] } | null;
  pitcheiTeshuva: { ref: string; text: string[] } | null;
};

export type SourcePullContext = {
  text: string;          // the selected commentator text snippet
  sourceKey: string;     // which commentator panel it came from
  sectionIndex?: number;
  sectionHtml?: string;  // full section HTML for the collapsible reference view
  sectionLabel?: string; // label of that section e.g. "ב"י ס"ק ג׳"
  annotation?: Annotation;
};

/** Small inline dialog for adding a heading from a clickable label */
type HeadingDialogState = {
  text: string;
  align: HeadingAlign;
  level: 1 | 2 | 3;
} | null;

function buildSections(
  _sourceKey: string,
  texts: string[]
): { index: number; label: string; html: string }[] {
  return texts.map((html, i) => ({
    index: i,
    label: buildSectionNumber(i),
    html,
  }));
}


export default function SimanPage() {
  const params = useParams();
  const router = useRouter();
  const chelek = params.chelek as string;
  const number = params.number as string;

  const {
    excerpts,
    expandedPanels,
    addExcerpt,
    removeExcerpt,
    reorderExcerpts,
    addAnnotation,
    addHeading,
    updateHeading,
    togglePanel,
    setSession,
    reset,
  } = useStore();
  const { currentUser } = useUser();

  const [texts, setTexts] = useState<TextsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourcePullContext, setSourcePullContext] = useState<SourcePullContext | null>(null);
  const [headingDialog, setHeadingDialog] = useState<HeadingDialogState>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    setSession(chelek, number);
  }, [chelek, number, setSession]);

  useEffect(() => {
    fetch(`/api/annotations?chelek=${chelek}&siman=${number}&status=all`)
      .then((r) => { if (!r.ok) return { annotations: [] }; return r.json(); })
      .then((data: { annotations: Annotation[] }) => setAnnotations(data.annotations ?? []))
      .catch(() => {/* silent */});
  }, [chelek, number]);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/siman-texts?chelek=${chelek}&siman=${number}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TextsData>;
      })
      .then((data) => {
        setTexts(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [chelek, number]);

  const handleAdd = useCallback(
    (params: {
      sourceKey: string;
      sectionIndex?: number;
      text: string;
      sourceLabel: string;
    }) => {
      addExcerpt({
        sourceKey: params.sourceKey,
        sourceLabel: params.sourceLabel,
        text: params.text,
        sectionIndex: params.sectionIndex,
      });
      fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chelek,
          siman: number,
          sourceKey: params.sourceKey,
          sourceLabel: params.sourceLabel,
          text: params.text,
          highlightText: params.text.replace(/<[^>]+>/g, ""),
          sectionIndex: params.sectionIndex ?? null,
          userName: currentUser,
        }),
      })
        .then((r) => r.json())
        .then((data: { annotation?: Annotation }) => {
          if (data.annotation) setAnnotations((prev) => [...prev, data.annotation!]);
        })
        .catch(() => {});
    },
    [addExcerpt, chelek, number, currentUser]
  );

  const handleDefineSource = useCallback(
    (selectedText: string, sourceKey: string, sectionIndex?: number, sectionHtml?: string) => {
      const sectionLabel = sectionIndex !== undefined
        ? buildSourceLabel(sourceKey, sectionIndex)
        : undefined;
      setSourcePullContext({ text: selectedText, sourceKey, sectionIndex, sectionHtml, sectionLabel });
    },
    []
  );

  const handleAddPulledSource = useCallback(
    (params: {
      sourceKey: string;
      sourceLabel: string;
      text: string;
      sourceRef?: string;
      commentaries?: CommentaryEntry[];
    }) => {
      addExcerpt({
        sourceKey: params.sourceKey,
        sourceLabel: params.sourceLabel,
        text: params.text,
        sourceRef: params.sourceRef,
        commentaries: params.commentaries,
      });
      fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chelek,
          siman: number,
          sourceKey: params.sourceKey,
          sourceLabel: params.sourceLabel,
          text: params.text,
          highlightText: params.text.replace(/<[^>]+>/g, ""),
          sourceRef: params.sourceRef ?? null,
          commentaries: params.commentaries ?? [],
          userName: currentUser,
        }),
      })
        .then((r) => r.json())
        .then((data: { annotation?: Annotation }) => {
          if (data.annotation) setAnnotations((prev) => [...prev, data.annotation!]);
        })
        .catch(() => {});
      setSourcePullContext(null);
    },
    [addExcerpt, chelek, number, currentUser]
  );

  // Section label clicked in SA panel → open heading dialog
  const handleSectionClick = useCallback(
    (_sourceKey: string, sectionIndex: number, _label: string) => {
      const seifLabel = `סעיף ${toHebrewNumeral(sectionIndex + 1)}`;
      setHeadingDialog({ text: seifLabel, align: "right", level: 2 });
    },
    []
  );

  function submitHeadingDialog() {
    if (!headingDialog?.text.trim()) return;
    addHeading(null, headingDialog.text.trim(), headingDialog.align, headingDialog.level);
    setHeadingDialog(null);
  }

  const simanLabel = toHebrewNumeral(parseInt(number));
  const chelekLabel = CHELEK_LABELS[chelek] ?? chelek;
  const topic = getSimanTopic(chelek, parseInt(number));

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" dir="rtl">
      {/* Sidebar — appears on RIGHT in RTL */}
      <SourceDocSidebar
        excerpts={excerpts}
        chelek={chelek}
        siman={number}
        onRemove={removeExcerpt}
        onReorder={reorderExcerpts}
        onAddAnnotation={addAnnotation}
        onAddHeading={addHeading}
        onUpdateHeading={updateHeading}
        onReset={reset}
      />

      {/* Main content — appears to the left of the sidebar in RTL */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => router.push("/")}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← בחר סימן
          </button>
          <div className="flex-1 text-center flex items-center justify-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800">{chelekLabel}</span>
            <span className="text-gray-300">·</span>
            {topic && (
              <>
                <button
                  onClick={() => setHeadingDialog({ text: topic, align: "center", level: 1 })}
                  className="text-gray-600 hover:text-purple-700 hover:underline transition text-sm"
                  title="הוסף ככותרת"
                >
                  {topic}
                </button>
                <span className="text-gray-300">·</span>
              </>
            )}
            <button
              onClick={() => setHeadingDialog({ text: `סימן ${simanLabel}`, align: "center", level: 2 })}
              className="text-gray-600 hover:text-purple-700 hover:underline transition text-sm"
              title="הוסף ככותרת"
            >
              סימן {simanLabel}
            </button>
          </div>
          <div className="w-20" />
        </div>

        {/* Heading dialog — inline panel below header */}
        {headingDialog && (
          <div className="bg-purple-50 border-b border-purple-200 px-6 py-2 flex items-center gap-3 flex-shrink-0" dir="rtl">
            <span className="text-xs text-purple-700 font-semibold flex-shrink-0">הוסף ככותרת:</span>
            <input
              autoFocus
              type="text"
              value={headingDialog.text}
              onChange={(e) => setHeadingDialog({ ...headingDialog, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); submitHeadingDialog(); }
                if (e.key === "Escape") setHeadingDialog(null);
              }}
              className="border border-purple-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 w-44"
            />
            <HeadingToolbar
              align={headingDialog.align}
              level={headingDialog.level}
              onAlignChange={(a) => setHeadingDialog({ ...headingDialog, align: a })}
              onLevelChange={(l) => setHeadingDialog({ ...headingDialog, level: l })}
            />
            <button onClick={submitHeadingDialog} className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">הוסף</button>
            <button onClick={() => setHeadingDialog(null)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100">ביטול</button>
          </div>
        )}

        {/* Source pull view — replaces panels */}
        {sourcePullContext && (
          <SourcePullView
            context={sourcePullContext}
            onBack={() => setSourcePullContext(null)}
            onAddToDoc={handleAddPulledSource}
          />
        )}

        {/* Panels area — hidden while source pull is active */}
        {!sourcePullContext && (
          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="text-center py-16 space-y-3">
                <div className="text-3xl animate-spin inline-block">⏳</div>
                <p className="text-gray-500 text-sm">טוען טקסטים מספריה...</p>
                <p className="text-gray-400 text-xs">הטעינה הראשונה עשויה לקחת כמה שניות</p>
              </div>
            )}
            {error && (
              <div className="mx-4 mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                <p className="font-bold mb-1">שגיאה בטעינה</p>
                <p>{error}</p>
                <button
                  onClick={() => {
                    setLoading(true);
                    setError("");
                    fetch(`/api/siman-texts?chelek=${chelek}&siman=${number}`)
                      .then((r) => r.json())
                      .then((data) => { setTexts(data); setLoading(false); })
                      .catch((e: Error) => { setError(e.message); setLoading(false); });
                  }}
                  className="mt-3 text-xs underline"
                >
                  נסה שוב
                </button>
              </div>
            )}
            {texts && !loading && (
              <div>
                {SOURCE_ORDER.map(({ key, title }) => {
                  const hex = getHex(key);
                  const expanded = expandedPanels[key] === true;

                  if (key === "tur") {
                    return (
                      <TextPanel
                        key={key}
                        title={title}
                        hexColor={hex}
                        sourceKey={key}
                        expanded={expanded}
                        onToggle={() => togglePanel(key)}
                        html={texts.tur?.text ?? ""}
                        annotations={annotations.filter((a) => a.sourceKey === key)}
                        currentUser={currentUser}
                      />
                    );
                  }

                  const data = (texts as Record<string, { ref: string; text: string[] } | null>)[key];
                  const sections = data ? buildSections(key, data.text) : undefined;

                  return (
                    <TextPanel
                      key={key}
                      title={title}
                      hexColor={hex}
                      sourceKey={key}
                      expanded={expanded}
                      onToggle={() => togglePanel(key)}
                      sections={sections}
                      annotations={annotations.filter((a) => a.sourceKey === key)}
                      currentUser={currentUser}
                      onSectionClick={key === "shulchanArukh" ? handleSectionClick : undefined}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global floating add button — hidden while source pull is active */}
      {!sourcePullContext && (
        <SelectionPopover
          onAdd={handleAdd}
          onDefineSource={handleDefineSource}
          texts={texts}
        />
      )}
    </div>
  );
}
