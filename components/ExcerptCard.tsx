"use client";

import { useState } from "react";
import type { Excerpt, DocItemType } from "@/lib/types";
import { getHex } from "@/lib/sourceLabels";
import { HeadingToolbar } from "./HeadingToolbar";
import type { HeadingAlign } from "./HeadingToolbar";

type DragHandlers = {
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
};

type ExcerptCardProps = {
  excerpt: Excerpt;
  index: number;
  onRemove: () => void;
  onEdit: () => void;
  onAddAnnotation: (type: DocItemType, text: string) => void;
  onAddHeading: (afterId: string, text: string, align: HeadingAlign, level: 1 | 2 | 3) => void;
  onUpdateHeading: (id: string, text: string, align: HeadingAlign, level: 1 | 2 | 3) => void;
  dragHandlers: DragHandlers;
};

const TYPE_STYLES: Record<string, { border: string; badge: string; label: string }> = {
  source:      { border: "", badge: "", label: "" },
  explanation: { border: "3px solid #22c55e", badge: "bg-green-100 text-green-800", label: "הסבר" },
  question:    { border: "3px solid #f59e0b", badge: "bg-amber-100 text-amber-800", label: "שאלה" },
  answer:      { border: "3px solid #14b8a6", badge: "bg-teal-100 text-teal-800", label: "תשובה" },
  heading:     { border: "3px solid #7c3aed", badge: "bg-purple-100 text-purple-800", label: "כותרת" },
};


