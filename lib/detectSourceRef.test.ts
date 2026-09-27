import { describe, it, expect } from "vitest";
import { detectSourceFromText } from "./detectSourceRef";

// Golden-set regression tests (docs/plan/2026-09-23-redesign-plan.md §4.1):
// snapshot the CURRENT, working behavior of the single-snippet detector so a
// future regex change can't silently regress it. Cases are drawn from real
// sources pulled into OC siman 1's document, plus git-log bug fixes to this
// file (see commit messages referenced per case).
describe("detectSourceFromText — golden set", () => {
  const cases: Record<string, string> = {
    // Real, currently-working OC siman 1 pulls (sourceRef confirmed in the live DB).
    "gemara — ברכות דף כח:": "ברכות דף כח:",
    "gemara — ברכות דף ג.": "ברכות דף ג.",
    "gemara — תמיד דף לב:": "תמיד דף לב:",
    "gemara — תענית דף כז:": "תענית דף כז:",
    "gemara — מגילה דף לא:": "מגילה דף לא:",
    "gemara — מנחות דף קי.": "מנחות דף קי.",
    "gemara — כריתות דף כה.": "כריתות דף כה.",
    "gemara — נדרים דף י.": "נדרים דף י.",

    // aec4f32 — "רות" must not match mid-word inside "בכורות".
    "tractate name containing a Tanakh book substring (בכורות ⊃ רות)": "בכורות כז.",
    // aec4f32 — multi-char Hebrew numeral (כז = 27), not just a single letter.
    "multi-char Hebrew numeral verse ref": "תהלים כז א",

    // 6e770af / f1107dc / cd9a953 — Rambam detection variants.
    "rambam — bare mention, no hilchot section": "כתב הרמב\"ם וכן נהגו",
    "rambam — hilchot section with chapter": "הרמב\"ם בפ\"ה מהלכות בכורים",
    "rambam — alternate spelling ביכורים normalizes to בכורים": "הרמב\"ם פ\"ה מביכורים",
    "rambam — מהל' abbreviation": "רמב\"ם פ\"א מהל' תפילה",
    "rambam — ר\"פ chapter-first form": "ר\"פ ה' מהל' בכורים",

    // Yerushalmi vs Bavli disambiguation.
    "yerushalmi marker changes type": "ירושלמי פ\"ק דברכות",

    // Tanakh chapter:verse.
    "tanakh book chapter:verse": "בראשית ב:ג",

    // No match at all.
    "plain prose with no embedded ref": "וכן המנהג פשוט בכל תפוצות ישראל",
  };

  for (const [label, text] of Object.entries(cases)) {
    it(label, () => {
      expect(detectSourceFromText(text)).toMatchSnapshot();
    });
  }
});
