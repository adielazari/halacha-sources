"use client";

import { useState, useRef, useCallback } from "react";
import type { ParsedSource } from "@/lib/parser";
import type { Link } from "@/lib/sefaria";
import type { CommentaryEntry } from "@/app/siman/[chelek]/[number]/store";
import CommentatorSuggestions from "./CommentatorSuggestions";

type Props = {
  source: ParsedSource;
  sourceText: string;
  links: Link[];
  onApprove: (selectedText: string, commentaries: CommentaryEntry[]) => void;
  onSkip: () => void;
  isLoading: boolean;
};

export default function ActiveSourcePanel({
  source,
  sourceText,
  links,
  onApprove,
  onSkip,
  isLoading,
}: Props) {
  const [selection, setSelection] = useState<string>("");
  const [commentaries, setCommentaries] = useState<CommentaryEntry[]>([]);
  const textRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      setSelection(sel.toString().trim());
    }
  }, []);

  const displayText = selection || sourceText;

  function addCommentary(entry: CommentaryEntry) {
    setCommentaries((prev) => [...prev, entry]);
  }

  function removeCommentary(ref: string) {
    setCommentaries((prev) => prev.filter((c) => c.ref !== ref));
  }

  function handleApprove() {
    onApprove(displayText, commentaries);
    setSelection("");
    setCommentaries([]);
  }

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
          <h2 className="text-lg font-bold text-amber-900">
            {source.sefariaRef || source.book || source.raw}
          </h2>
          {source.section && (
            <p className="text-sm text-gray-500">{source.section}</p>
          )}
        </div>
        {source.author && (
          <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-1">
            {source.author}
          </span>
        )}
      </div>

      {/* Selectable text */}
      <div
        ref={textRef}
        onMouseUp={handleMouseUp}
        className="bg-white rounded-lg border border-gray-200 p-4 text-sm leading-loose cursor-text select-text min-h-[100px]"
        dir="rtl"
      >
        {sourceText ? (
          <span dangerouslySetInnerHTML={{ __html: sourceText }} />
        ) : (
          <span className="text-gray-400">לא נמצא טקסט עבור מקור זה</span>
        )}
      </div>

      {selection && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
          <span className="font-medium text-yellow-800">נבחר: </span>
          <span className="text-gray-700">{selection.slice(0, 150)}{selection.length > 150 ? "…" : ""}</span>
          <button
            onClick={() => setSelection("")}
            className="mr-2 text-xs text-yellow-600 underline"
          >
            בטל בחירה
          </button>
        </div>
      )}

      {/* Commentator chips */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">מפרשים</h3>
        <CommentatorSuggestions
          sourceRef={source.sefariaRef ?? ""}
          links={links}
          added={commentaries}
          onAdd={addCommentary}
          onRemove={removeCommentary}
        />
      </div>

      {/* Added commentaries preview */}
      {commentaries.length > 0 && (
        <div className="space-y-2 pr-4 border-r-2 border-amber-300">
          {commentaries.map((c, i) => (
            <div key={i} className="text-xs text-gray-600">
              <span className="font-semibold text-amber-800">{c.heRef}: </span>
              {c.text.slice(0, 200)}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleApprove}
          className="flex-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          אשר ועבור למקור הבא ←
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm"
        >
          דלג
        </button>
      </div>
    </div>
  );
}
