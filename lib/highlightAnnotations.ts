import type { Annotation } from "./types";

export function highlightAnnotations(
  html: string,
  annotations: Annotation[],
  sourceKey: string,
  sectionIndex?: number
): string {
  const relevant = annotations.filter(
    (a) =>
      a.sourceKey === sourceKey &&
      a.highlightText &&
      (sectionIndex === undefined || a.sectionIndex === sectionIndex)
  );

  let result = html;
  for (const ann of relevant) {
    const ht = ann.highlightText!;
    const escaped = ht.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(escaped, "g"),
      `<mark data-annotation-id="${ann.id}" class="bg-yellow-200 rounded px-0.5 cursor-pointer hover:bg-yellow-300 transition-colors">${ht}</mark>`
    );
  }
  return result;
}
