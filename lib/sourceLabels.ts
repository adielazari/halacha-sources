import { toHebrewNumeral } from "./hebrewNumerals";

export const SOURCE_LABELS: Record<string, string> = {
  shulchanArukh: 'שו"ע',
  tur: "טור",
  beitYosef: 'ב"י',
  taz: 'ט"ז',
  shakh: 'ש"ך',
  pitcheiTeshuva: 'פת"ש',
};

export const SOURCE_COLORS: Record<string, { hex: string }> = {
  shulchanArukh: { hex: "#2563eb" },
  tur:           { hex: "#16a34a" },
  beitYosef:     { hex: "#d97706" },
  taz:           { hex: "#0d9488" },
  shakh:         { hex: "#4f46e5" },
  pitcheiTeshuva:{ hex: "#9333ea" },
  heading:       { hex: "#7c3aed" },
};

export function getHex(sourceKey: string): string {
  return SOURCE_COLORS[sourceKey]?.hex ?? "#6b7280";
}

/** Returns just "א.", "ב.", etc. — used for commentator section labels */
export function buildSectionNumber(index: number): string {
  return `${toHebrewNumeral(index + 1).replace(/[׳״]/g, "")}.`;
}

export function buildSourceLabel(sourceKey: string, sectionIndex?: number): string {
  const base = SOURCE_LABELS[sourceKey] ?? sourceKey;
  if (sectionIndex === undefined) return base;
  const num = toHebrewNumeral(sectionIndex + 1);
  switch (sourceKey) {
    case "shulchanArukh":   return `${base} סעיף ${num}`;
    case "taz":             return `${base} ס"ק ${num}`;
    case "shakh":           return `${base} ס"ק ${num}`;
    case "pitcheiTeshuva":  return `${base} אות ${num}`;
    default:                return base;
  }
}
