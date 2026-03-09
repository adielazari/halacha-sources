"use client";

type Props = {
  current: number;
  total: number;
};

export default function ProgressBar({ current, total }: Props) {
  const pct = total === 0 ? 0 : Math.round(((current) / total) * 100);
  return (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      <span>מקור {current + 1} מתוך {total}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className="bg-amber-600 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400">{pct}%</span>
    </div>
  );
}
