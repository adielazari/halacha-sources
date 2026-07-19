import type { Excerpt } from "./types";
import { buildGroupHeading } from "./sourceLabels";

export type ExcerptBlock =
  | { kind: "single"; item: Excerpt }
  | { kind: "group"; sourceKey: string; sectionIndex: number; heading: string; items: Excerpt[] };

/**
 * Groups consecutive "source" excerpts pulled from the same panel section
 * (same sourceKey + sectionIndex) under one shared origin heading — e.g. two
 * sources pulled from "בית יוסף אות ה'" are shown together under that label
 * instead of as two unrelated entries.
 */
export function groupExcerpts(excerpts: Excerpt[]): ExcerptBlock[] {
  const blocks: ExcerptBlock[] = [];
  let i = 0;
  while (i < excerpts.length) {
    const ex = excerpts[i];
    const itemType = ex.type ?? "source";

    if (itemType === "source" && ex.sectionIndex !== undefined) {
      let j = i + 1;
      while (
        j < excerpts.length &&
        (excerpts[j].type ?? "source") === "source" &&
        excerpts[j].sourceKey === ex.sourceKey &&
        excerpts[j].sectionIndex === ex.sectionIndex
      ) {
        j++;
      }
      const items = excerpts.slice(i, j);
      // Always show the origin-section heading (even for a lone item) so it's
      // clear where every source was pulled from, not just when 2+ share a section.
      blocks.push({
        kind: "group",
        sourceKey: ex.sourceKey,
        sectionIndex: ex.sectionIndex,
        heading: buildGroupHeading(ex.sourceKey, ex.sectionIndex),
        items,
      });
      i = j;
    } else {
      blocks.push({ kind: "single", item: ex });
      i++;
    }
  }
  return blocks;
}
