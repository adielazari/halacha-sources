import { describe, it, expect } from "vitest";
import { parseSourcesFromSeifim } from "./parser";

// Golden-set regression tests (docs/plan/2026-09-23-redesign-plan.md §4.1):
// snapshot the CURRENT, working behavior of the whole-text scanner (used to
// find every source embedded in a Beit Yosef/Tur paragraph) so a future
// regex change can't silently regress it.
describe("parseSourcesFromSeifim — golden set", () => {
  const cases: Record<string, string> = {
    // Real, currently-working OC siman 1 pulls (sourceRef confirmed in the live DB).
    "gemara plain form": "כדאיתא בברכות ג.",
    "gemara with amud bet": "כמבואר בתמיד לב:",
    "gemara in parens": "כמבואר בגמרא (ברכות יב.)",
    "gemara in brackets": "עיין בגמרא ברכות [כח:]",

    // 7cb4bf9 — a resolved chapter+tractate+daf match (pattern 4a) must
    // absorb the shorter, unresolved chapter+tractate-only match (pattern
    // 4b) contained within it, not report both.
    "chapter+tractate+daf dedup — wider resolved match wins":
      "כדאיתא בפ\"ב דקידושין [נו:]",

    // Pattern 9 — two authors sharing one tractate+daf citation.
    "two authors + shared tractate/daf": "וכתבו הרי\"ף והרא\"ש בפירוש (יבמות דף פג:)",

    // Pattern 10/11 — Rambam + hilchot, full and abbreviated forms.
    "rambam full hilchot name": "הרמב\"ם בפ\"ט מהלכות מעשר שני ונטע רבעי",

    // Pattern 13/14 — bare author mention without a resolvable tractate.
    "author writing verb, no locatable ref": "וכתב הרא\"ש דיש להחמיר בזה",

    // No match at all.
    "plain prose with no embedded ref": "וכן המנהג פשוט בכל תפוצות ישראל",
  };

  for (const [label, text] of Object.entries(cases)) {
    it(label, () => {
      expect(parseSourcesFromSeifim([text])).toMatchSnapshot();
    });
  }
});