export default function ExcerptCard({
  excerpt,
  index,
  onRemove,
  onEdit,
  onAddAnnotation,
  onAddHeading,
  onUpdateHeading,
  dragHandlers,
}: ExcerptCardProps) {
  const itemType = excerpt.type ?? "source";
  const hex = getHex(excerpt.sourceKey);
  const typeStyle = TYPE_STYLES[itemType] ?? TYPE_STYLES.source;
  const preview = excerpt.text.replace(/<[^>]+>/g, "").slice(0, 100);
  const truncated = excerpt.text.replace(/<[^>]+>/g, "").length > 100;

  const [menuOpen, setMenuOpen] = useState(false);
  const [annotationMode, setAnnotationMode] = useState<DocItemType | null>(null);
  const [annotationText, setAnnotationText] = useState("");

  // For adding a new heading after this card
  const [addHeadingMode, setAddHeadingMode] = useState(false);
  const [newHeadingText, setNewHeadingText] = useState("");
  const [newHeadingAlign, setNewHeadingAlign] = useState<HeadingAlign>("right");
  const [newHeadingLevel, setNewHeadingLevel] = useState<1 | 2 | 3>(2);

  // For editing this card if it's a heading
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(excerpt.text);
  const [editAlign, setEditAlign] = useState<HeadingAlign>(excerpt.headingAlign ?? "right");
  const [editLevel, setEditLevel] = useState<1 | 2 | 3>(excerpt.headingLevel ?? 2);

  const borderStyle = itemType === "source"
    ? { borderRightWidth: "3px", borderRightColor: hex }
    : { borderRight: typeStyle.border };

  const indentClass = itemType === "answer" ? "mr-4" : "";

  function submitAnnotation() {
    if (!annotationText.trim() || !annotationMode) return;
    onAddAnnotation(annotationMode, annotationText.trim());
    setAnnotationText("");
    setAnnotationMode(null);
    setMenuOpen(false);
  }

  function submitNewHeading() {
    if (!newHeadingText.trim()) return;
    onAddHeading(excerpt.id, newHeadingText.trim(), newHeadingAlign, newHeadingLevel);
    setNewHeadingText("");
    setNewHeadingAlign("right");
    setNewHeadingLevel(2);
    setAddHeadingMode(false);
  }

  function submitEditHeading() {
    if (!editText.trim()) return;
    onUpdateHeading(excerpt.id, editText.trim(), editAlign, editLevel);
    setEditMode(false);
  }

  function openEdit() {
    setEditText(excerpt.text);
    setEditAlign(excerpt.headingAlign ?? "right");
    setEditLevel(excerpt.headingLevel ?? 2);
    setEditMode(true);
  }

  return (
    <div className={indentClass}>
      <div
        draggable
        onDragStart={dragHandlers.onDragStart}
        onDragOver={dragHandlers.onDragOver}
        onDrop={dragHandlers.onDrop}
        onDragEnd={dragHandlers.onDragEnd}
        className="bg-white border border-gray-200 rounded-lg p-3 mb-1 cursor-grab active:cursor-grabbing select-none"
        style={borderStyle}
      >
        <div className="flex items-start gap-2">
          <span className="text-gray-400 text-xs mt-0.5 flex-shrink-0">⠿</span>

          <div className="flex-1 min-w-0">
            {itemType === "heading" ? (
              editMode ? (
                /* Inline edit form for heading */
                <div dir="rtl" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); submitEditHeading(); }
                      if (e.key === "Escape") setEditMode(false);
                    }}
                    className="w-full border border-purple-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 mb-1.5"
                  />
                  <HeadingToolbar
                    align={editAlign} level={editLevel}
                    onAlignChange={setEditAlign} onLevelChange={setEditLevel}
                  />
                  <div className="flex gap-1 mt-1.5">
                    <button onClick={submitEditHeading} className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700">שמור</button>
                    <button onClick={() => setEditMode(false)} className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-100">ביטול</button>
                  </div>
                </div>
              ) : (
                /* Heading display — click to edit (div, not button, so drag still works) */
                <div
                  className="w-full text-right cursor-text"
                  onClick={openEdit}
                  title="לחץ לעריכה"
                >
                  <p className="text-xs font-bold leading-snug text-purple-700 truncate" dir="rtl">
                    {excerpt.text}
                  </p>
                </div>
              )
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  {itemType !== "source" && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${typeStyle.badge}`}>
                      {typeStyle.label}
                    </span>
                  )}
                  {itemType === "source" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: hex }}>
                      {excerpt.sourceLabel}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 mr-auto">{index + 1}</span>
                </div>
                <p className="text-xs text-gray-700 leading-snug" dir="rtl">
                  {preview}{truncated && "…"}
                </p>
              </>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="text-gray-400 hover:text-blue-500 transition text-sm font-bold leading-none hover:bg-blue-50 rounded px-1"
              aria-label="פעולות"
            >
              ⋮
            </button>
            {itemType === "source" && (
              <button
                onClick={onEdit}
                className="text-gray-400 hover:text-amber-600 transition text-xs leading-none"
                aria-label="ערוך מקור"
                title="ערוך מקור"
              >
                ✎
              </button>
            )}
            <button
              onClick={onRemove}
              className="text-gray-400 hover:text-red-500 transition text-sm leading-none"
              aria-label="הסר"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Action menu */}
      {menuOpen && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-1 mr-4 text-xs" dir="rtl">
          {(["explanation", "question"] as DocItemType[]).map((t) => (
            <button
              key={t}
              onClick={() => { setAnnotationMode(t); setMenuOpen(false); }}
              className="block w-full text-right px-3 py-1.5 hover:bg-gray-50 transition"
            >
              {t === "explanation" ? "➕ הוסף הסבר" : "➕ הוסף שאלה"}
            </button>
          ))}
          {itemType === "question" && (
            <button
              onClick={() => { setAnnotationMode("answer"); setMenuOpen(false); }}
              className="block w-full text-right px-3 py-1.5 hover:bg-gray-50 transition"
            >
              ➕ הוסף תשובה
            </button>
          )}
          <button
            onClick={() => { setAddHeadingMode(true); setMenuOpen(false); }}
            className="block w-full text-right px-3 py-1.5 hover:bg-purple-50 text-purple-700 transition"
          >
            ➕ הוסף כותרת
          </button>
        </div>
      )}

      {/* Inline annotation textarea */}
      {annotationMode && (
        <div className="mb-2 mr-4" dir="rtl">
          <textarea
            autoFocus
            value={annotationText}
            onChange={(e) => setAnnotationText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAnnotation(); }
              if (e.key === "Escape") { setAnnotationMode(null); setAnnotationText(""); }
            }}
            placeholder={annotationMode === "explanation" ? "כתוב הסבר..." : annotationMode === "question" ? "כתוב שאלה..." : "כתוב תשובה..."}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
            rows={2}
          />
          <div className="flex gap-2 mt-1">
            <button onClick={submitAnnotation} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700">הוסף</button>
            <button onClick={() => { setAnnotationMode(null); setAnnotationText(""); }} className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-100">ביטול</button>
          </div>
        </div>
      )}

      {/* Add heading form (after this card) */}
      {addHeadingMode && (
        <div className="mb-2 mr-4 border border-purple-200 rounded-lg p-2 bg-purple-50" dir="rtl">
          <input
            autoFocus
            type="text"
            value={newHeadingText}
            onChange={(e) => setNewHeadingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submitNewHeading(); }
              if (e.key === "Escape") { setAddHeadingMode(false); setNewHeadingText(""); }
            }}
            placeholder="טקסט הכותרת..."
            className="w-full border border-purple-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 mb-1.5"
          />
          <HeadingToolbar
            align={newHeadingAlign} level={newHeadingLevel}
            onAlignChange={setNewHeadingAlign} onLevelChange={setNewHeadingLevel}
          />
          <div className="flex gap-1 mt-1.5">
            <button onClick={submitNewHeading} className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700">הוסף</button>
            <button onClick={() => { setAddHeadingMode(false); setNewHeadingText(""); }} className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-100">ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}
