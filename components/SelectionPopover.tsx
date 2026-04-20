"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { buildSourceLabel } from "@/lib/sourceLabels";

const COMMENTATOR_KEYS = new Set(["beitYosef", "taz", "shakh", "pitcheiTeshuva"]);

type SelectionInfo = {
  sourceKey: string;
  sectionIndex?: number;
  sectionHtml?: string;
  text: string;
  x: number;
  y: number;
};

type AddParams = {
  sourceKey: string;
  sectionIndex?: number;
  text: string;
  sourceLabel: string;
  note?: string;
};

type TextsData = {
  tur: { ref: string; text: string } | null;
  beitYosef: { ref: string; text: string[] } | null;
  shulchanArukh: { ref: string; text: string[] } | null;
  taz: { ref: string; text: string[] } | null;
  shakh: { ref: string; text: string[] } | null;
  pitcheiTeshuva: { ref: string; text: string[] } | null;
} | null;

type SelectionPopoverProps = {
  onAdd: (params: AddParams) => void;
  onDefineSource?: (
    selectedText: string,
    sourceKey: string,
    sectionIndex?: number,
    sectionHtml?: string
  ) => void;
  texts?: TextsData;
};

type FreeTextState = {
  sourceKey: string;
  sectionIndex?: number;
  sourceLabel: string;
  value: string;
  note: string;
};

// Pending-add state: waiting for user to optionally add a note before confirming
type PendingAdd = {
  params: Omit<AddParams, "note">;
  note: string;
};

function getSourceElement(node: Node | null): Element | null {
  let el: Node | null = node;
  while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode;
  if (!el) return null;
  return (el as Element).closest("[data-source-key]");
}

