import type { Excerpt } from "./types";
import { toHebrewNumeral } from "./hebrewNumerals";
import { groupExcerpts } from "./groupExcerpts";

export const CHELEK_LABELS: Record<string, string> = {
  OrachChayim: "אורח חיים",
  YorehDeah: "יורה דעה",
  EvenHaEzer: "אבן העזר",
  ChoshenMishpat: "חושן משפט",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderExcerpt(ex: Excerpt, index: number, nested = false): string {
  const itemType = ex.type ?? "source";

  if (itemType === "heading") {
    const align = ex.headingAlign ?? "right";
    const level = ex.headingLevel ?? 2;
    const sizeClass = level === 1 ? "h-lg" : level === 2 ? "h-md" : "h-sm";
    return `<div class="heading ${sizeClass}" style="text-align:${align}">${escapeHtml(ex.text)}</div>`;
  }

  if (itemType === "explanation") {
    return `<div class="explanation"><span class="label">הסבר: </span>${escapeHtml(ex.text)}</div>`;
  }

  if (itemType === "question") {
    return `<div class="question"><span class="label">שאלה: </span>${escapeHtml(ex.text)}</div>`;
  }

  if (itemType === "answer") {
    return `<div class="answer"><span class="label">תשובה: </span>${escapeHtml(ex.text)}</div>`;
  }

  if (itemType === "agentPoint") {
    return `<div class="agent-point">🤖 ${escapeHtml(ex.text)}</div>`;
  }

  if (itemType === "image") {
    const caption = ex.sourceLabel && ex.sourceLabel !== "תמונה"
      ? `<p class="image-caption">${escapeHtml(ex.sourceLabel)}</p>`
      : "";
    return ex.imageData
      ? `<div class="source-image"><img src="${ex.imageData}" alt="" />${caption}</div>`
      : "";
  }

  // source (default)
  const commentaries = ex.commentaries?.length
    ? `<div class="commentaries">${ex.commentaries
        .map(
          (c) => `
        ${!ex.sourceLabel.includes(c.heRef) ? `<p class="comm-ref">${escapeHtml(c.heRef)}</p>` : ""}
        <div class="comm-text">${c.text
          .split("\n")
          .filter(Boolean)
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join("")}</div>
      `
        )
        .join("")}</div>`
    : "";

  return `
    <div class="source${nested ? " source-nested" : ""}">
      <div class="source-head"><span class="idx">${index + 1}.</span><span class="label">${escapeHtml(ex.sourceLabel)}</span></div>
      <p class="source-text">${ex.text}</p>
      ${ex.note ? `<p class="note">${escapeHtml(ex.note)}</p>` : ""}
      ${commentaries}
    </div>
  `;
}

export function renderSimanSection(chelek: string, siman: string, excerpts: Excerpt[]): string {
  const chelekLabel = CHELEK_LABELS[chelek] ?? chelek;
  const simanLabel = toHebrewNumeral(parseInt(siman, 10));

  let sourceCounter = 0;
  const blocks = groupExcerpts(excerpts);
  const body = blocks.length
    ? blocks
        .map((block) => {
          if (block.kind === "single") {
            const isSource = (block.item.type ?? "source") === "source";
            if (isSource) sourceCounter++;
            return renderExcerpt(block.item, sourceCounter - 1);
          }
          const items = block.items
            .map((ex) => {
              sourceCounter++;
              return renderExcerpt(ex, sourceCounter - 1, true);
            })
            .join("");
          return `
            <div class="source-group">
              <div class="group-heading">${escapeHtml(block.heading)}</div>
              ${items}
            </div>
          `;
        })
        .join("")
    : `<p class="empty">לא נבחרו מקורות</p>`;

  return `
    <section class="siman-section">
      <h1>דף מקורות הלכתי</h1>
      <h2>${escapeHtml(chelekLabel)}</h2>
      <h3>סימן ${simanLabel}</h3>
      ${body}
    </section>
  `;
}

export function buildFullHtml(sections: string[]): string {
  return `<!doctype html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: "Arial", "David", sans-serif; direction: rtl; color: #1f2937; margin: 0; }
  .siman-section { max-width: 700px; margin: 0 auto; padding: 40px 32px; page-break-after: always; }
  .siman-section:last-child { page-break-after: auto; }
  h1 { font-size: 22px; font-weight: bold; text-align: center; margin: 0 0 4px; }
  h2 { font-size: 17px; text-align: center; color: #4b5563; margin: 0 0 4px; font-weight: normal; }
  h3 { font-size: 15px; text-align: center; color: #6b7280; margin: 0 0 32px; font-weight: normal; }
  .heading { font-weight: bold; margin: 10px 0; }
  .h-lg { font-size: 20px; }
  .h-md { font-size: 16px; }
  .h-sm { font-size: 14px; font-weight: 600; }
  .explanation { border-right: 4px solid #4ade80; padding-right: 12px; margin: 8px 0; font-size: 13px; font-style: italic; color: #374151; }
  .question { border-right: 4px solid #fbbf24; padding-right: 12px; margin: 8px 0; font-size: 13px; font-weight: 600; color: #1f2937; }
  .answer { border-right: 4px solid #2dd4bf; padding-right: 12px; margin: 8px 0 8px 24px; font-size: 13px; color: #374151; }
  .agent-point { border-right: 4px solid #818cf8; background: #eef2ff; padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-size: 13px; color: #312e81; }
  .source-image { margin: 8px 0; text-align: center; }
  .source-image img { max-width: 100%; border: 1px solid #e5e7eb; border-radius: 4px; }
  .image-caption { font-size: 11px; color: #6b7280; margin-top: 4px; }
  .label { font-weight: 600; }
  .source { border-bottom: 1px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px; }
  .source-group { border: 1px solid #fde68a; border-radius: 6px; padding: 12px 14px; margin-bottom: 20px; background: #fffbeb; }
  .group-heading { font-size: 13px; font-weight: bold; color: #92400e; margin-bottom: 10px; }
  .source-group .source-nested { border-bottom: 1px dashed #fde68a; padding-bottom: 12px; margin-bottom: 12px; }
  .source-group .source-nested:last-child { border-bottom: 0; padding-bottom: 0; margin-bottom: 0; }
  .source-head { display: flex; gap: 6px; margin-bottom: 6px; font-size: 13px; font-weight: bold; }
  .idx { color: #9ca3af; }
  .source-text { font-size: 13px; line-height: 1.9; color: #1f2937; }
  .note { font-size: 11px; color: #6b7280; font-style: italic; margin-top: 6px; }
  .commentaries { margin-top: 10px; padding-right: 10px; border-right: 2px solid #fde68a; }
  .comm-ref { font-size: 11px; font-weight: 600; color: #92400e; margin: 0 0 2px; }
  .comm-text p { font-size: 11px; color: #4b5563; margin: 0 0 2px; }
  .empty { text-align: center; color: #9ca3af; }
</style>
</head>
<body>
${sections.join("\n")}
</body>
</html>`;
}
