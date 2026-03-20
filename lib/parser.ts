import {
  TRACTATE_MAP,
  AUTHOR_MAP,
  YERUSHALMI_TRACTATE_MAP,
  MISHNAH_ONLY_TRACTATES,
  HILCHOT_MAP,
  RAMBAM_ABBREV_MAP,
  resolveAuthorRef,
} from "./authorMap";
import { fromHebrewNumeral } from "./hebrewNumerals";

export type ParsedSource = {
  raw: string;
  author?: string;
  book?: string;
  section?: string;
  sefariaRef?: string;
  seifIndex?: number;      // which SA se'if (0-based) this source belongs to
  mefaresh?: string;       // 'beit-yosef' | 'shakh' | 'taz' | 'pitchei-teshuvah'
  unresolved?: boolean;    // true when we couldn't build a Sefaria ref
  unresolvedHint?: string; // suggested format for manual entry
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const tractateKeys = Object.keys(TRACTATE_MAP).sort((a, b) => b.length - a.length);
const TRAC_ALT = tractateKeys.map(escapeRegex).join("|");

const authorKeys = Object.keys(AUTHOR_MAP).sort((a, b) => b.length - a.length);
const AUTH_ALT = authorKeys.map(escapeRegex).join("|");

const hilchotKeys = Object.keys(HILCHOT_MAP).sort((a, b) => b.length - a.length);
const HILCHOT_ALT = hilchotKeys.map(escapeRegex).join("|");

const abbrevKeys = Object.keys(RAMBAM_ABBREV_MAP).sort((a, b) => b.length - a.length);
const ABBREV_ALT = abbrevKeys.map(escapeRegex).join("|");

// Daf: 1–3 Hebrew letters or digits (נד, לו, ב, 56 etc.)
const DAF = "[א-ת\\d]{1,3}";

// ── Pattern 1: tractate + daf in square brackets  e.g. קידושין [נו:]
const RE_TALMUD_BRACKETS = new RegExp(`(${TRAC_ALT})\\s*\\[(${DAF})[.:]?\\]`, "g");

// ── Pattern 2: tractate + daf in parentheses  e.g. ראש השנה (ב.)
const RE_TALMUD_PARENS = new RegExp(`(${TRAC_ALT})\\s*\\((${DAF})[.:]?\\)`, "g");

// ── Pattern 3: tractate + daf plain  e.g. ברכות לו.  (daf must be 1-3 chars + . or :)
const RE_TALMUD_PLAIN = new RegExp(`(${TRAC_ALT})\\s+(${DAF})[.:]`, "g");

// ── Pattern 4a: chapter + tractate + daf in brackets  e.g. ספ"ב דקידושין [נו:]
const RE_TALMUD_CHAPTER_WITH_DAF = new RegExp(
  `[בסרל]?פ["'][א-ת]+\\s+ד(${TRAC_ALT})\\s*\\[(${DAF})[.:]?\\]`,
  "g"
);

// ── Pattern 4b: chapter-form reference  e.g. פ"ק דערלה  ספ"ב דקידושין
// For Mishnah-only tractates → resolves to Mishnah; for Bavli tractates → unresolved
const RE_TALMUD_CHAPTER = new RegExp(
  `([בסרל]?פ["'][א-ת]+)\\s+ד(${TRAC_ALT})`,
  "g"
);

// ── Pattern 5: explicit Mishnah  e.g. משנה בפ"ק דערלה
const RE_MISHNAH = new RegExp(
  `משנה\\s+ב([בסרל]?פ["'][א-ת]+)\\s+ד(${TRAC_ALT})`,
  "g"
);

// ── Pattern 6: Yerushalmi  e.g. ירושלמי פ"ק דערלה
const RE_YERUSHALMI = new RegExp(
  `ירושלמי\\s+([^\\s]+)\\s+ד(${TRAC_ALT})`,
  "g"
);

// ── Pattern 7: "ובגמרא (ט:)" — inherits last-seen tractate (injected via lastTractate param)
const RE_GEMARA_INHERIT = new RegExp(
  `ובגמרא\\s*\\((${DAF})[.:]\\)`,
  "g"
);

// ── Pattern 8: "בריש פ' כיצד מברכין (ברכות לה.)" — tractate+daf in parens after chapter name
const RE_BERESH_PEREK = new RegExp(
  `בריש\\s+פ['"]?\\s+[^(]+\\((${TRAC_ALT})\\s+(${DAF})[.:]\\)`,
  "g"
);

// ── Pattern 9: two authors + tractate+daf e.g. וכתבו הרי"ף והרא"ש ... (יבמות דף פג:)
const RE_MULTI_AUTHOR = new RegExp(
  `וכתבו?\\s+ה?(${AUTH_ALT})\\s+וה?(${AUTH_ALT})[^)]{0,80}\\((${TRAC_ALT})\\s+דף?\\s*(${DAF})[.:]\\)`,
  "g"
);

// ── Pattern 10: Rambam + chapter + hilchot  e.g. הרמב"ם בפ"ט מהלכות מעשר שני ונטע רבעי
const RE_RAMBAM_HILCHOT = new RegExp(
  `(?:ה?רמב"ם|הרמבם)\\s+בפ["']([א-ת]+)\\s+מהלכות\\s+(${HILCHOT_ALT})`,
  "g"
);

// ── Pattern 11: Rambam with abbreviated hilchot  e.g. בפ"י מהמ"א
const RE_RAMBAM_ABBREV = new RegExp(
  `(?:ה?רמב"ם|הרמבם)\\s+בפ["']([א-ת]+)\\s+מ(${ABBREV_ALT})`,
  "g"
);

// ── Pattern 12: author + chapter + tractate  e.g. הר"ן בפ"ק דר"ה
// Cannot resolve to daf; shown as unresolved with author+tractate hint
const RE_AUTHOR_CHAPTER_TRACTATE = new RegExp(
  `ה(${AUTH_ALT})\\s+בפ["'][א-ת]+\\s+ד(${TRAC_ALT})`,
  "g"
);

// ── Pattern 13: author with writing verb  e.g. וכתב הרא"ש  כתב הרמב"ם
const RE_AUTHOR_KATAV = new RegExp(
  `(?:וכתב|כתב)\\s+ה?(${AUTH_ALT})`,
  "g"
);

// ── Pattern 14: author as subject  e.g. הרמב"ם פירש  הרי"ף כתב
const RE_AUTHOR_SUBJECT = new RegExp(
  `ה(${AUTH_ALT})\\s+(?:כתב|פירש|סבר|אמר|פסק|ז"ל)`,
  "g"
);

// ────────────────────────────────────────────

type PatternDef = {
  re: RegExp;
  // lastTractate: last Babylonian Talmud tractate seen so far (for ובגמרא pattern)
  extract: (m: RegExpMatchArray, lastTractate: string) => Partial<ParsedSource> | Partial<ParsedSource>[];
};

function dafToArabic(daf: string): number | null {
  const trimmed = daf.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  return fromHebrewNumeral(trimmed);
}

// Parse chapter abbreviations: פ"ק=1, פ"א=1, פ"ב=2, פ"ג=3, etc.
// ק is special (= 1, not 100 gematria); all other letters use fromHebrewNumeral
function parseChapterNumber(s: string): number | null {
  const m = s.match(/[פ]["']([א-ת]+)/);
  if (!m) return null;
  if (m[1] === "ק") return 1; // פ"ק = פרק קמא = first chapter
  return fromHebrewNumeral(m[1]);
}

function buildTalmudRef(tractateHe: string, daf: string, amudSuffix?: string): string | undefined {
  const key = TRACTATE_MAP[tractateHe];
  if (!key || !daf) return undefined;
  const dafNum = dafToArabic(daf);
  if (!dafNum) return undefined;
  const amud = amudSuffix === ":" ? "b" : "a";
  return `${key}.${dafNum}${amud}`;
}

function buildRambamRef(hilchotKey: string, chapter: number): string {
  return `Mishneh_Torah%2C_Laws_of_${hilchotKey}.${chapter}`;
}

const PATTERNS: PatternDef[] = [
  // 1 — brackets
  {
    re: RE_TALMUD_BRACKETS,
    extract: (m) => ({
      book: m[1],
      section: `דף ${m[2]}`,
      sefariaRef: buildTalmudRef(m[1], m[2], m[0].includes(":") ? ":" : "."),
    }),
  },
  // 2 — parens
  {
    re: RE_TALMUD_PARENS,
    extract: (m) => ({
      book: m[1],
      section: `דף ${m[2]}`,
      sefariaRef: buildTalmudRef(m[1], m[2], m[0].includes(":") ? ":" : "."),
    }),
  },
  // 3 — plain
  {
    re: RE_TALMUD_PLAIN,
    extract: (m) => ({
      book: m[1],
      section: `דף ${m[2]}`,
      sefariaRef: buildTalmudRef(m[1], m[2], m[0].endsWith(":") ? ":" : "."),
    }),
  },
  // 4a — chapter + daf (highest priority — dedup removes 4b overlap)
  {
    re: RE_TALMUD_CHAPTER_WITH_DAF,
    extract: (m) => ({
      book: m[1],
      section: `דף ${m[2]}`,
      sefariaRef: buildTalmudRef(m[1], m[2], m[0].includes(":") ? ":" : "."),
    }),
  },
  // 4b — chapter only: Mishnah-only tractates resolve; Bavli tractates → unresolved
  {
    re: RE_TALMUD_CHAPTER,
    extract: (m) => {
      const tractateHe = m[2];
      const tractateKey = TRACTATE_MAP[tractateHe];
      const chapterNum = parseChapterNumber(m[1]);

      if (MISHNAH_ONLY_TRACTATES.has(tractateHe) && tractateKey && chapterNum) {
        return {
          book: `משנה ${tractateHe}`,
          section: m[0],
          sefariaRef: `Mishnah_${tractateKey}.${chapterNum}`,
        };
      }
      return {
        book: tractateHe,
        section: m[0],
        unresolved: true,
        unresolvedHint: tractateKey
          ? `הוסף ref ידנית כגון: ${tractateKey}.2a`
          : `הוסף ref ידנית כגון: [מסכת].2a`,
      };
    },
  },
  // 5 — explicit Mishnah
  {
    re: RE_MISHNAH,
    extract: (m) => {
      const tractateKey = TRACTATE_MAP[m[2]];
      const chapterNum = parseChapterNumber(m[1]);
      if (tractateKey && chapterNum) {
        return {
          book: `משנה ${m[2]}`,
          section: m[0],
          sefariaRef: `Mishnah_${tractateKey}.${chapterNum}`,
        };
      }
      return {
        book: `משנה ${m[2]}`,
        section: m[0],
        unresolved: true,
        unresolvedHint: tractateKey
          ? `הוסף ref ידנית כגון: Mishnah_${tractateKey}.1`
          : `הוסף ref ידנית כגון: Mishnah_[מסכת].1`,
      };
    },
  },
  // 6 — Yerushalmi
  {
    re: RE_YERUSHALMI,
    extract: (m) => {
      const tractateKey = YERUSHALMI_TRACTATE_MAP[m[2]] ?? TRACTATE_MAP[m[2]];
      const chapterNum = parseChapterNumber(m[1]);
      if (tractateKey && chapterNum) {
        return {
          book: `ירושלמי ${m[2]}`,
          section: m[0],
          sefariaRef: `Jerusalem_Talmud_${tractateKey}.${chapterNum}`,
        };
      }
      return {
        book: `ירושלמי ${m[2]}`,
        section: m[0],
        unresolved: true,
        unresolvedHint: tractateKey
          ? `הוסף ref ידנית כגון: Jerusalem_Talmud_${tractateKey}.1`
          : `הוסף ref ידנית כגון: Jerusalem_Talmud_[מסכת].1`,
      };
    },
  },
  // 7 — ובגמרא (ט:) — inherits lastTractate
  {
    re: RE_GEMARA_INHERIT,
    extract: (m, lastTractate) => {
      if (!lastTractate) return { raw: m[0], unresolved: true, unresolvedHint: "לא ידוע מאיזה מסכת" };
      const amud = m[0].includes(":") ? ":" : ".";
      return {
        book: lastTractate,
        section: `דף ${m[1]}`,
        sefariaRef: buildTalmudRef(lastTractate, m[1], amud),
      };
    },
  },
  // 8 — בריש פ' כיצד מברכין (ברכות לה.)
  {
    re: RE_BERESH_PEREK,
    extract: (m) => ({
      book: m[1],
      section: `דף ${m[2]}`,
      sefariaRef: buildTalmudRef(m[1], m[2], m[0].includes(":") ? ":" : "."),
    }),
  },
  // 9 — two authors + tractate+daf → returns TWO sources
  {
    re: RE_MULTI_AUTHOR,
    extract: (m) => {
      const author1 = m[1];
      const author2 = m[2];
      const tractateHe = m[3];
      const daf = m[4];
      const amud = m[0].includes(":") ? ":" : ".";
      const tractateKey = TRACTATE_MAP[tractateHe];
      const ref = buildTalmudRef(tractateHe, daf, amud);

      const source1: Partial<ParsedSource> = {
        author: author1,
        book: tractateHe,
        section: `דף ${daf}`,
        sefariaRef: tractateKey ? resolveAuthorRef(author1, tractateHe) ?? undefined : undefined,
      };
      const source2: Partial<ParsedSource> = {
        author: author2,
        book: tractateHe,
        section: `דף ${daf}`,
        sefariaRef: tractateKey ? resolveAuthorRef(author2, tractateHe) ?? undefined : undefined,
      };

      // Also add the base Talmud ref if we have it
      if (ref) {
        const talmudSource: Partial<ParsedSource> = {
          book: tractateHe,
          section: `דף ${daf}`,
          sefariaRef: ref,
        };
        return [source1, source2, talmudSource];
      }
      return [source1, source2];
    },
  },
  // 10 — Rambam + chapter + full hilchot name
  {
    re: RE_RAMBAM_HILCHOT,
    extract: (m) => {
      const chapterNum = parseChapterNumber(`פ"${m[1]}`);
      const hilchotKey = HILCHOT_MAP[m[2]];
      if (chapterNum && hilchotKey) {
        return {
          author: 'רמב"ם',
          book: `הלכות ${m[2]}`,
          section: `פרק ${m[1]}`,
          sefariaRef: buildRambamRef(hilchotKey, chapterNum),
        };
      }
      return {
        author: 'רמב"ם',
        book: `הלכות ${m[2]}`,
        section: m[0],
        unresolved: true,
        unresolvedHint: `הוסף ref ידנית כגון: Mishneh_Torah%2C_Laws_of_${hilchotKey ?? "X"}.1`,
      };
    },
  },
  // 11 — Rambam + chapter + abbreviated hilchot
  {
    re: RE_RAMBAM_ABBREV,
    extract: (m) => {
      const chapterNum = parseChapterNumber(`פ"${m[1]}`);
      const hilchotKey = RAMBAM_ABBREV_MAP[m[2]];
      if (chapterNum && hilchotKey) {
        return {
          author: 'רמב"ם',
          book: m[2],
          section: `פרק ${m[1]}`,
          sefariaRef: buildRambamRef(hilchotKey, chapterNum),
        };
      }
      return {
        author: 'רמב"ם',
        book: m[2],
        section: m[0],
        unresolved: true,
        unresolvedHint: `הוסף ref ידנית כגון: Mishneh_Torah%2C_Laws_of_${hilchotKey ?? "X"}.1`,
      };
    },
  },
  // 12 — author + chapter + tractate (e.g. הר"ן בפ"ק דר"ה) → unresolved with hint
  {
    re: RE_AUTHOR_CHAPTER_TRACTATE,
    extract: (m) => {
      const tractateKey = TRACTATE_MAP[m[2]];
      const authorRef = resolveAuthorRef(m[1], m[2]);
      return {
        author: m[1],
        book: m[2],
        section: m[0],
        sefariaRef: authorRef ?? undefined,
        unresolved: !authorRef,
        unresolvedHint: authorRef
          ? undefined
          : tractateKey
          ? `הוסף ref ידנית כגון: ${AUTHOR_MAP[m[1]]?.sefariaBook?.replace("{tractate}", tractateKey) ?? m[1]}.1`
          : undefined,
      };
    },
  },
  // 13 — author + writing verb (e.g. וכתב הרא"ש  כתב הרמב"ם)
  {
    re: RE_AUTHOR_KATAV,
    extract: (m) => ({
      author: m[1],
      sefariaRef: resolveAuthorRef(m[1]) ?? undefined,
      unresolved: !resolveAuthorRef(m[1]),
      unresolvedHint: !resolveAuthorRef(m[1]) ? `הגדר מקור ל${m[1]}` : undefined,
    }),
  },
  // 14 — author as subject (e.g. הרמב"ם פירש  הרי"ף כתב)
  {
    re: RE_AUTHOR_SUBJECT,
    extract: (m) => ({
      author: m[1],
      sefariaRef: resolveAuthorRef(m[1]) ?? undefined,
      unresolved: !resolveAuthorRef(m[1]),
      unresolvedHint: !resolveAuthorRef(m[1]) ? `הגדר מקור ל${m[1]}` : undefined,
    }),
  },
];

// ────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Internal type tracking match position for overlap dedup
type MatchResult = {
  raw: string;
  data: Partial<ParsedSource>;
  start: number;
  end: number;
};

function parseText(text: string): ParsedSource[] {
  const allMatches: MatchResult[] = [];
  const seenRaw = new Set<string>();
  let lastTractateHe = ""; // tracks last Babylonian Talmud tractate for ובגמרא pattern

  for (const pat of PATTERNS) {
    const re = new RegExp(pat.re.source, pat.re.flags);
    let m: RegExpMatchArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = m[0];
      if (seenRaw.has(raw)) continue;
      seenRaw.add(raw);

      const results = pat.extract(m, lastTractateHe);
      const arr: Partial<ParsedSource>[] = Array.isArray(results) ? results : [results];

      for (const data of arr) {
        // Update lastTractate for ובגמרא: only Bavli tractate dafs qualify
        const ref = data.sefariaRef as string | undefined;
        if (data.book && TRACTATE_MAP[data.book as string] && ref &&
            !ref.startsWith("Mishnah_") && !ref.startsWith("Jerusalem_")) {
          lastTractateHe = data.book as string;
        }
        allMatches.push({ raw, data, start: m.index!, end: m.index! + raw.length });
      }
    }
  }

  // Positional dedup: discard unresolved matches whose span is contained within a resolved match
  const resolvedRanges = allMatches
    .filter(r => r.data.sefariaRef)
    .map(r => [r.start, r.end] as [number, number]);

  return allMatches
    .filter(r => {
      if (r.data.sefariaRef) {
        // Drop if strictly contained within a wider resolved match
        return !resolvedRanges.some(
          ([s, e]) => s <= r.start && r.end <= e && !(s === r.start && e === r.end)
        );
      }
      if (r.data.unresolved) {
        return !resolvedRanges.some(([s, e]) => s <= r.start && r.end <= e);
      }
      return true;
    })
    .map(r => ({ raw: r.raw, ...r.data }));
}

function dedupByKey(sources: ParsedSource[]): ParsedSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = s.sefariaRef ?? `${s.author ?? ""}|${s.book ?? ""}|${s.section ?? ""}`;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseSourcesFromSeifim(seifim: string[]): ParsedSource[] {
  const all: ParsedSource[] = [];
  for (let i = 0; i < seifim.length; i++) {
    const text = stripHtml(seifim[i]);
    for (const s of parseText(text)) {
      all.push({ ...s, seifIndex: i });
    }
  }
  return dedupByKey(all);
}
