"use client";

import { useState } from "react";
import type { CommentaryEntry } from "@/app/siman/[chelek]/[number]/store";

type Props = {
  rawText: string;  // text selected from mefaresh
  mefareshLabel: string;
  onApprove: (ref: string, selectedText: string, commentaries: CommentaryEntry[]) => void;
  onClose: () => void;
};

export default function AddMissedSourcePanel({ rawText, mefareshLabel, onApprove, onClose }: Props) {
  const [inputRef, setInputRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchedText, setFetchedText] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [manualText, setManualText] = useState(rawText);

  async function tryFetch() {
    const ref = inputRef.trim();
    if (!ref) return;
    setLoading(true);
    setFetchError(false);
    setFetchedText(null);
    try {
      const res = await fetch(`/api/source?ref=${encodeURIComponent(ref)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.text) throw new Error();
      setFetchedText(data.text);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleApprove() {
    const ref = inputRef.trim() || rawText;
    const text = fetchedText ?? manualText;
    if (!text.trim()) return;
    onApprove(ref, text, []);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-900">מקור שפוספס</h2>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {mefareshLabel}
          </span>
        </div>

        {/* Raw selection */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">טקסט שנבחר:</p>
          <p className="text-sm text-amber-900 leading-relaxed line-clamp-4">{rawText}</p>
        </div>

        {/* Ref input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            ref בספריא (אופציונלי):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputRef}
              onChange={(e) => setInputRef(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryFetch()}
              placeholder="Kiddushin.56b  /  Mishnah_Orlah.1"
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
            <p className="text-xs text-red-500">לא נמצא בספריא — עדכן את הטקסט ידנית למטה.</p>
          )}
        </div>

        {/* Fetched text preview */}
        {fetchedText && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-700 font-medium mb-1">טקסט שנמשך מספריא:</p>
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">{fetchedText}</p>
          </div>
        )}

        {/* Manual text (shown when no fetch, or fetch failed) */}
        {!fetchedText && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              טקסט המקור:
            </label>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={4}
              dir="rtl"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleApprove}
            disabled={!fetchedText && !manualText.trim()}
            className="flex-1 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
          >
            הוסף מקור
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