export default function SelectionPopover({ onAdd, onDefineSource, texts }: SelectionPopoverProps) {
  const [selInfo, setSelInfo] = useState<SelectionInfo | null>(null);
  const [freeText, setFreeText] = useState<FreeTextState | null>(null);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const freeInputRef = useRef<HTMLTextAreaElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { setSelInfo(null); return; }
    const text = sel.toString().trim();
    if (!text) { setSelInfo(null); return; }

    const sourceEl = getSourceElement(sel.anchorNode);
    if (!sourceEl) { setSelInfo(null); return; }
    const sourceKey = sourceEl.getAttribute("data-source-key");
    if (!sourceKey) { setSelInfo(null); return; }

    const sectionAttr = sourceEl.getAttribute("data-section-index");
    const sectionIndex = sectionAttr !== null && sectionAttr !== "" ? parseInt(sectionAttr, 10) : undefined;

    let sectionHtml: string | undefined;
    if (sectionIndex !== undefined && texts) {
      const sourceData = (texts as Record<string, { ref: string; text: string[] } | null>)[sourceKey];
      sectionHtml = sourceData?.text?.[sectionIndex];
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelInfo({ sourceKey, sectionIndex, sectionHtml, text, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
  }, [texts]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  useEffect(() => { if (freeText) freeInputRef.current?.focus(); }, [freeText]);
  useEffect(() => { if (pendingAdd) noteInputRef.current?.focus(); }, [pendingAdd]);

  if (!selInfo && !freeText && !pendingAdd) return null;

  const isCommentator = selInfo ? COMMENTATOR_KEYS.has(selInfo.sourceKey) : false;

  function handleDirectAdd(e: React.MouseEvent) {
    e.preventDefault();
    if (!selInfo) return;
    const params: Omit<AddParams, "note"> = {
      sourceKey: selInfo.sourceKey,
      sectionIndex: selInfo.sectionIndex,
      text: selInfo.text,
      sourceLabel: buildSourceLabel(selInfo.sourceKey, selInfo.sectionIndex),
    };
    window.getSelection()?.removeAllRanges();
    setSelInfo(null);
    setPendingAdd({ params, note: "" });
  }

  function handleDefineSource(e: React.MouseEvent) {
    e.preventDefault();
    if (!selInfo || !onDefineSource) return;
    onDefineSource(selInfo.text, selInfo.sourceKey, selInfo.sectionIndex, selInfo.sectionHtml);
    window.getSelection()?.removeAllRanges();
    setSelInfo(null);
  }

  function handleOpenFreeText(e: React.MouseEvent) {
    e.preventDefault();
    if (!selInfo) return;
    setFreeText({
      sourceKey: selInfo.sourceKey,
      sectionIndex: selInfo.sectionIndex,
      sourceLabel: buildSourceLabel(selInfo.sourceKey, selInfo.sectionIndex),
      value: "",
      note: "",
    });
    window.getSelection()?.removeAllRanges();
    setSelInfo(null);
  }

  function confirmPendingAdd() {
    if (!pendingAdd) return;
    onAdd({ ...pendingAdd.params, note: pendingAdd.note || undefined });
    setPendingAdd(null);
  }

  function handleSubmitFreeText(e: React.MouseEvent) {
    e.preventDefault();
    if (!freeText || !freeText.value.trim()) return;
    onAdd({
      sourceKey: freeText.sourceKey,
      sectionIndex: freeText.sectionIndex,
      text: freeText.value.trim(),
      sourceLabel: freeText.sourceLabel,
      note: freeText.note || undefined,
    });
    setFreeText(null);
  }

  // ── Pending add: note before confirming ──
  if (pendingAdd) {
    return (
      <div
        className="fixed z-50 bg-white border border-gray-300 rounded-xl shadow-xl p-3 w-64"
        style={{ left: "50%", top: "30%", transform: "translateX(-50%)" }}
        dir="rtl"
      >
        <p className="text-xs text-gray-500 mb-2">{pendingAdd.params.sourceLabel}</p>
        <input
          ref={noteInputRef}
          type="text"
          value={pendingAdd.note}
          onChange={(e) => setPendingAdd((p) => p ? { ...p, note: e.target.value } : p)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); confirmPendingAdd(); }
            if (e.key === "Escape") setPendingAdd(null);
          }}
          placeholder="הערה (אופציונלי)"
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="flex gap-2">
          <button
            onClick={confirmPendingAdd}
            className="flex-1 bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
          >
            הוסף לדף
          </button>
          <button
            onClick={() => setPendingAdd(null)}
            className="px-3 py-1.5 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            ביטול
          </button>
        </div>
      </div>
    );
  }

  // ── Free text popover ──
  if (freeText) {
    return (
      <div
        className="fixed z-50 bg-white border border-gray-300 rounded-xl shadow-xl p-3 w-72"
        style={{ left: "50%", top: "30%", transform: "translateX(-50%)" }}
        dir="rtl"
      >
        <p className="text-xs text-gray-500 mb-1">{freeText.sourceLabel} — טקסט חופשי</p>
        <textarea
          ref={freeInputRef}
          value={freeText.value}
          onChange={(e) => setFreeText((prev) => prev ? { ...prev, value: e.target.value } : prev)}
          className="w-full text-sm border border-gray-200 rounded p-2 resize-y min-h-[80px] mb-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="הקלד טקסט..."
        />
        <input
          type="text"
          value={freeText.note}
          onChange={(e) => setFreeText((prev) => prev ? { ...prev, note: e.target.value } : prev)}
          placeholder="הערה (אופציונלי)"
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="flex gap-2">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSubmitFreeText}
            className="flex-1 bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
          >
            הוסף לדף
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFreeText(null)}
            className="px-3 py-1.5 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            ביטול
          </button>
        </div>
      </div>
    );
  }

  if (!selInfo) return null;

  // SA / Tur: single button
  if (!isCommentator) {
    return (
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleDirectAdd}
        className="fixed z-50 bg-blue-600 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg hover:bg-blue-700 transition"
        style={{ left: selInfo.x, top: selInfo.y, transform: "translateX(-50%)" }}
      >
        הוסף לדף +
      </button>
    );
  }

  // Commentators: 3 buttons
  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col gap-1 p-2"
      style={{ left: selInfo.x, top: selInfo.y, transform: "translateX(-50%)" }}
      dir="rtl"
    >
      {onDefineSource && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleDefineSource}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition"
        >
          הגדר מקור
        </button>
      )}
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleDirectAdd}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition"
      >
        הוסף לדף
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleOpenFreeText}
        className="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-4 py-1.5 rounded-lg transition"
      >
        הוסף טקסט חופשי
      </button>
    </div>
  );
}
