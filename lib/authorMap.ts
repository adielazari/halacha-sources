// Maps Hebrew author abbreviations / names → Sefaria book identifiers
// Some are templates where {tractate} or {chelek} must be substituted

export type AuthorEntry = {
  sefariaBook: string;
  requiresTractate?: boolean;
  requiresChelek?: boolean;
};

export const AUTHOR_MAP: Record<string, AuthorEntry> = {
  'רמב"ם': { sefariaBook: "Mishneh_Torah" },
  'רמבם': { sefariaBook: "Mishneh_Torah" },
  'רא"ש': { sefariaBook: "Rosh_on_{tractate}", requiresTractate: true },
  'ראש': { sefariaBook: "Rosh_on_{tractate}", requiresTractate: true },
  'רשב"א': { sefariaBook: "Rashba_on_{tractate}", requiresTractate: true },
  'רשבא': { sefariaBook: "Rashba_on_{tractate}", requiresTractate: true },
  'ר"ן': { sefariaBook: "Ran_on_{tractate}", requiresTractate: true },
  'רן': { sefariaBook: "Ran_on_{tractate}", requiresTractate: true },
  'טור': { sefariaBook: "Tur%2C_{chelek}", requiresChelek: true },
  'ריטב"א': { sefariaBook: "Ritva_on_{tractate}", requiresTractate: true },
  'ריטבא': { sefariaBook: "Ritva_on_{tractate}", requiresTractate: true },
  'מרדכי': { sefariaBook: "Mordechai_on_{tractate}", requiresTractate: true },
  'רי"ף': { sefariaBook: "Rif_on_{tractate}", requiresTractate: true },
  'ריף': { sefariaBook: "Rif_on_{tractate}", requiresTractate: true },
  'נמוקי יוסף': { sefariaBook: "Nimukei_Yosef_on_{tractate}", requiresTractate: true },
  'תוספות': { sefariaBook: "Tosafot_on_{tractate}", requiresTractate: true },
  'תוס\'': { sefariaBook: "Tosafot_on_{tractate}", requiresTractate: true },
  'רש"י': { sefariaBook: "Rashi_on_{tractate}", requiresTractate: true },
  'רשי': { sefariaBook: "Rashi_on_{tractate}", requiresTractate: true },
};

// Maps Talmud tractate names (Hebrew) → Sefaria tractate key
export const TRACTATE_MAP: Record<string, string> = {
  'שבת': 'Shabbat',
  'עירובין': 'Eruvin',
  'פסחים': 'Pesachim',
  'ביצה': 'Beitzah',
  'ראש השנה': 'Rosh_Hashanah',
  'יומא': 'Yoma',
  'סוכה': 'Sukkah',
  'תענית': 'Taanit',
  'מגילה': 'Megillah',
  'מועד קטן': 'Moed_Katan',
  'חגיגה': 'Chagigah',
  'יבמות': 'Yevamot',
  'כתובות': 'Ketubot',
  'נדרים': 'Nedarim',
  'נזיר': 'Nazir',
  'סוטה': 'Sotah',
  'גיטין': 'Gittin',
  'קידושין': 'Kiddushin',
  'בבא קמא': 'Bava_Kamma',
  'בבא מציעא': 'Bava_Metzia',
  'בבא בתרא': 'Bava_Batra',
  'סנהדרין': 'Sanhedrin',
  'מכות': 'Makkot',
  'שבועות': 'Shevuot',
  'עבודה זרה': 'Avodah_Zarah',
  'הוריות': 'Horayot',
  'זבחים': 'Zevachim',
  'מנחות': 'Menachot',
  'חולין': 'Chullin',
  'בכורות': 'Bekhorot',
  'ערכין': 'Arakhin',
  'תמורה': 'Temurah',
  'כריתות': 'Keritot',
  'מעילה': "Me'ilah",
  'נידה': 'Niddah',
  'ברכות': 'Berakhot',
  'שקלים': 'Shekalim',
};

export const CHELEK_MAP_HE: Record<string, string> = {
  'אורח חיים': 'Orach_Chayyim',
  'יורה דעה': 'Yoreh_Deah',
  'אבן העזר': 'Even_HaEzer',
  'חושן משפט': 'Choshen_Mishpat',
};

export function resolveAuthorRef(
  authorKey: string,
  tractate?: string,
  chelek?: string
): string | null {
  const entry = AUTHOR_MAP[authorKey];
  if (!entry) return null;

  let book = entry.sefariaBook;
  if (entry.requiresTractate && tractate) {
    const tractateKey = TRACTATE_MAP[tractate] ?? tractate;
    book = book.replace("{tractate}", tractateKey);
  } else if (entry.requiresTractate) {
    return null;
  }

  if (entry.requiresChelek && chelek) {
    const chelekKey = CHELEK_MAP_HE[chelek] ?? chelek;
    book = book.replace("{chelek}", chelekKey);
  }

  return book;
}
