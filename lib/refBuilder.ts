import { fromHebrewNumeral } from "./hebrewNumerals";
import { TRACTATE_MAP } from "./authorMap";

/**
 * Build a Sefaria ref for a Talmud Bavli or Yerushalmi daf.
 * dafHe: Hebrew letter(s) e.g. "נו" (without geresh)
 * amud: "א" | "ב"
 * yerushalmi: if true, prefix with "Jerusalem_Talmud_"
 */
export function buildGemaraRef(
  tractateHe: string,
  dafHe: string,
  amud: "א" | "ב",
  yerushalmi = false
): string | null {
  const tractateEn = TRACTATE_MAP[tractateHe];
  if (!tractateEn) return null;

  // Accept both Hebrew letters ("נו") and ASCII digits ("56")
  const dafNum = /^\d+$/.test(dafHe) ? parseInt(dafHe, 10) : fromHebrewNumeral(dafHe);
  if (dafNum === null || isNaN(dafNum as number)) return null;

  const amudEn = amud === "א" ? "a" : "b";
  const prefix = yerushalmi ? "Jerusalem_Talmud_" : "";
  return `${prefix}${tractateEn}.${dafNum}${amudEn}`;
}

/**
 * Build a Sefaria ref for a Mishnah.
 * tractateHe: Hebrew tractate name
 * chapterHe: Hebrew chapter letter(s) e.g. "ג"
 * mishnaHe: optional Hebrew mishna number
 */
export function buildMishnaRef(
  tractateHe: string,
  chapterHe: string,
  mishnaHe?: string
): string | null {
  const tractateEn = TRACTATE_MAP[tractateHe];
  if (!tractateEn) return null;

  const chapterNum = fromHebrewNumeral(chapterHe);
  if (chapterNum === null) return null;

  if (mishnaHe) {
    const mishnaNum = fromHebrewNumeral(mishnaHe);
    if (mishnaNum === null) return null;
    return `Mishnah_${tractateEn}.${chapterNum}.${mishnaNum}`;
  }
  return `Mishnah_${tractateEn}.${chapterNum}`;
}
