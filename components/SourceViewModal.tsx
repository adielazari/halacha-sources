"use client";

import { useEffect } from "react";
import type { CommentaryEntry } from "@/lib/types";

type Props = {
  title: string;
  html: string;
  commentaries?: CommentaryEntry[];
  note?: string;
  onClose: () => void;
  onEdit?: () => void;
};

export default function SourceViewModal({ title, html, commentaries, note, onClose, onEdit }: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-bold text-amber-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          <div
            className="text-base leading-loose text-gray-800"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {note && <p className="text-sm text-gray-500 mt-3 italic">{note}</p>}
          {commentaries && commentaries.length > 0 && (
            <div className="mt-4 pr-3 border-r-2 border-amber-200 space-y-3">
              {commentaries.map((c) => (
                <div key={c.ref}>
                  {!title.includes(c.heRef) && (
                    <p className="text-sm font-semibold text-amber-800 mb-0.5">{c.heRef}</p>
                  )}
                  <div className="text-sm text-gray-600 space-y-0.5">
                    {c.text.split("\n").filter(Boolean).map((line, j) => (
                      <p key={j}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
            >
              ערוך מקור
            </button>
          )}
          <button
            onClick={onClose}
            className={`px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm ${onEdit ? "" : "flex-1"}`}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
