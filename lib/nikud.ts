// Strips Hebrew niqqud/cantillation (the Unicode "Hebrew points" block,
// U+0591–U+05C7 minus the letters/punctuation interspersed in that range)
// from already-rendered HTML — safe to run post-highlighting since it only
// touches combining marks, never the base letters or any HTML tags.
const NIKUD_RANGE = /[֑-ׇֽֿׁׂׅׄ]/g;

export function stripNikud(html: string): string {
  return html.replace(NIKUD_RANGE, "");
}
