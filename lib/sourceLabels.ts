import { toHebrewNumeral } from "./hebrewNumerals";

export const SOURCE_LABELS: Record<string, string> = {
  shulchanArukh: 'שו"ע',
  tur: "טור",
  beitYosef: 'ב"י',
  taz: 'ט"ז',
  shakh: 'ש"ך',
  pitcheiTeshuva: 'פת"ש',
  magenAvraham: 'מג"א',
  beitShmuel: 'ב"ש',
  meiratEinayim: 'סמ"ע',
};

export const SOURCE_COLORS: Record<string, { hex: string }> = {
  shulchanArukh: { hex: "#2563eb" },
  tur:           { hex: "#16a34a" },
  beitYosef:     { hex: "#d97706" },
  taz:           { hex: "#0d9488" },
  shakh:         { hex: "#4f46e5" },
  pitcheiTeshuva:{ hex: "#9333ea" },
  magenAvraham:  { hex: "#c2410c" },
  beitShmuel:    { hex: "#be185d" },
  meiratEinayim: { hex: "#0891b2" },
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
    case "magenAvraham":    return `${base} ס"ק ${num}`;
    case "beitShmuel":      return `${base} ס"ק ${num}`;
    case "meiratEinayim":   return `${base} ס"ק ${num}`;
    case "pitcheiTeshuva":  return `${base} אות ${num}`;
    default:                return base;
  }
}

/** Full (non-abbreviated) source names — used for the document's grouped-section headings. */
const FULL_SOURCE_NAMES: Record<string, string> = {
  tur: "טור",
  beitYosef: "בית יוסף",
  shulchanArukh: "שולחן ערוך",
  taz: 'ט"ז',
  shakh: 'ש"ך',
  pitcheiTeshuva: "פתחי תשובה",
  magenAvraham: "מגן אברהם",
  beitShmuel: "בית שמואל",
  meiratEinayim: "מאירת עיניים",
};

/**
 * Heading shown in the document/export when 2+ excerpts were pulled from the
 * same panel section, e.g. "בית יוסף אות ה'" — groups them under one origin label.
 */
export function buildGroupHeading(sourceKey: string, sectionIndex?: number): string {
  const base = FULL_SOURCE_NAMES[sourceKey] ?? SOURCE_LABELS[sourceKey] ?? sourceKey;
  if (sectionIndex === undefined) return base;
  const num = toHebrewNumeral(sectionIndex + 1);
  switch (sourceKey) {
    case "shulchanArukh":   return `${base} סעיף ${num}`;
    case "taz":
    case "shakh":
    case "magenAvraham":
    case "beitShmuel":
    case "meiratEinayim":   return `${base} ס"ק ${num}`;
    case "pitcheiTeshuva":
    case "beitYosef":
    case "tur":             return `${base} אות ${num}`;
    default:                return base;
  }
}
