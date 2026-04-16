"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  html: string;
  rawCitation?: string;          // text to highlight (currentSource.raw)
  mefareshLabel: string;
  onAddMissedSource: (selectedText: string) => void;
};

function highlightCitation(html: string, raw: string): string {
  if (!raw) return html;
  // Escape special regex chars in raw
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(escaped, "g"),
    `<mark id="current-citation" class="bg-yellow-200 rounded px-0.5 scroll-mt-4">${raw}</mark>`
  );
}

export default function MefareshTextView({
  html,
  rawCitation,
  mefareshLabel,
  onAddMissedSource,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionText, setSelectionText] = useState("");
  const [btnPos, setBtnPos] = useState<{ x: number; y: number } | null>(null);

  // Scroll to highlighted citation whenever it changes
  useEffect(() => {
    if (!rawCitation) return;
    // Small delay to let dangerouslySetInnerHTML render
    const t = setTimeout(() => {
      const el = containerRef.current?.querySelector("#current-citation");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(t);
  }, [rawCitation, html]);

  function handleMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (text.length < 3) {
      setSelectionText("");
      setBtnPos(null);
      return;
    }
    setSelectionText(text);
    // Position floating button near selection
    const range = sel?.getRangeAt(0);
    if (range) {
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setBtnPos({
          x: rect.left - containerRect.left,
          y: rect.bottom - containerRect.top + 6,
        });
      }
    }
  }

  function handleAddClick() {
    if (selectionText) {
      onAddMissedSource(selectionText);
      setSelectionText("");
      setBtnPos(null);
      window.getSelection()?.removeAllRanges();
    }
  }

  const displayHtml = rawCitation ? highlightCitation(html, rawCitation) : html;

  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm">
      <div className="px-4 py-2 border-b border-amber-100 flex items-center gap-2">
        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
          {mefareshLabel}
        </span>
        {rawCitation && (
          <span className="text-xs text-gray-400">
            — מסומן: <span className="font-medium text-gray-600">{rawCitation.slice(0, 40)}</span>
          </span>
        )}
      </div>
      <div className="relative" ref={containerRef}>
        <div
          className="px-5 py-4 text-sm leading-loose text-gray-700 max-h-60 overflow-y-auto select-text"
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: displayHtml }}
          onMouseUp={handleMouseUp}
        />

        {btnPos && selectionText && (
          <button
            style={{ top: btnPos.y, left: btnPos.x }}
            className="absolute z-10 bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-md transition whitespace-nowrap"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleAddClick}
          >
            הוסף מקור שפוספס +
          </button>
        )}
      </div>
    </div>
  );
}
