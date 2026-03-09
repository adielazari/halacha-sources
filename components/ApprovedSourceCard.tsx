"use client";

import type { ApprovedSource } from "@/app/siman/[chelek]/[number]/store";

type Props = {
  source: ApprovedSource;
  index: number;
};

export default function ApprovedSourceCard({ source, index }: Props) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 opacity-80">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs bg-amber-700 text-white rounded-full px-2 py-0.5 font-medium">
          {index + 1}
        </span>
        <h3 className="font-semibold text-amber-900 text-sm">{source.ref || source.raw}</h3>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
        {source.selectedText}
      </p>
      {source.commentaries.length > 0 && (
        <div className="mt-2 pr-4 border-r-2 border-amber-300 space-y-1">
          {source.commentaries.map((c, i) => (
            <div key={i} className="text-xs text-gray-500">
              <span className="font-medium text-amber-800">{c.heRef}: </span>
              {c.text.slice(0, 120)}…
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
