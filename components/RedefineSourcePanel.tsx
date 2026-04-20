"use client";

import { useState } from "react";
import type { ParsedSource } from "@/lib/parser";

type Segment = { ref: string; text: string };

type Props = {
  source: ParsedSource;
  onResolved: (ref: string, text: string, segments: Segment[]) => void;
  onSkip: () => void;
  onNotASource: () => void;
};

export default function RedefineSourcePanel({ source, onResolved, onSkip, onNotASource }: Props) {
  const [inputRef, setInputRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");

  async function tryFetch() {
    const ref = inputRef.trim();
    if (!ref) return;
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/source?ref=${encodeURIComponent(ref)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.text) throw new Error();
      onResolved(ref, data.text, data.segments ?? []);
    } catch {
      setFetchError(true);
      setShowManual(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Identified source */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <p className="text-xs text-gray-500 mb-1">מקור שזוהה בטקסט:</p>
        <p className="font-semibold text-amber-900 text-sm">{source.raw}</p>
        {source.author && (
          <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-0.5 mt-1 inline-block">
            {source.author}
          </span>
        )}
      </div>

      {/* Ref input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          הגדר ref לספריא:
        </label>
        {source.unresolvedHint && (
          <p className="text-xs text-gray-400">{source.unresolvedHint}</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputRef}
            onChange={(e) => setInputRef(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryFetch()}
            placeholder="Rosh_on_Orlah.1  /  Mishnah_Orlah.1"
            dir="ltr"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={tryFetch}
            disabled={!inputRef.trim() || loading}
            className="shrink-0 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
          >
            {loading ? "..." : "משוך"}
          </button>
        </div>
        {fetchError && (
          <p className="text-xs text-red-500">לא נמצא בספריא — ניתן להדביק טקסט ידנית למטה.</p>
        )}
      </div>

      {/* Manual text fallback */}
      {showManual && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            הדבק טקסט ידנית:
          </label>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            rows={5}
            dir="rtl"
            placeholder="הדבק כאן את טקסט המקור..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
          <button
            onClick={() => onResolved(inputRef.trim() || source.raw, manualText, [])}
            disabled={!manualText.trim()}
            className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold text-sm py-2 rounded-lg transition"
          >
            המשך עם טקסט זה ←
          </button>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm"
        >
          דלג
        </button>
        <button
          onClick={onNotASource}
          className="px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition text-sm"
        >
          לא מקור ✕
        </button>
      </div>
    </div>
  );
}
