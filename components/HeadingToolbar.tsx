"use client";

export type HeadingAlign = "right" | "center" | "left";

export function AlignIcon({ align, active }: { align: HeadingAlign; active: boolean }) {
  const color = active ? "#ffffff" : "#7c3aed";
  const widths = ["100%", "68%", "84%"];
  const justifyItems = align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: justifyItems, width: 16, direction: "ltr" }}>
      {widths.map((w, i) => (
        <span key={i} style={{ display: "block", height: 1.5, width: w, backgroundColor: color, borderRadius: 1 }} />
      ))}
    </span>
  );
}

export function SizeIcon({ level, active }: { level: 1 | 2 | 3; active: boolean }) {
  const color = active ? "#ffffff" : "#7c3aed";
  const fontSize = level === 1 ? 15 : level === 2 ? 11 : 8;
  const fontWeight = level === 1 ? 700 : level === 2 ? 600 : 400;
  return (
    <span style={{ fontSize, fontWeight, color, lineHeight: 1, display: "block" }}>כ</span>
  );
}

export function HeadingToolbar({
  align, level, onAlignChange, onLevelChange, useMouseDown = false,
}: {
  align: HeadingAlign;
  level: 1 | 2 | 3;
  onAlignChange: (a: HeadingAlign) => void;
  onLevelChange: (l: 1 | 2 | 3) => void;
  useMouseDown?: boolean;
}) {
  const handleAlign = (a: HeadingAlign) => (e: React.MouseEvent) => {
    if (useMouseDown) e.preventDefault();
    onAlignChange(a);
  };
  const handleLevel = (l: 1 | 2 | 3) => (e: React.MouseEvent) => {
    if (useMouseDown) e.preventDefault();
    onLevelChange(l);
  };

  return (
    <div className="flex items-center gap-1">
      {(["right", "center", "left"] as HeadingAlign[]).map((a) => (
        <button
          key={a}
          onClick={handleAlign(a)}
          onMouseDown={useMouseDown ? handleAlign(a) : undefined}
          title={a === "right" ? "ימין" : a === "center" ? "מרכז" : "שמאל"}
          className={`flex items-center justify-center w-6 h-6 rounded border transition ${
            align === a ? "bg-purple-600 border-purple-600" : "border-purple-200 hover:bg-purple-100 bg-white"
          }`}
        >
          <AlignIcon align={a} active={align === a} />
        </button>
      ))}
      <span className="w-px h-4 bg-purple-200 mx-0.5" />
      {([1, 2, 3] as const).map((l) => (
        <button
          key={l}
          onClick={handleLevel(l)}
          onMouseDown={useMouseDown ? handleLevel(l) : undefined}
          title={l === 1 ? "גדול" : l === 2 ? "בינוני" : "קטן"}
          className={`flex items-center justify-center w-6 h-6 rounded border transition ${
            level === l ? "bg-purple-600 border-purple-600" : "border-purple-200 hover:bg-purple-100 bg-white"
          }`}
        >
          <SizeIcon level={l} active={level === l} />
        </button>
      ))}
    </div>
  );
}
