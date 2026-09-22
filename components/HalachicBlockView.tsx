"use client";

import { useEffect, useState } from "react";
import type { HalachicBlock } from "@/lib/sefaria";
import type { BlockAnalysisRow } from "@/lib/db";
import type { Excerpt } from "@/lib/types";
import { SOURCE_LABELS, getHex } from "@/lib/sourceLabels";
import { toHebrewNumeral } from "@/lib/hebrewNumerals";
import SeifBlockAnalysis from "./SeifBlockAnalysis";

type Props = {
  chelek: string;
  siman: string;
  blocks: HalachicBlock[];
  // Tur/Beit Yosef/manual excerpts the user manually tagged with a se'if
  // (Excerpt.linkedSeif) — there's no reliable automatic mapping for these,
  // unlike the SA-anchored mefarshim already in `blocks`. See ExcerptCard's
  // "→ קשר לסעיף" control.
  linkedExcerpts: Excerpt[];
};

function groupNotesBySource(notes: HalachicBlock["notes"]) {
  const groups: { sourceKey: string; sourceLabel: string; items: HalachicBlock["notes"] }[] = [];
  for (const note of notes) {
    const last = groups[groups.length - 1];
    if (last && last.sourceKey === note.sourceKey) {
      last.items.push(note);
    } else {
      groups.push({ sourceKey: note.sourceKey, sourceLabel: note.sourceLabel, items: [note] });
    }
  }
  return groups;
}

// Not cryptographic — just needs to change deterministically when a block's
// effective content (automatic notes + manually-linked excerpts) changes,
// for the client-side half of the staleness check. The server-computed
// `block.contentHash` already covers the automatic part.
function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

// The "לפי סעיפי שו״ע" study mode — a book-like read-through, one
// HalachicBlock (SA se'if + its mefaresh notes) at a time, in contrast to
// the "כל המקורות" panel mode which stays completely untouched.
export default function HalachicBlockView({ chelek, siman, blocks, linkedExcerpts }: Props) {
  const [storedByIndex, setStoredByIndex] = useState<Record<number, BlockAnalysisRow>>({});
  // SeifBlockAnalysis only reads `initialStored` once, at mount — so we wait
  // for this (fast, local) fetch before mounting it, rather than risk it
  // mounting with `null` and never picking up a stored analysis that
  // arrives a moment later.
  const [analysesLoaded, setAnalysesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAnalysesLoaded(false);
    fetch(`/api/seif-analysis?chelek=${chelek}&siman=${siman}`)
      .then((r) => (r.ok ? r.json() : { analyses: [] }))
      .then((data: { analyses?: BlockAnalysisRow[] }) => {
        if (cancelled) return;
        const map: Record<number, BlockAnalysisRow> = {};
        for (const row of data.analyses ?? []) map[row.seifIndex] = row;
        setStoredByIndex(map);
      })
      .catch(() => {/* silent — analyses are supplementary, not core content */})
      .finally(() => { if (!cancelled) setAnalysesLoaded(true); });
    return () => { cancelled = true; };
  }, [chelek, siman]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6" dir="rtl">
      {blocks.map((block) => {
        const noteGroups = groupNotesBySource(block.notes);
        const linkedForBlock = linkedExcerpts.filter((e) => e.linkedSeif === block.seifIndex);

        const commentariesForAnalysis = [
          ...block.notes.map((n) => ({ heRef: n.sourceLabel, text: n.html })),
          ...linkedForBlock.flatMap((e) => [
            { heRef: e.sourceLabel, text: e.text },
            ...(e.commentaries ?? []).map((c) => ({ heRef: c.heRef, text: c.text })),
          ]),
        ];

        const effectiveHash = linkedForBlock.length === 0
          ? block.contentHash
          : simpleHash(block.contentHash + JSON.stringify(
              linkedForBlock.map((e) => ({ id: e.id, text: e.text, commentaries: e.commentaries }))
            ));

        return (
          <div key={block.seifIndex} className="border-b border-gray-100 pb-6 mb-6 last:border-0 last:mb-0">
            <p className="text-sm font-bold text-gray-400 mb-2">
              סעיף {toHebrewNumeral(block.seifIndex + 1)}
            </p>

            <div className="mb-3">
              <p className="text-xs font-semibold mb-1" style={{ color: getHex("shulchanArukh") }}>
                {SOURCE_LABELS.shulchanArukh}
              </p>
              <div
                className="text-[15px] leading-loose text-gray-800"
                dangerouslySetInnerHTML={{ __html: block.saHtml }}
              />
            </div>

            {noteGroups.map((group) => (
              <div key={group.sourceKey} className="mb-3">
                <p className="text-xs font-semibold mb-1" style={{ color: getHex(group.sourceKey) }}>
                  {SOURCE_LABELS[group.sourceKey] ?? group.sourceLabel}
                </p>
                <div className="space-y-1">
                  {group.items.map((note) => (
                    <div
                      key={`${note.sourceKey}-${note.noteIndex}`}
                      className="text-sm leading-loose text-gray-700"
                      dangerouslySetInnerHTML={{ __html: note.html }}
                    />
                  ))}
                </div>
              </div>
            ))}

            {linkedForBlock.map((e) => (
              <div key={e.id} className="mb-3">
                <p className="text-xs font-semibold mb-1" style={{ color: getHex(e.sourceKey) }}>
                  {SOURCE_LABELS[e.sourceKey] ?? e.sourceLabel}
                </p>
                <div className="text-sm leading-loose text-gray-700" dangerouslySetInnerHTML={{ __html: e.text }} />
                {e.commentaries && e.commentaries.length > 0 && (
                  <div className="mt-1 pr-3 border-r-2 border-amber-200 space-y-1">
                    {e.commentaries.map((c) => (
                      <div key={c.ref}>
                        <p className="text-xs font-semibold text-amber-800">{c.heRef}</p>
                        <p className="text-xs text-gray-600">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {analysesLoaded && (
              <SeifBlockAnalysis
                chelek={chelek}
                siman={siman}
                seifIndex={block.seifIndex}
                sourceLabel={`סעיף ${toHebrewNumeral(block.seifIndex + 1)}`}
                sourceText={block.saHtml}
                commentaries={commentariesForAnalysis}
                contentHash={effectiveHash}
                initialStored={storedByIndex[block.seifIndex] ?? null}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
