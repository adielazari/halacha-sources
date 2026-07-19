import { toHebrewNumeral } from "./hebrewNumerals";

export type MidrashUnit = { key: string; he: string };

/**
 * Every midrash family reduces to one of these Sefaria division schemes,
 * confirmed live against Sefaria's /api/v2/index/<title> for each text:
 *  - "flat": one or more books, each with its own ref base, then a numeric
 *    unit (unit2 optional) — e.g. ספרי (book + פיסקא), מדרש רבה (book +
 *    פרק + פסקא), ילקוט שמעוני (single "book" + רמז + פסקא).
 *  - "parasha": one shared ref base, a parasha-name segment, then a single
 *    numeric unit — מדרש תנחומא (פרשה + סימן).
 *  - "tractate": one shared ref base, a tractate-name segment, then a
 *    numeric unit (unit2 optional) — מכילתא דרבי ישמעאל (מסכתא + פרק + פסקא).
 */
export type MidrashScheme =
  | { kind: "flat"; books: MidrashUnit[]; unit1Label: string; unit2Label?: string }
  | { kind: "parasha"; refBase: string; unit1Label: string; parshiyot: MidrashUnit[] }
  | { kind: "tractate"; refBase: string; unit1Label: string; unit2Label?: string; tractates: MidrashUnit[] };

export type MidrashFamilyId = "sifrei" | "rabbah" | "tanchuma" | "mechilta" | "yalkut" | "freeref";

export type MidrashFamily = { id: MidrashFamilyId; label: string; scheme: MidrashScheme };

// Full 54-parasha node list, exact He/En titles pulled from Sefaria's
// Midrash Tanchuma schema (matches the ref segment Sefaria expects verbatim).
const TANCHUMA_PARSHIYOT: MidrashUnit[] = [
  { key: "Bereshit", he: "בראשית" }, { key: "Noach", he: "נח" },
  { key: "Lech Lecha", he: "לך לך" }, { key: "Vayera", he: "וירא" },
  { key: "Chayei Sara", he: "חיי שרה" }, { key: "Toldot", he: "תולדות" },
  { key: "Vayetzei", he: "ויצא" }, { key: "Vayishlach", he: "וישלח" },
  { key: "Vayeshev", he: "וישב" }, { key: "Miketz", he: "מקץ" },
  { key: "Vayigash", he: "ויגש" }, { key: "Vayechi", he: "ויחי" },
  { key: "Shemot", he: "שמות" }, { key: "Vaera", he: "וארא" },
  { key: "Bo", he: "בא" }, { key: "Beshalach", he: "בשלח" },
  { key: "Yitro", he: "יתרו" }, { key: "Mishpatim", he: "משפטים" },
  { key: "Terumah", he: "תרומה" }, { key: "Tetzaveh", he: "תצוה" },
  { key: "Ki Tisa", he: "כי תשא" }, { key: "Vayakhel", he: "ויקהל" },
  { key: "Pekudei", he: "פקודי" }, { key: "Vayikra", he: "ויקרא" },
  { key: "Tzav", he: "צו" }, { key: "Shmini", he: "שמיני" },
  { key: "Tazria", he: "תזריע" }, { key: "Metzora", he: "מצורע" },
  { key: "Achrei Mot", he: "אחרי מות" }, { key: "Kedoshim", he: "קדושים" },
  { key: "Emor", he: "אמור" }, { key: "Behar", he: "בהר" },
  { key: "Bechukotai", he: "בחוקתי" }, { key: "Bamidbar", he: "במדבר" },
  { key: "Nasso", he: "נשא" }, { key: "Beha'alotcha", he: "בהעלותך" },
  { key: "Sh'lach", he: "שלח" }, { key: "Korach", he: "קרח" },
  { key: "Chukat", he: "חקת" }, { key: "Balak", he: "בלק" },
  { key: "Pinchas", he: "פנחס" }, { key: "Matot", he: "מטות" },
  { key: "Masei", he: "מסעי" }, { key: "Devarim", he: "דברים" },
  { key: "Vaetchanan", he: "ואתחנן" }, { key: "Eikev", he: "עקב" },
  { key: "Re'eh", he: "ראה" }, { key: "Shoftim", he: "שופטים" },
  { key: "Ki Teitzei", he: "כי תצא" }, { key: "Ki Tavo", he: "כי תבוא" },
  { key: "Nitzavim", he: "נצבים" }, { key: "Vayeilech", he: "וילך" },
  { key: "Ha'Azinu", he: "האזינו" }, { key: "V'Zot HaBerachah", he: "וזאת הברכה" },
];

