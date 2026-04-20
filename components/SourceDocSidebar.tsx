"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import type { Excerpt, DocItemType } from "@/lib/types";
import ExcerptCard from "./ExcerptCard";
import { HeadingToolbar } from "./HeadingToolbar";
import type { HeadingAlign } from "./HeadingToolbar";

type SourceDocSidebarProps = {
  excerpts: Excerpt[];
  chelek: string;
  siman: string;
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddAnnotation: (afterId: string, type: DocItemType, text: string) => void;
  onAddHeading: (afterId: string | null, text: string, align: HeadingAlign, level?: 1 | 2 | 3) => void;
  onUpdateHeading: (id: string, text: string, align: HeadingAlign, level: 1 | 2 | 3) => void;
  onEdit: (excerptId: string) => void;
  onReset: () => void;
};

export default function SourceDocSidebar({
  excerpts,
  chelek,
  siman,
  onRemove,
  onReorder,
  onAddAnnotation,
  onAddHeading,
  onUpdateHeading,
  onEdit,
  onReset,
}: SourceDocSidebarProps) {
  const dragIndex = useRef<number | null>(null);
  const dropTargetRef = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const updateDropTarget = useCallback((val: number | null) => {
    dropTargetRef.current = val;
    setDropTarget(val);
  }, []);
  const [topHeadingMode, setTopHeadingMode] = useState(false);
  const [topHeadingText, setTopHeadingText] = useState("");
  const [topHeadingAlign, setTopHeadingAlign] = useState<HeadingAlign>("right");
  const [topHeadingLevel, setTopHeadingLevel] = useState<1 | 2 | 3>(2);

  function submitTopHeading() {
    if (!topHeadingText.trim()) return;
    onAddHeading(null, topHeadingText.trim(), topHeadingAlign, topHeadingLevel);
    setTopHeadingText("");
    setTopHeadingAlign("right");
    setTopHeadingLevel(2);
    setTopHeadingMode(false);
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col border-l border-gray-200 bg-gray-50 h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-gray-700">דף מקורות</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {excerpts.length}
          </span>
        </div>
        {/* Top-level heading button */}
        <div className="mt-2">
          {topHeadingMode ? (
            <div className="border border-purple-200 rounded-lg p-2 bg-purple-50" dir="rtl">
              <input
                autoFocus
                type="text"
                value={topHeadingText}
                onChange={(e) => setTopHeadingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); submitTopHeading(); }
                  if (e.key === "Escape") { setTopHeadingMode(false); setTopHeadingText(""); }
                }}
                placeholder="טקסט הכותרת..."
                className="w-full border border-purple-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 mb-2"
              />
              <HeadingToolbar
                align={topHeadingAlign} level={topHeadingLevel}
                onAlignChange={setTopHeadingAlign} onLevelChange={setTopHeadingLevel}
              />
              <div className="flex gap-1 mt-1.5">
                <button onClick={submitTopHeading} className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700">הוסף</button>
                <button onClick={() => { setTopHeadingMode(false); setTopHeadingText(""); }} className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-100">ביטול</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setTopHeadingMode(true)}
              className="w-full text-xs text-purple-600 border border-purple-200 rounded py-1 hover:bg-purple-50 transition"
            >
              + הוסף כותרת
            </button>
          )}
        </div>
      </div>

      {/* Excerpt list */}
      <div className="flex-1 overflow-y-auto p-3">
        {excerpts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-8 leading-relaxed">
            סמן טקסט ולחץ ׳הוסף לדף׳
            <br />
            כדי להוסיף מקור
          </p>
        ) : (
          <>
            {excerpts.map((ex, idx) => (
              <div key={ex.id}>
                {/* Drop indicator line — appears ABOVE the target card */}
                {dropTarget === idx && dragIndex.current !== idx && dragIndex.current !== idx - 1 && (
                  <div className="h-0.5 bg-blue-500 rounded-full mx-1 mb-1 shadow-sm" />
                )}
                <ExcerptCard
                  excerpt={ex}
                  index={idx}
                  onRemove={() => onRemove(ex.id)}
                  onEdit={() => onEdit(ex.id)}
                  onAddAnnotation={(type, text) => onAddAnnotation(ex.id, type, text)}
                  onAddHeading={(afterId, text, align, level) => onAddHeading(afterId, text, align, level)}
                  onUpdateHeading={(id, text, align, level) => onUpdateHeading(id, text, align, level)}
                  dragHandlers={{
                    onDragStart: (e) => {
                      dragIndex.current = idx;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(idx));
                    },
                    onDragOver: (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const mid = rect.top + rect.height / 2;
                      updateDropTarget(e.clientY < mid ? idx : idx + 1);
                    },
                    onDrop: (e) => {
                      e.preventDefault();
                      const from = dragIndex.current;
                      const to = dropTargetRef.current; // always fresh — avoids stale closure
                      updateDropTarget(null);
                      dragIndex.current = null;
                      if (from !== null && to !== null && from !== to) {
                        const insertAt = to > from ? to - 1 : to;
                        if (from !== insertAt) onReorder(from, insertAt);
                      }
                    },
                    onDragEnd: () => {
                      updateDropTarget(null);
                      dragIndex.current = null;
                    },
                  }}
                />
                {/* Drop indicator after last card */}
                {idx === excerpts.length - 1 && dropTarget === excerpts.length && dragIndex.current !== idx && (
                  <div className="h-0.5 bg-blue-500 rounded-full mx-1 mt-1 shadow-sm" />
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0 space-y-2">
        {excerpts.length > 0 ? (
          <>
            <Link
              href={`/siman/${chelek}/${siman}/document`}
              className="block w-full text-center text-sm font-semibold bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              📄 צפה בדף מקורות
            </Link>
            <button
              onClick={onReset}
              className="w-full text-xs text-gray-400 hover:text-red-500 transition py-1"
            >
              נקה הכל
            </button>
          </>
        ) : (
          <p className="text-xs text-gray-300 text-center py-1">
            הוסף מקורות כדי לבנות את הדף
          </p>
        )}
      </div>
    </div>
  );
}
