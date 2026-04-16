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
  "תוס'": { sefariaBook: "Tosafot_on_{tractate}", requiresTractate: true },
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
  // Mishnaic / Yerushalmi tractates (no Bavli)
  'ערלה': 'Orlah',
  'כלאים': 'Kilayim',
  'שביעית': 'Sheviit',
  'תרומות': 'Terumot',
  'מעשרות': 'Maasrot',
  'מעשר שני': 'Maaser_Sheni',
  'חלה': 'Challah',
  'בכורים': 'Bikkurim',
  'פאה': 'Peah',
  'דמאי': 'Demai',
  'תמיד': 'Tamid',
  'מדות': 'Middot',
  'קינים': 'Kinnim',
  'עוקצין': 'Oktzin',
  'מקואות': 'Mikvot',
  'אהלות': 'Oholot',
};

// Tractates that exist only in Mishnah/Yerushalmi (no Bavli tractate)
// When a chapter-form ref like "בפ"ק דערלה" matches one of these, it defaults to Mishnah
export const MISHNAH_ONLY_TRACTATES = new Set([
  'ערלה', 'כלאים', 'שביעית', 'תרומות', 'מעשרות', 'מעשר שני', 'חלה',
  'בכורים', 'פאה', 'דמאי', 'תמיד', 'מדות', 'קינים', 'עוקצין', 'מקואות', 'אהלות',
]);

// Yerushalmi tractate → Sefaria Jerusalem_Talmud key
export const YERUSHALMI_TRACTATE_MAP: Record<string, string> = {
  'ברכות': 'Berakhot', 'פאה': 'Peah', 'דמאי': 'Demai', 'כלאים': 'Kilayim',
  'שביעית': 'Sheviit', 'תרומות': 'Terumot', 'מעשרות': 'Maasrot',
  'מעשר שני': 'Maaser_Sheni', 'חלה': 'Challah', 'ערלה': 'Orlah',
  'בכורים': 'Bikkurim', 'שבת': 'Shabbat', 'עירובין': 'Eruvin',
  'פסחים': 'Pesachim', 'שקלים': 'Shekalim', 'יומא': 'Yoma',
  'סוכה': 'Sukkah', 'ביצה': 'Beitzah', 'ראש השנה': 'Rosh_Hashanah',
  'תענית': 'Taanit', 'מגילה': 'Megillah', 'חגיגה': 'Chagigah',
  'מועד קטן': 'Moed_Katan', 'יבמות': 'Yevamot', 'כתובות': 'Ketubot',
  'נדרים': 'Nedarim', 'נזיר': 'Nazir', 'סוטה': 'Sotah', 'גיטין': 'Gittin',
  'קידושין': 'Kiddushin', 'בבא קמא': 'Bava_Kamma', 'בבא מציעא': 'Bava_Metzia',
  'בבא בתרא': 'Bava_Batra', 'סנהדרין': 'Sanhedrin', 'שבועות': 'Shevuot',
  'עבודה זרה': 'Avodah_Zarah', 'מכות': 'Makkot', 'הוריות': 'Horayot',
};

export const CHELEK_MAP_HE: Record<string, string> = {
  'אורח חיים': 'Orach_Chayyim',
  'יורה דעה': 'Yoreh_Deah',
  'אבן העזר': 'Even_HaEzer',
  'חושן משפט': 'Choshen_Mishpat',
};

