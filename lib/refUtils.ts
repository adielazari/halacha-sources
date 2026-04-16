import { toHebrewNumeral } from "./hebrewNumerals";
import { TRACTATE_MAP } from "./authorMap";

// Complete English→Hebrew mapping derived from the authoritative TRACTATE_MAP
export const TRACTATE_HE: Record<string, string> = Object.fromEntries(
  Object.entries(TRACTATE_MAP).map(([he, en]) => [en, he])
);

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeText(t: string): string {
  return t
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u05B0-\u05C7\u05F3\u05F4]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findSegmentRefs(
  chunks: string[],
  segs: Array<{ ref: string; text: string }>
): string[] {
  if (segs.length === 0) return [];

  const normalSegs = segs.map((s) => normalizeText(s.text));
  const matchedIndices = new Set<number>();

  for (const chunk of chunks) {
    const normalChunk = normalizeText(chunk);
    const windowSize = 30;
    const windows: string[] = [];
    for (let i = 0; i < normalChunk.length - windowSize + 1; i += windowSize) {
      windows.push(normalChunk.slice(i, i + windowSize));
    }
    if (windows.length === 0 && normalChunk.length > 0) {
      windows.push(normalChunk.slice(0, 30));
    }

    for (let si = 0; si < normalSegs.length; si++) {
      for (const w of windows) {
        if (normalSegs[si].includes(w)) {
          matchedIndices.add(si);
          break;
        }
      }
    }
  }

  if (matchedIndices.size === 0) return [];

  const sorted = Array.from(matchedIndices).sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const expanded: string[] = [];
  for (let i = first; i <= last; i++) {
    expanded.push(segs[i].ref);
  }
  return expanded;
}

export function parseTalmudRef(ref: string) {
  const m = ref.match(/^(.+)\.(\d+)(a|b)$/);
  if (!m) return null;
  return { tractate: m[1], daf: parseInt(m[2]), amud: m[3] as "a" | "b" };
}

export function adjacentRef(ref: string, dir: "next" | "prev"): string | null {
  const p = parseTalmudRef(ref);
  if (!p) return null;
  if (dir === "next") {
    return p.amud === "a" ? `${p.tractate}.${p.daf}b` : `${p.tractate}.${p.daf + 1}a`;
  } else {
    if (p.amud === "b") return `${p.tractate}.${p.daf}a`;
    if (p.daf <= 2) return null;
    return `${p.tractate}.${p.daf - 1}b`;
  }
}


export function refLabel(ref: string): string {
  const p = parseTalmudRef(ref);
  if (!p) return ref;
  const name = TRACTATE_HE[p.tractate] ?? p.tractate;
  const dafHe = toHebrewNumeral(p.daf).replace(/[׳״]/g, "");
  const amud = p.amud === "b" ? ":" : ".";
  return `${name} דף ${dafHe}${amud}`;
}
