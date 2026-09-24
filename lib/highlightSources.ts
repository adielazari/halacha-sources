import type { Excerpt } from "./types";

// Marks, inside a panel's HTML, the snippets the user pulled into the
// document. The document is the single source of truth: an excerpt with a
// `highlightText` (the panel text originally selected) is highlighted in the
// panel it came from; removing the excerpt removes the highlight.
export function highlightSources(
  html: string,
  excerpts: Excerpt[],
  sourceKey: string,
  sectionIndex?: number
): string {
  const relevant = excerpts.filter(
    (ex) =>
      ex.sourceKey === sourceKey &&
      ex.highlightText &&
      (sectionIndex === undefined || ex.sectionIndex === sectionIndex)
  );

  let result = html;
  for (const ex of relevant) {
    const ht = ex.highlightText!;
    const escaped = ht.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const title = ex.sourceLabel.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    result = result.replace(
      new RegExp(escaped, "g"),
      `<mark data-excerpt-id="${ex.id}" title="${title}" class="bg-yellow-200 rounded px-0.5 cursor-pointer hover:bg-yellow-300 transition-colors">${ht}</mark>`
    );
  }
  return result;
}
