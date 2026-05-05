/**
 * Rishonim and Aharonim on Talmud — Sefaria ref templates and nav modes.
 *
 * refTemplate: use "{tractate}" as a placeholder for the Sefaria tractate key.
 *   - "daf" mode: ref = refTemplate.replace("{tractate}", tractateEn) + ".{daf}[ab]"
 *     e.g. Rashi_on_Berakhot.2a
 *   - "chapter" mode: ref = refTemplate.replace("{tractate}", tractateEn) + ".{ch}"
 *     e.g. Meiri_on_Berakhot.1 / Rif_Berakhot.1
 */

export type RishonNavMode = "daf" | "chapter";
export type RishonCategory = "rishon" | "aharon";

export type RishonEntry = {
  hebrewName: string;
  refTemplate: string;
  navMode: RishonNavMode;
  category: RishonCategory;
};

export const RISHON_MAP: Record<string, RishonEntry> = {
  // ── ראשונים ────────────────────────────────────────────────────────────────
  rashi: {
    hebrewName: 'רש"י',
    refTemplate: "Rashi_on_{tractate}",
    navMode: "daf",
    category: "rishon",
  },
  tosafot: {
    hebrewName: "תוספות",
    refTemplate: "Tosafot_on_{tractate}",
    navMode: "daf",
    category: "rishon",
  },
  rashba: {
    hebrewName: 'רשב"א',
    refTemplate: "Rashba_on_{tractate}",
    navMode: "daf",
    category: "rishon",
  },
  ritva: {
    hebrewName: 'ריטב"א',
    refTemplate: "Ritva_on_{tractate}",
    navMode: "daf",
    category: "rishon",
  },
  ramban: {
    hebrewName: 'רמב"ן',
    refTemplate: "Chiddushei_Ramban_on_{tractate}",
    navMode: "daf",
    category: "rishon",
  },
  r_chananel: {
    hebrewName: "רבינו חננאל",
    refTemplate: "Rabbeinu_Chananel_on_{tractate}",
    navMode: "daf",
    category: "rishon",
  },
  rif: {
    hebrewName: 'רי"ף',
    refTemplate: "Rif_{tractate}",
    navMode: "chapter",
    category: "rishon",
  },
  meiri: {
    hebrewName: "מאירי",
    refTemplate: "Meiri_on_{tractate}",
    navMode: "chapter",
    category: "rishon",
  },
  rosh: {
    hebrewName: 'רא"ש',
    refTemplate: "Piskei_HaRosh_on_{tractate}",
    navMode: "chapter",
    category: "rishon",
  },
  ran: {
    hebrewName: 'ר"ן',
    refTemplate: "Ran_on_{tractate}",
    navMode: "chapter",
    category: "rishon",
  },
  mordechai: {
    hebrewName: "מרדכי",
    refTemplate: "Mordechai_on_{tractate}",
    navMode: "chapter",
    category: "rishon",
  },
  nimukei_yosef: {
    hebrewName: "נמוקי יוסף",
    refTemplate: "Nimukei_Yosef_on_{tractate}",
    navMode: "chapter",
    category: "rishon",
  },
  rashbam: {
    hebrewName: 'רשב"ם',
    refTemplate: "Rashbam_on_{tractate}",
    navMode: "chapter",
    category: "rishon",
  },
  // ── אחרונים ────────────────────────────────────────────────────────────────
  pnei_yehoshua: {
    hebrewName: "פני יהושע",
    refTemplate: "Penei_Yehoshua_on_{tractate}",
    navMode: "daf",
    category: "aharon",
  },
  r_akiva_eiger: {
    hebrewName: 'ר"ע איגר',
    refTemplate: "Chiddushei_Rabbi_Akiva_Eiger_on_{tractate}",
    navMode: "daf",
    category: "aharon",
  },
  rashash: {
    hebrewName: 'רש"ש',
    refTemplate: "Rashash_on_{tractate}",
    navMode: "daf",
    category: "aharon",
  },
  gilyon_hashas: {
    hebrewName: 'גליון הש"ס',
    refTemplate: "Gilyon_HaShas_on_{tractate}",
    navMode: "daf",
    category: "aharon",
  },
  maharam_schiff: {
    hebrewName: 'מהר"ם שיף',
    refTemplate: "Maharam_Schiff_on_{tractate}",
    navMode: "daf",
    category: "aharon",
  },
  maharsha_agadot: {
    hebrewName: 'מהרש"א (אגדות)',
    refTemplate: "Chidushei_Agadot_on_{tractate}",
    navMode: "daf",
    category: "aharon",
  },
  maharsha_halachot: {
    hebrewName: 'מהרש"א (הלכות)',
    refTemplate: "Chidushei_Halachot_on_{tractate}",
    navMode: "daf",
    category: "aharon",
  },
  chochmat_shlomo: {
    hebrewName: "חכמת שלמה",
    refTemplate: "Chokhmat_Shlomo_on_{tractate}",
    navMode: "daf",
    category: "aharon",
  },
  shita_mekubetzet: {
    hebrewName: "שיטה מקובצת",
    refTemplate: "Shita_Mekubetzet_on_{tractate}",
    navMode: "daf",
    category: "aharon",
  },
  chatam_sofer: {
    hebrewName: "חתם סופר",
    refTemplate: "Chidushei_Chatam_Sofer_on_{tractate}",
    navMode: "daf",
    category: "aharon",
  },
};

export const RISHONIM_ENTRIES = Object.entries(RISHON_MAP)
  .filter(([, v]) => v.category === "rishon")
  .map(([key, val]) => ({ key, ...val }));

export const AHARONIM_ENTRIES = Object.entries(RISHON_MAP)
  .filter(([, v]) => v.category === "aharon")
  .map(([key, val]) => ({ key, ...val }));

export function buildRishonRef(rishonKey: string, tractateEn: string, dafOrCh: number, amud?: "a" | "b"): string {
  const entry = RISHON_MAP[rishonKey];
  if (!entry) return "";
  const base = entry.refTemplate.replace("{tractate}", tractateEn);
  if (entry.navMode === "daf") {
    const suffix = amud ?? "a";
    return `${base}.${dafOrCh}${suffix}`;
  }
  return `${base}.${dafOrCh}`;
}
