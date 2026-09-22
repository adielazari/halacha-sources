"use client";

import { useState } from "react";
import type { BlockAnalysisRow } from "@/lib/db";

type Props = {
  chelek: string;
  siman: string;
  seifIndex: number;
  sourceLabel: string;
  sourceText: string;
  commentaries: { heRef: string; text: string }[];
  contentHash: string;
  initialStored: BlockAnalysisRow | null;
};

// Small, unobtrusive AI trigger at the bottom of a HalachicBlock — the
// sources are the point, this is a footnote. Persisted (via
// /api/seif-analysis, not the ephemeral /api/block-analysis used on the
// document page) so a version/contentHash can survive across visits and
// flag staleness without ever deleting the previous analysis.
export default function SeifBlockAnalysis({
  chelek, siman, seifIndex, sourceLabel, sourceText, commentaries, contentHash, initialStored,
}: Props) {
  const [stored, setStored] = useState<BlockAnalysisRow | null>(initialStored);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openSummary, setOpenSummary] = useState(false);
  const [openPractical, setOpenPractical] = useState(false);

  const isStale = stored !== null && stored.contentHash !== contentHash;

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/seif-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chelek, siman, seifIndex, contentHash, sourceLabel, sourceText, commentaries }),
      });
      const data = await res.json() as { analysis?: BlockAnalysisRow; error?: string };
      if (!res.ok || !data.analysis) {
        setError(data.error || "הניתוח נכשל");
        return;
      }
      setStored(data.analysis);
    } catch {
      setError("הניתוח נכשל");
    } finally {
      setLoading(false);
    }
  }

  function toggle(section: "summary" | "practical", e: React.MouseEvent) {
    e.stopPropagation();
    const setOpen = section === "summary" ? setOpenSummary : setOpenPractical;
    const isOpen = section === "summary" ? openSummary : openPractical;
    if (!stored && !isOpen) {
      void generate();
    }
    setOpen(!isOpen);
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <button onClick={(e) => toggle("summary", e)} disabled={loading} className="hover:text-purple-600 disabled:opacity-50">
          ✨ סיכום
        </button>
        <button onClick={(e) => toggle("practical", e)} disabled={loading} className="hover:text-purple-600 disabled:opacity-50">
          ✓ למעשה
        </button>
        {loading && <span className="animate-spin inline-block">⏳</span>}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {isStale && (openSummary || openPractical) && (
        <div className="text-xs text-amber-600 flex items-center gap-1.5">
          <span>↻ נוספו מקורות מאז יצירת הסיכום</span>
          <button onClick={(e) => { e.stopPropagation(); void generate(); }} disabled={loading} className="underline hover:text-amber-800 disabled:opacity-50">
            עדכן ניתוח
          </button>
        </div>
      )}

      {stored && openSummary && (
        <p className="text-sm leading-loose text-gray-700">{stored.summary}</p>
      )}

      {stored && openPractical && stored.practicalPoints.length > 0 && (
        <ul className="space-y-1.5">
          {stored.practicalPoints.map((p, i) => (
            <li key={i} className="text-sm text-gray-700 leading-loose">
              <span className="font-medium">{p.what}</span>
              {p.when && <span className="text-gray-500"> — {p.when}</span>}
              {p.how && <span className="text-gray-500"> ({p.how})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