const MECHILTA_TRACTATES: MidrashUnit[] = [
  { key: "Tractate Pischa", he: "מסכתא דפסחא" },
  { key: "Tractate Vayehi Beshalach", he: "מסכתא דויהי בשלח" },
  { key: "Tractate Shirah", he: "מסכתא דשירה" },
  { key: "Tractate Vayassa", he: "מסכתא דויסע" },
  { key: "Tractate Amalek", he: "מסכתא דעמלק" },
  { key: "Tractate Bachodesh", he: "מסכתא דבחדש" },
  { key: "Tractate Nezikin", he: "מסכתא דנזיקין" },
  { key: "Tractate Kaspa", he: "מסכתא דכספא" },
  { key: "Tractate Shabbata", he: "מסכתא דשבתא" },
];

export const MIDRASH_FAMILIES: Record<Exclude<MidrashFamilyId, "freeref">, MidrashFamily> = {
  sifrei: {
    id: "sifrei",
    label: "ספרי",
    scheme: {
      kind: "flat",
      unit1Label: "פיסקא",
      books: [
        { key: "Sifrei_Bamidbar", he: "במדבר" },
        { key: "Sifrei_Devarim", he: "דברים" },
      ],
    },
  },
  rabbah: {
    id: "rabbah",
    label: "מדרש רבה",
    scheme: {
      kind: "flat",
      unit1Label: "פרק",
      unit2Label: "פסקא",
      books: [
        { key: "Genesis Rabbah", he: "בראשית רבה" },
        { key: "Exodus Rabbah", he: "שמות רבה" },
        { key: "Leviticus Rabbah", he: "ויקרא רבה" },
        { key: "Numbers Rabbah", he: "במדבר רבה" },
        { key: "Deuteronomy Rabbah", he: "דברים רבה" },
      ],
    },
  },
  tanchuma: {
    id: "tanchuma",
    label: "מדרש תנחומא",
    scheme: {
      kind: "parasha",
      refBase: "Midrash Tanchuma",
      unit1Label: "סימן",
      parshiyot: TANCHUMA_PARSHIYOT,
    },
  },
  mechilta: {
    id: "mechilta",
    label: 'מכילתא דרבי ישמעאל',
    scheme: {
      kind: "tractate",
      refBase: "Mekhilta d'Rabbi Yishmael",
      unit1Label: "פרק",
      unit2Label: "פסקא",
      tractates: MECHILTA_TRACTATES,
    },
  },
  yalkut: {
    id: "yalkut",
    label: "ילקוט שמעוני (על התורה)",
    scheme: {
      kind: "flat",
      unit1Label: "רמז",
      unit2Label: "פסקא",
      books: [{ key: "Yalkut Shimoni on Torah", he: "" }],
    },
  },
};

function heNum(n: number): string {
  return toHebrewNumeral(n).replace(/[׳״]/g, "");
}

/** Whether this family's scheme has a second numeric level (chapter+paragraph vs. a single unit). */
export function midrashHasUnit2(family: MidrashFamily): boolean {
  return family.scheme.kind !== "parasha" && !!family.scheme.unit2Label;
}

/** Builds the Sefaria ref for a given family/book/unit combination. */
export function midrashRef(scheme: MidrashScheme, bookKey: string | undefined, unit1: number, unit2?: number): string {
  if (scheme.kind === "flat") {
    const book = scheme.books.find((b) => b.key === bookKey) ?? scheme.books[0];
    return unit2 ? `${book.key}.${unit1}.${unit2}` : `${book.key}.${unit1}`;
  }
  if (scheme.kind === "parasha") {
    const p = scheme.parshiyot.find((x) => x.key === bookKey);
    return `${scheme.refBase}, ${p?.key ?? bookKey}.${unit1}`;
  }
  const t = scheme.tractates.find((x) => x.key === bookKey);
  const base = `${scheme.refBase}, ${t?.key ?? bookKey}`;
  return unit2 ? `${base}.${unit1}.${unit2}` : `${base}.${unit1}`;
}

/** Builds the Hebrew display label for a given family/book/unit combination. */
export function midrashLabel(
  familyLabel: string,
  scheme: MidrashScheme,
  bookKey: string | undefined,
  unit1: number,
  unit2?: number
): string {
  if (unit1 <= 0) return "";
  if (scheme.kind === "flat") {
    const book = scheme.books.find((b) => b.key === bookKey);
    const bookPart = book?.he ? `${book.he} ` : "";
    const base = `${familyLabel} ${bookPart}${scheme.unit1Label} ${heNum(unit1)}`;
    return unit2 && scheme.unit2Label ? `${base} ${scheme.unit2Label} ${heNum(unit2)}` : base;
  }
  if (scheme.kind === "parasha") {
    const p = scheme.parshiyot.find((x) => x.key === bookKey);
    return `${familyLabel} ${p?.he ?? ""} ${scheme.unit1Label} ${heNum(unit1)}`;
  }
  const t = scheme.tractates.find((x) => x.key === bookKey);
  const base = `${familyLabel} ${t?.he ?? ""} ${scheme.unit1Label} ${heNum(unit1)}`;
  return unit2 && scheme.unit2Label ? `${base} ${scheme.unit2Label} ${heNum(unit2)}` : base;
}
