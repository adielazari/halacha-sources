import { AUTHOR_MAP, TRACTATE_MAP, resolveAuthorRef } from "./authorMap";

export type ParsedSource = {
  raw: string;
  author?: string;
  book?: string;
  section?: string;
  sefariaRef?: string;
  seifIndex?: number;   // which se'if this came from (0-indexed)
};

// Hebrew numerals and number words
const HE_NUM = '[א-ת\'"כ]{1,5}|\\d+';

// Build author regex from known map
const authorKeys = Object.keys(AUTHOR_MAP)
  .map((k) => k.replace(/"/g, '\\"').replace(/'/g, "\\'"))
  .sort((a, b) => b.length - a.length); // longest first

const AUTHOR_RE_SRC = authorKeys.map((k) => escapeRegex(k)).join("|");

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Tractate names for Talmud detection
const tractateKeys = Object.keys(TRACTATE_MAP).sort((a, b) => b.length - a.length);
const TRACTATE_RE_SRC = tractateKeys.map(escapeRegex).join("|");

// ---------- PATTERNS ----------

type PatternDef = {
  name: string;
  re: RegExp;
  extract: (m: RegExpMatchArray) => Partial<ParsedSource>;
};

const PATTERNS: PatternDef[] = [
  // 1. "כתב הרמב"ם בהלכות שבת פרק/סימן ג"
  {
    name: "katav-author",
    re: new RegExp(
      `כת[בו]\\s+ה?(${AUTHOR_RE_SRC})\\s+ב(\\S+(?:\\s+\\S+)?)\\s+(פרק|סימן|דף|הלכה)\\s+(${HE_NUM})`,
      "g"
    ),
    extract: (m) => ({
      author: m[1],
      book: m[2],
      section: `${m[3]} ${m[4]}`,
      sefariaRef: tryResolveAuthorRef(m[1]),
    }),
  },

  // 2. "עיין/עי' בספר X פרק/סימן N"
  {
    name: "ayen",
    re: new RegExp(
      `(?:עיין|עי')\\s+ב(\\S+(?:\\s+\\S+)?)\\s+(פרק|סימן|דף)\\s+(${HE_NUM})`,
      "g"
    ),
    extract: (m) => ({
      book: m[1],
      section: `${m[2]} ${m[3]}`,
    }),
  },

  // 3. Talmud: "כדאיתא במסכת שבת דף יג"
  {
    name: "talmud-kdaitah",
    re: new RegExp(
      `כדאיתא\\s+(?:ב|במסכת)(${TRACTATE_RE_SRC})\\s+(?:דף|פרק)\\s+(${HE_NUM}(?:\\s+[עא])?)`,
      "g"
    ),
    extract: (m) => ({
      book: m[1],
      section: `דף ${m[2]}`,
      sefariaRef: buildTalmudRef(m[1], m[2]),
    }),
  },

  // 4. Talmud: standalone tractate + daf reference "מסכת שבת דף יג ע"א"
  {
    name: "talmud-masekhet",
    re: new RegExp(
      `(?:מסכת\\s+)?(${TRACTATE_RE_SRC})\\s+(?:דף\\s+)?(${HE_NUM})\\s+ע(?:מוד)?['"\\s]*([אב])`,
      "g"
    ),
    extract: (m) => ({
      book: m[1],
      section: `דף ${m[2]} ע${m[3]}`,
      sefariaRef: buildTalmudRef(m[1], m[2], m[3]),
    }),
  },

  // 5. "כמ"ש/כמו שכתב הרמב"ם ב... פרק N"
  {
    name: "kmo-shekatav",
    re: new RegExp(
      `כמ["']ש\\s+(?:ה)?(${AUTHOR_RE_SRC})\\s+ב(\\S+(?:\\s+\\S+)?)\\s+(פרק|סימן|דף)\\s+(${HE_NUM})`,
      "g"
    ),
    extract: (m) => ({
      author: m[1],
      book: m[2],
      section: `${m[3]} ${m[4]}`,
      sefariaRef: tryResolveAuthorRef(m[1]),
    }),
  },
];

function tryResolveAuthorRef(author: string, tractate?: string, chelek?: string): string | undefined {
  return resolveAuthorRef(author, tractate, chelek) ?? undefined;
}

function buildTalmudRef(tractateHe: string, daf: string, amud?: string): string {
  const tractateKey = Object.entries(TRACTATE_MAP).find(([k]) => k === tractateHe)?.[1];
  if (!tractateKey) return "";
  const amudPart = amud === "א" ? "a" : amud === "ב" ? "b" : "a";
  return `${tractateKey}.${daf}${amudPart}`;
}

export function parseSourcesFromSeifim(seifim: string[]): ParsedSource[] {
  const results: ParsedSource[] = [];

  for (let i = 0; i < seifim.length; i++) {
    const seif = stripHtml(seifim[i]);
    const seifSources = parseText(seif);
    for (const s of seifSources) {
      results.push({ ...s, seifIndex: i });
    }
  }

  return dedup(results);
}

function parseText(text: string): ParsedSource[] {
  const found: ParsedSource[] = [];
  const seen = new Set<string>();

  for (const pat of PATTERNS) {
    const re = new RegExp(pat.re.source, pat.re.flags);
    let m: RegExpMatchArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = m[0];
      if (seen.has(raw)) continue;
      seen.add(raw);
      const parsed = pat.extract(m);
      found.push({ raw, ...parsed });
    }
  }

  return found;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function dedup(sources: ParsedSource[]): ParsedSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = s.sefariaRef ?? s.raw;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