// Rambam hilchot name (Hebrew) → Sefaria Mishneh Torah section key
// Ref format: Mishneh_Torah,_Laws_of_{key}.{chapter}
// Note: exact Sefaria names need verification with the API
export const HILCHOT_MAP: Record<string, string> = {
  // ── Orach Chaim ──
  'תפילה וברכת כהנים': 'Prayer_and_the_Priestly_Blessing',
  'תפילה': 'Prayer_and_the_Priestly_Blessing',
  'קריאת שמע': 'Reading_the_Shema',
  'ברכות': 'Blessings',
  'שבת': 'Shabbat',
  'יום טוב': 'Yom_Tov',
  'חמץ ומצה': 'Leavened_and_Unleavened_Bread',
  'שופר וסוכה ולולב': 'Shofar%2C_Sukkah_and_Lulav',
  'לולב': 'Shofar%2C_Sukkah_and_Lulav',
  'סוכה': 'Shofar%2C_Sukkah_and_Lulav',
  'שופר': 'Shofar%2C_Sukkah_and_Lulav',
  'חנוכה': 'Megillah_and_Chanukah',
  'מגילה וחנוכה': 'Megillah_and_Chanukah',
  'תעניות': 'Fasts',
  // ── Yoreh Deah ──
  'מאכלות אסורות': 'Forbidden_Foods',
  'שחיטה': 'Shechita',
  'מעשר שני ונטע רבעי': 'Maaser_Sheni_and_Neta_Revai',
  "מ\"ש ונטע רבעי": 'Maaser_Sheni_and_Neta_Revai',
  'ערלה': 'Orlah',
  'בכורים ושאר מתנות כהונה': 'Firstfruits_and_other_Gifts_to_Priests_Outside_the_Sanctuary',
  'תרומות': 'Heave_Offerings',
  'מעשרות': 'Tithes',
  'מעשר שני': 'Maaser_Sheni_and_Neta_Revai',
  'שמיטה ויובל': 'Shemitah_and_Yovel',
  'נדרים': 'Vows',
  'שבועות': 'Oaths',
  // ── Even HaEzer ──
  'אישות': 'Marriage',
  'גירושין': 'Divorce',
  'יבום וחליצה': 'Levirate_Marriage_and_Release',
  // ── Choshen Mishpat ──
  'טוען ונטען': 'Claims',
  'גזילה ואבידה': 'Robbery_and_Lost_Objects',
  'נזקי ממון': 'Property_Damage',
  // ── General ──
  'תשובה': 'Repentance',
  'דעות': 'Human_Dispositions',
  'תלמוד תורה': 'Torah_Study',
};

// Maps Hebrew display names of Rishonim → Sefaria commentator prefix
// Ref format: {prefix}_on_{TractateKey}.{daf}{a/b}
export const RISHONIM_MAP: Record<string, string> = {
  'רש"י': 'Rashi',
  'רשי': 'Rashi',
  'תוספות': 'Tosafot',
  "תוס'": 'Tosafot',
  'ר"ן': 'Ran',
  'רן': 'Ran',
  'רשב"א': 'Rashba',
  'רשבא': 'Rashba',
  'ריטב"א': 'Ritva',
  'ריטבא': 'Ritva',
  'רי"ף': 'Rif',
  'ריף': 'Rif',
  'רא"ש': 'Rosh',
  'ראש': 'Rosh',
  'מרדכי': 'Mordechai',
  'נמוקי יוסף': 'Nimukei_Yosef',
  'מאירי': 'Meiri',
  'רמב"ן': 'Ramban',
  'רמבן': 'Ramban',
  'ר"ח': 'Rabbeinu_Chananel',
  'רבינו חננאל': 'Rabbeinu_Chananel',
};

// Sorted entries arrays for dropdown population
export const TRACTATE_ENTRIES: { label: string; value: string }[] =
  Object.entries(TRACTATE_MAP)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, 'he'));

export const HILCHOT_ENTRIES: { label: string; value: string }[] =
  Object.entries(HILCHOT_MAP)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, 'he'));

export const RISHONIM_ENTRIES: { label: string; value: string }[] =
  Object.entries(RISHONIM_MAP)
    .filter(([label], i, arr) => arr.findIndex(([, v]) => v === RISHONIM_MAP[label]) === i)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, 'he'));

// Abbreviations used in Beit Yosef for Rambam sections
// e.g. "בפ"י מהמ"א" = "בפרק י׳ מהלכות מאכלות אסורות"
export const RAMBAM_ABBREV_MAP: Record<string, string> = {
  'מהמ"א': 'Forbidden_Foods',
  "מהמ'א": 'Forbidden_Foods',
  'מה"ש': 'Shabbat',
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
