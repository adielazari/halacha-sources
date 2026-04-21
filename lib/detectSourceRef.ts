/**
 * Detects a halachic source reference embedded in a Hebrew text snippet.
 * Used to pre-fill the SourcePullView form when the user highlights text.
 */

import { TRACTATE_MAP, MISHNAH_ONLY_TRACTATES } from "./authorMap";
import { TORAH_BOOKS, NEVIIM_BOOKS, KETUVIM_BOOKS } from "./tanakhBooks";
import type { TanakhBook } from "./tanakhBooks";
import { fromHebrewNumeral } from "./hebrewNumerals";
import { RAMBAM_MAP } from "./rambamMap";

export type DetectedRef =
  | {
      type: "gemara" | "mishna" | "yerushalmi";
      tractateHe: string;
      tractateEn: string;
      chapter?: number;
      daf?: number;
      amud?: "a" | "b";
      mishna?: number;
      halacha?: number;
    }
  | {
      type: "sifri";
      sifriBook: "Bamidbar" | "Devarim";
      piska?: number;
    }
  | {
      type: "tanakh";
      book: TanakhBook;
      chapter?: number;
      verse?: number;
    }
  | {
      type: "rambam";
      hilkhotHe?: string;  // full key e.g. "הלכות בכורים" — absent for bare "הרמב"ם"
      sefRef?: string;     // Sefaria ref base
      chapter?: number;
      halacha?: number;
    };

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse a Hebrew letter-numeral (with or without geresh). ק = 1 (פ"ק = first). */
function parseHebLetter(s: string): number | null {
  const clean = s.replace(/[׳״'"]/g, "").trim();
  if (!clean) return null;
  if (clean === "ק") return 1;
  if (/^\d+$/.test(clean)) return parseInt(clean, 10);
  return fromHebrewNumeral(clean);
}

/** Extract chapter number from abbreviated or word-form chapter string. */
function extractChapter(s: string): number | null {
  // Word form: "בפרק ב׳" / "פרק קמא" / "פרק ראשון"
  const word = s.match(/פרק\s+([א-ת]+[׳]?)/);
  if (word) {
    const w = word[1].replace(/[׳]/g, "").trim();
    if (w === "קמא" || w === "ראשון") return 1;
    if (w === "שני") return 2;
    if (w === "שלישי") return 3;
    if (w === "רביעי") return 4;
    if (w === "חמישי") return 5;
    return parseHebLetter(word[1]);
  }
  // Abbrev form: פ"ב / פ״ב / ספ"ב / בפ"ב / פ"ק
  const abbrev = s.match(/פ['"""׳״]([א-תק]+)/);
  if (abbrev) return parseHebLetter(abbrev[1]);
  return null;
}

// ── Tractate regexes ──────────────────────────────────────────────────────────

const tractateKeys = Object.keys(TRACTATE_MAP).sort((a, b) => b.length - a.length);
const TRAC_ALT = tractateKeys.map(escapeRegex).join("|");

// Chapter patterns (abbreviated and word-form, including פרק קמא)
const ABBREV_CH = `[בסרל]?פ['"""׳״][א-תק]+`;
const WORD_CH   = `ב?פרק\\s+(?:[א-ת]+[׳]?|קמא)`;
const CHAPTER   = `(?:${ABBREV_CH}|${WORD_CH})`;

const DAF = "[א-ת\\d]{1,3}";

// Pattern A: Chapter + ד + tractate  (פ"ב דחלה / בפרק ב׳ דחלה / פרק קמא דקידושין)
const RE_CH_TRAC = new RegExp(`(${CHAPTER})\\s*ד(${TRAC_ALT})`, "g");

// Pattern B: Tractate + daf + amud  (ברכות כב. / קידושין נו:)
const RE_TRAC_DAF = new RegExp(`(${TRAC_ALT})\\s+(${DAF})[.:]`, "g");

// Pattern C: Bare ד + tractate  (דחלה, דקידושין)
const RE_D_TRAC = new RegExp(`ד(${TRAC_ALT})`, "g");

// Pattern D: "מסכת <tractate>"
const RE_MASECHET = new RegExp(`מסכת\\s*(${TRAC_ALT})`, "g");

// Mishna abbreviation: מ"ג / מ׳ג
const RE_MISH = /מ['"""׳״]([א-ת])/g;
// Halacha abbreviation: ה"א
const RE_HAL  = /ה['"""׳״]([א-ת])/g;
// Yerushalmi marker
const RE_YER  = /ירוש(?:למי)?['׳]?/;

// ── Rambam regexes ────────────────────────────────────────────────────────────

// Normalize common alternate spellings before matching
const RAMBAM_SPELLING: [RegExp, string][] = [
  [/ביכורים/g, "בכורים"],
];

function normalizeRambam(text: string): string {
  let out = text;
  for (const [from, to] of RAMBAM_SPELLING) out = out.replace(from, to);
  return out;
}

// Build alternation from RAMBAM_MAP keys, longest first to avoid partial matches
const RAMBAM_HILKHOT_ALT = Object.keys(RAMBAM_MAP)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join("|");

// Optional author mention (רמב"ם / הרמב"ם) followed by optional ב + "הלכות section"
const RE_RAMBAM = new RegExp(
  `(?:ה?רמב['"""׳״]ם[\\s,]*)?ב?(${RAMBAM_HILKHOT_ALT})`
);

// Halacha: ה"א or "הלכה א"
const RE_HAL_RAMBAM = /(?:ה['"""׳״]([א-ת])|הלכה\s+([א-ת]{1,3}[׳]?))/;

// Bare author mention: רמב"ם / הרמב"ם (with or without ה הידיעה)
const RE_RAMBAM_BARE = /ה?רמב['"""׳״]ם/;

// ── Sifri regexes ─────────────────────────────────────────────────────────────

// Piska: number or Hebrew numeral
const PISKA_PAT = `(?:\\d+|[א-ת]{1,3}['"""׳״]?)`;
// Detect ספרי with optional book
const RE_SIFRI = new RegExp(
  `ספרי\\s*(?:(במדבר|דברים))?(?:[^א-ת]*(?:פיסקא|פסקא|פ['"""׳״])\\s*(${PISKA_PAT}))?`,
  "i"
);

// ── Tanakh ────────────────────────────────────────────────────────────────────

const ALL_TANAKH: TanakhBook[] = [...TORAH_BOOKS, ...NEVIIM_BOOKS, ...KETUVIM_BOOKS];
// Sort longest first to avoid partial matches (e.g. "שמואל א" before "שמואל")
const TANAKH_SORTED = ALL_TANAKH.slice().sort((a, b) => b.he.length - a.he.length);
const TANAKH_ALT = TANAKH_SORTED.map((b) => escapeRegex(b.he)).join("|");

// Parsha names (Torah)
const PARSHA_NAMES = [
  "בראשית","נח","לך לך","וירא","חיי שרה","תולדות","ויצא","וישלח","וישב","מקץ","ויגש","ויחי",
  "שמות","וארא","בא","בשלח","יתרו","משפטים","תרומה","תצוה","כי תשא","ויקהל","פקודי",
  "ויקרא","צו","שמיני","תזריע","מצורע","אחרי מות","קדושים","אמור","בהר","בחקותי",
  "במדבר","נשא","בהעלתך","שלח","קרח","חוקת","בלק","פנחס","מטות","מסעי",
  "דברים","ואתחנן","עקב","ראה","שופטים","כי תצא","כי תבוא","נצבים","וילך","האזינו","וזאת הברכה",
];
const PARSHA_ALT = PARSHA_NAMES.slice().sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
const RE_PARSHA = new RegExp(`(?:פרשת|פ'|בפ')\\s*(${PARSHA_ALT})`, "g");

// Verse: "chapter:verse" or "פרק X פסוק Y"
// (?<![א-ת]) prevents matching book names that appear mid-word (e.g. "רות" inside "בכורות")
const RE_TANAKH_REF = new RegExp(
  `(?<![א-ת])(${TANAKH_ALT})\\s+(?:פרק\\s+)?([א-ת]{1,3}[׳״]?|\\d+)(?:[,:.][\\s]*([א-ת]{1,3}[׳״]?|\\d+))?`,
  "g"
);

// ── Main detector ─────────────────────────────────────────────────────────────

export function detectSourceFromText(rawText: string): DetectedRef | null {
  const text = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // ── 0. Rambam (checked first — "הלכות X" is unambiguous) ─────────────────
  const normText = normalizeRambam(text);
  const rambamM = RE_RAMBAM.exec(normText);
  if (rambamM) {
    const hilkhotHe = rambamM[1];
    const sefRef = RAMBAM_MAP[hilkhotHe];
    if (sefRef) {
      const after = normText.slice(rambamM.index + rambamM[0].length);
      const chapter = extractChapter(after) ?? undefined;
      const halM = RE_HAL_RAMBAM.exec(after);
      const halacha = halM ? (parseHebLetter(halM[1] ?? halM[2]) ?? undefined) : undefined;
      return { type: "rambam", hilkhotHe, sefRef, chapter, halacha };
    }
  }
  // Bare author mention — "הרמב"ם" / "רמב"ם" without a hilkhot section
  if (RE_RAMBAM_BARE.test(normText)) {
    return { type: "rambam" };
  }

  // ── 1. ספרי ──────────────────────────────────────────────────────────────
  const sifriM = RE_SIFRI.exec(text);
  if (sifriM) {
    const bookHe = sifriM[1] as "במדבר" | "דברים" | undefined;
    const sifriBook: "Bamidbar" | "Devarim" = bookHe === "דברים" ? "Devarim" : "Bamidbar";
    const piskaStr = sifriM[2]?.replace(/[׳״'"]/g, "").trim();
    const piska = piskaStr
      ? /^\d+$/.test(piskaStr) ? parseInt(piskaStr) : (fromHebrewNumeral(piskaStr) ?? undefined)
      : undefined;
    return { type: "sifri", sifriBook, piska };
  }

  // ── 2. Torah parsha ───────────────────────────────────────────────────────
  RE_PARSHA.lastIndex = 0;
  const parshaM = RE_PARSHA.exec(text);
  if (parshaM) {
    // Find which Torah book the parsha belongs to
    const parsha = parshaM[1];
    const torahBooks = ["בראשית","שמות","ויקרא","במדבר","דברים"] as const;
    const torahParshiyot: Record<string, string> = {
      "בראשית":"בראשית","נח":"בראשית","לך לך":"בראשית","וירא":"בראשית","חיי שרה":"בראשית",
      "תולדות":"בראשית","ויצא":"בראשית","וישלח":"בראשית","וישב":"בראשית","מקץ":"בראשית",
      "ויגש":"בראשית","ויחי":"בראשית",
      "שמות":"שמות","וארא":"שמות","בא":"שמות","בשלח":"שמות","יתרו":"שמות","משפטים":"שמות",
      "תרומה":"שמות","תצוה":"שמות","כי תשא":"שמות","ויקהל":"שמות","פקודי":"שמות",
      "ויקרא":"ויקרא","צו":"ויקרא","שמיני":"ויקרא","תזריע":"ויקרא","מצורע":"ויקרא",
      "אחרי מות":"ויקרא","קדושים":"ויקרא","אמור":"ויקרא","בהר":"ויקרא","בחקותי":"ויקרא",
      "במדבר":"במדבר","נשא":"במדבר","בהעלתך":"במדבר","שלח":"במדבר","קרח":"במדבר",
      "חוקת":"במדבר","בלק":"במדבר","פנחס":"במדבר","מטות":"במדבר","מסעי":"במדבר",
      "דברים":"דברים","ואתחנן":"דברים","עקב":"דברים","ראה":"דברים","שופטים":"דברים",
      "כי תצא":"דברים","כי תבוא":"דברים","נצבים":"דברים","וילך":"דברים","האזינו":"דברים",
      "וזאת הברכה":"דברים",
    };
    void torahBooks; // suppress lint
    const bookHe = torahParshiyot[parsha];
    const book = TORAH_BOOKS.find((b) => b.he === bookHe);
    if (book) return { type: "tanakh", book };
  }

  // ── 3. Talmud tractate patterns (checked before Tanakh to avoid mis-matching
  //    tractate names that contain Tanakh book names, e.g. "בכורות" ⊃ "רות") ──

  const isYerushalmi = RE_YER.test(text);

  function typeFor(tractateHe: string): "gemara" | "mishna" | "yerushalmi" {
    if (isYerushalmi) return "yerushalmi";
    if (MISHNAH_ONLY_TRACTATES.has(tractateHe)) return "mishna";
    return "gemara";
  }

  function subNumbers(sub: string): { mishna?: number; halacha?: number } {
    RE_MISH.lastIndex = 0;
    const misM = RE_MISH.exec(sub);
    const mishna = misM ? (parseHebLetter(misM[1]) ?? undefined) : undefined;
    RE_HAL.lastIndex = 0;
    const halM = RE_HAL.exec(sub);
    const halacha = halM ? (parseHebLetter(halM[1]) ?? undefined) : undefined;
    return { mishna, halacha };
  }

  // 3a. Chapter + ד + tractate
  RE_CH_TRAC.lastIndex = 0;
  const m1 = RE_CH_TRAC.exec(text);
  if (m1) {
    const tractateHe = m1[2];
    const tractateEn = TRACTATE_MAP[tractateHe];
    if (tractateEn) {
      const chapter = extractChapter(m1[1]) ?? undefined;
      const after = text.slice(m1.index + m1[0].length);
      // Also detect daf in brackets: [כה.] [כה:] (כה.) etc. — e.g. "פ"ב דכתובות [כה.]"
      const bracketDafM = after.match(/[\[(]\s*([א-ת\d]{1,3})\s*([.:])[\])]?/);
      let daf: number | undefined;
      let bracketAmud: "a" | "b" | undefined;
      if (bracketDafM) {
        const dafStr = bracketDafM[1].replace(/[׳״'"]/g, "");
        daf = /^\d+$/.test(dafStr) ? parseInt(dafStr) : (fromHebrewNumeral(dafStr) ?? undefined);
        bracketAmud = bracketDafM[2] === "." ? "a" : "b";
      }
      return { type: typeFor(tractateHe), tractateHe, tractateEn, chapter, daf, amud: bracketAmud, ...subNumbers(after) };
    }
  }

  // 3b. Tractate + daf + amud
  RE_TRAC_DAF.lastIndex = 0;
  const m2 = RE_TRAC_DAF.exec(text);
  if (m2) {
    const tractateHe = m2[1];
    const tractateEn = TRACTATE_MAP[tractateHe];
    const dafStr = m2[2].replace(/[׳״'"]/g, "");
    const daf = /^\d+$/.test(dafStr) ? parseInt(dafStr) : (fromHebrewNumeral(dafStr) ?? undefined);
    const amud: "a" | "b" = m2[0].endsWith(":") ? "b" : "a";
    if (tractateEn && daf) {
      return { type: typeFor(tractateHe), tractateHe, tractateEn, daf, amud };
    }
  }

  // 3c. Bare ד + tractate
  RE_D_TRAC.lastIndex = 0;
  const m3 = RE_D_TRAC.exec(text);
  if (m3) {
    const tractateHe = m3[1];
    const tractateEn = TRACTATE_MAP[tractateHe];
    if (tractateEn) {
      const before = text.slice(0, m3.index);
      const after  = text.slice(m3.index + m3[0].length);
      const chRe = new RegExp(CHAPTER, "g");
      let lastCh: RegExpMatchArray | null = null, mc: RegExpMatchArray | null;
      while ((mc = chRe.exec(before)) !== null) lastCh = mc;
      const chapter = lastCh ? (extractChapter(lastCh[0]) ?? undefined) : undefined;
      return { type: typeFor(tractateHe), tractateHe, tractateEn, chapter, ...subNumbers(after) };
    }
  }

  // 3d. "מסכת <tractate>"
  RE_MASECHET.lastIndex = 0;
  const m4 = RE_MASECHET.exec(text);
  if (m4) {
    const tractateHe = m4[1];
    const tractateEn = TRACTATE_MAP[tractateHe];
    if (tractateEn) {
      return { type: typeFor(tractateHe), tractateHe, tractateEn };
    }
  }

  // ── 4. Tanakh book + chapter/verse ───────────────────────────────────────
  RE_TANAKH_REF.lastIndex = 0;
  const tanakhM = RE_TANAKH_REF.exec(text);
  if (tanakhM) {
    const bookHe = tanakhM[1];
    const book = TANAKH_SORTED.find((b) => b.he === bookHe);
    if (book) {
      const chapter = parseHebLetter(tanakhM[2]) ?? undefined;
      const verse = tanakhM[3] ? (parseHebLetter(tanakhM[3]) ?? undefined) : undefined;
      return { type: "tanakh", book, chapter, verse };
    }
  }

  return null;
}
