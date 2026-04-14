"use client";

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
  html?: string; // single-section (Tur)
  annotations?: Annotation[];
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
}: TextPanelProps) {
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
        <div className="p-4 bg-white max-h-[55vh] overflow-y-auto">
          {html !== undefined ? (
            <div
              data-source-key={sourceKey}
              className="text-sm leading-loose text-gray-800"
              dir="rtl"
              dangerouslySetInnerHTML={{
                __html: highlightAnnotations(html, annotations ?? [], sourceKey),
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
                      <strong className="text-xs font-bold" style={{ color: hexColor }}>
                        {sec.label}{" "}
                      </strong>
                    )}
                    <span
                      dangerouslySetInnerHTML={{
                        __html: highlightAnnotations(
                          sec.html,
                          annotations ?? [],
                          sourceKey,
                          sec.index
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
