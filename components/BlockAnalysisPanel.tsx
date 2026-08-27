"use client";

import { useState } from "react";
import type { BlockAnalysisResult, CommentaryEntry } from "@/lib/types";

type Props = {
  sourceLabel: string;
  sourceText: string;
  commentaries?: CommentaryEntry[];
};

export default function BlockAnalysisPanel({ sourceLabel, sourceText, commentaries }: Props) {
  const [analysis, setAnalysis] = useState<BlockAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/block-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLabel,
          sourceText,
          commentaries: (commentaries ?? []).map((c) => ({ heRef: c.heRef, text: c.text })),
        }),
      });
      const data = await res.json() as BlockAnalysisResult & { error?: string };
      if (!res.ok) {
        setError(data.error || "הניתוח נכשל");
        return;
      }
      setAnalysis(data);
      setOpen(true);
    } catch {
      setError("הניתוח נכשל");
    } finally {
      setLoading(false);
    }
  }

  function handleButtonClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (analysis) {
      setOpen((v) => !v);
    } else {
      void runAnalysis();
    }
  }

  function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    void runAnalysis();
  }

  return (
    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleButtonClick}
        disabled={loading}
        className="text-xs px-2 py-1 border border-purple-300 text-purple-700 rounded hover:bg-purple-50 disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-flex items-center gap-1">
            <span className="animate-spin inline-block">⏳</span> מנתח...
          </span>
        ) : analysis ? (
          open ? "הסתר ניתוח" : "הצג ניתוח"
        ) : (
          "🔍 ניתוח AI"
        )}
      </button>

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {analysis && open && (
        <div className="mt-2 border border-purple-200 bg-purple-50/50 rounded-lg p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-purple-800">סיכום קצר</p>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="text-xs text-purple-600 hover:underline disabled:opacity-50 shrink-0"
            >
              רענן
            </button>
          </div>
          <p className="text-sm leading-loose text-gray-800">{analysis.summary}</p>

          {analysis.practical_points.length > 0 && (
            <div>
              <p className="text-xs font-bold text-purple-800 mb-1">הלכה למעשה</p>
              <ul className="space-y-2">
                {analysis.practical_points.map((p, i) => (
                  <li key={i} className="text-sm text-gray-800 leading-loose">
                    <span className="font-semibold">{p.what}</span>
                    {p.when && <span className="text-gray-600"> — {p.when}</span>}
                    {p.how && <span className="text-gray-600"> ({p.how})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
