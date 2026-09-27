// One entry point over the two source-identification engines (docs/plan/
// 2026-09-23-redesign-plan.md §4.1): `detectSourceFromText` (focused,
// structured — handles chapter forms, מ"X/ה"X sub-refs, Tanakh, Rambam,
// Sifri) and `parseSourcesFromSeifim` (whole-text scanner — the only one
// that knows about Rishonim/Aharonim authors via AUTHOR_MAP). They return
// different shapes for different reasons: the focused detector's structured
// fields drive SourcePullView's form controls directly, while the scanner
// finds every embedded citation in a full paragraph. Merging their matching
// logic into one engine would be a rewrite of the app's most bug-prone,
// least-tested core with no test coverage before docs/plan's golden set
// (lib/detectSourceRef.test.ts, lib/parser.test.ts) — this instead makes
// them layers of one call, matching the exact fallback SourcePullView
// already did inline.
import { detectSourceFromText, type DetectedRef } from "./detectSourceRef";
import { parseSourcesFromSeifim, type ParsedSource } from "./parser";

export type SourceDetectionResult =
  | { kind: "focused"; detected: DetectedRef }
  | { kind: "fallback"; parsed: ParsedSource }
  | { kind: "none" };

/**
 * Tries the focused single-snippet detector first; if it finds nothing, falls
 * back to the whole-text scanner and returns its first match (e.g. an author
 * citation the focused detector doesn't handle).
 */
export function detectSource(text: string): SourceDetectionResult {
  const detected = detectSourceFromText(text);
  if (detected) return { kind: "focused", detected };

  const [parsed] = parseSourcesFromSeifim([text]);
  if (parsed) return { kind: "fallback", parsed };

  return { kind: "none" };
}
