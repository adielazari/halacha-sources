"use client";

import { useEffect, useRef } from "react";
import type { Annotation } from "@/lib/types";
import { highlightAnnotations } from "@/lib/highlightAnnotations";

interface Section {
  index: number;
  label?: string;
  html: string;
}

interface TextPanelProps {
  title: string;
  hexColor: string;
  sourceKey: string;
  expanded: boolean;
  onToggle: () => void;
  sections?: Section[];
  html?: string;
  annotations?: Annotation[];
  currentUser?: string;
  onSectionClick?: (sourceKey: string, sectionIndex: number, label: string) => void;
  heightPx?: number;
  onHeightChange?: (px: number) => void;
}

export default function TextPanel({
  title,
  hexColor,
  sourceKey,
  expanded,
  onToggle,
  sections,
  html,
  annotations,
  currentUser,
  onSectionClick,
  heightPx,
  onHeightChange,
}: TextPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Feed the native CSS resize-handle drag back into the persisted preference.
  // Read offsetHeight (border-box, matches the `style.height` we set below
  // under Tailwind's global border-box reset) rather than the ResizeObserver
  // entry's contentRect (content-box only, excludes padding — using it here
  // would silently shrink the persisted height by the padding amount every
  // time the panel re-renders). Skip the observer's initial on-observe firing
  // so merely expanding a panel doesn't immediately re-persist its height.
  useEffect(() => {
    if (!expanded || !onHeightChange) return;
    const el = contentRef.current;
    if (!el) return;
    let isFirst = true;
    let debounceTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      if (isFirst) { isFirst = false; return; }
      const newHeight = Math.round(el.offsetHeight);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onHeightChange(newHeight), 300);
    });
    observer.observe(el);
    return () => { clearTimeout(debounceTimer); observer.disconnect(); };
  }, [expanded, onHeightChange]);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-right select-none hover:brightness-95 transition"
        style={{ backgroundColor: hexColor + "18" }}
      >
        <span className="text-xs font-bold flex-shrink-0" style={{ color: hexColor }}>
          {expanded ? "▼" : "▶"}
        </span>
        <span className="font-bold text-gray-800 flex-1 text-right">{title}</span>
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: hexColor }}
        />
      </button>

      {expanded && (
        <div
          ref={contentRef}
          className="p-4 bg-white overflow-y-auto resize-y min-h-[120px]"
          style={{ height: heightPx, maxHeight: "80vh" }}
        >
          {html !== undefined ? (
            <div
              data-source-key={sourceKey}
              className="text-sm leading-loose text-gray-800"
              dir="rtl"
              dangerouslySetInnerHTML={{
                __html: highlightAnnotations(html, annotations ?? [], sourceKey, undefined, currentUser),
              }}
            />
          ) : sections && sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map((sec) => (
                <div
                  key={sec.index}
                  className="border-b border-gray-100 last:border-0 pb-3 last:pb-0"
                >
                  <div
                    data-source-key={sourceKey}
                    data-section-index={sec.index}
                    className="text-sm leading-loose text-gray-800"
                    dir="rtl"
                  >
                    {sec.label && (
                      onSectionClick && sourceKey === "shulchanArukh" ? (
                        <button
                          onClick={() => onSectionClick(sourceKey, sec.index, sec.label!)}
                          className="text-xs font-bold hover:underline cursor-pointer transition-opacity hover:opacity-70"
                          style={{ color: hexColor }}
                          title="הוסף ככותרת"
                        >
                          {sec.label}{" "}
                        </button>
                      ) : (
                        <strong className="text-xs font-bold" style={{ color: hexColor }}>
                          {sec.label}{" "}
                        </strong>
                      )
                    )}
                    <span
                      dangerouslySetInnerHTML={{
                        __html: highlightAnnotations(
                          sec.html,
                          annotations ?? [],
                          sourceKey,
                          sec.index,
                          currentUser
                        ),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">אין טקסט זמין</p>
          )}
        </div>
      )}
    </div>
  );
}
