"use client";

import { useEffect, useRef, useState } from "react";
import type { Annotation } from "@/lib/types";
import { highlightAnnotations } from "@/lib/highlightAnnotations";
import { toHebrewNumeral } from "@/lib/hebrewNumerals";

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
  // Applied to the header only (not the content) — HTML5 drag-and-drop
  // treats any draggable ancestor as a valid drag origin for a mouse-drag
  // gesture starting anywhere inside it, which used to swallow ordinary
  // text-selection drags anywhere in the panel's body.
  draggable?: boolean;
  // Lets a section's own label (e.g. a Beit Yosef paragraph's "א") open an
  // inline SA se'if picker — no reliable automatic Beit Yosef↔se'if mapping
  // exists, so this is how the user builds that link by hand as they study.
  maxSeif?: number;
  linkedSeifBySection?: Record<number, number>;
  onLinkSeif?: (sectionIndex: number, seif: number | undefined) => void;
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
  draggable,
  maxSeif,
  linkedSeifBySection,
  onLinkSeif,
}: TextPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [seifPickerOpen, setSeifPickerOpen] = useState<number | null>(null);

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
        draggable={draggable}
        className={`w-full flex items-center gap-3 px-4 py-3 text-right select-none hover:brightness-95 transition ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
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
                      ) : onLinkSeif && maxSeif ? (
                        <span onClick={(e) => e.stopPropagation()}>
                          {seifPickerOpen === sec.index ? (
                            <select
                              autoFocus
                              defaultValue={linkedSeifBySection?.[sec.index] !== undefined ? String(linkedSeifBySection[sec.index] + 1) : ""}
                              onChange={(e) => {
                                const n = parseInt(e.target.value, 10);
                                onLinkSeif(sec.index, Number.isFinite(n) && n > 0 ? n - 1 : undefined);
                                setSeifPickerOpen(null);
                              }}
                              onBlur={() => setSeifPickerOpen(null)}
                              className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              <option value="">ללא</option>
                              {Array.from({ length: maxSeif }, (_, i) => (
                                <option key={i} value={i + 1}>סעיף {toHebrewNumeral(i + 1)}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setSeifPickerOpen(sec.index)}
                              className="text-xs font-bold hover:underline cursor-pointer transition-opacity hover:opacity-70"
                              style={{ color: hexColor }}
                              title="קשר לסעיף בשולחן ערוך"
                            >
                              {sec.label}{" "}
                              {linkedSeifBySection?.[sec.index] !== undefined && (
                                <span className="text-gray-400 font-normal">
                                  (→ סעיף {toHebrewNumeral(linkedSeifBySection[sec.index] + 1)})
                                </span>
                              )}
                            </button>
                          )}
                        </span>
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
