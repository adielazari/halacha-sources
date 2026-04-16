"use client";

import type { ApprovedSource } from "@/app/siman/[chelek]/[number]/store";

const MEFARESH_LABELS: Record<string, string> = {
  "beit-yosef": 'ב"י',
  shakh: 'ש"ך',
  taz: 'ט"ז',
  "pitchei-teshuvah": 'פ"ת',
};

type Props = {
  source: ApprovedSource;
  index: number;
  onEdit: () => void;
};

export default function ApprovedSourceCard({ source, index, onEdit }: Props) {
  function copyText() {
    navigator.clipboard.writeText(source.selectedText).catch(() => {});
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 opacity-80">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs bg-amber-700 text-white rounded-full px-2 py-0.5 font-medium">
          {index + 1}
        </span>
        <h3 className="font-semibold text-amber-900 text-sm flex-1">{source.ref || source.raw}</h3>
        {source.mefaresh && (
          <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
            {MEFARESH_LABELS[source.mefaresh] ?? source.mefaresh}
          </span>
        )}
        <button
          onClick={copyText}
          className="text-xs text-gray-400 hover:text-amber-700 transition px-1"
          title="העתק טקסט"
        >
          העתק
        </button>
        <button
          onClick={onEdit}
          className="text-xs text-gray-400 hover:text-amber-700 underline transition"
        >
          ערוך
        </button>
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
