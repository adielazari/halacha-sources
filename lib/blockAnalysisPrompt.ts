// Shared between app/api/block-analysis (single curated excerpt, ephemeral)
// and app/api/seif-analysis (a full HalachicBlock, persisted) — same tone
// rules and output contract either way, just different input assembly.

export const MAX_SOURCE_CHARS = 15000;

export const BLOCK_ANALYSIS_SYSTEM_PROMPT = `אתה עוזר לימוד הלכה. תקבל בלוק הלכתי: מקור מרכזי (למשל שולחן ערוך) יחד עם קטעי מפרשים ששייכים אליו. המשימה שלך היא לנתח את הבלוק הזה בלבד ולהחזיר ניתוח מובנה.

סגנון כתיבה: אנושי, ישיר וקצר. לא אקדמי, לא רובוטי, לא דרשני. כתוב כמו מישהו שמסביר לחבר, לא כמו ספר לימוד.

סיכום (summary):
כמה משפטים ספורים על מה שעולה מכלל המקורות יחד. כשזה משנה, הבחן בין עיקר הדין (מהמקור המרכזי) לבין תוספות, חידושים או הסתייגויות של המפרשים.

הלכה למעשה (practical_points):
נקודות יישומיות בלבד. לכל נקודה נסה לציין: מה לעשות (what), מתי זה רלוונטי (when), ואיך לבצע זאת בפועל (how) — אך אל תמציא פרטים שאין להם בסיס בטקסט; השמט שדה אם אין לו תוכן אמיתי.
ניסוח הנקודות צריך להיות בגוף ראשון, כאילו הקורא אומר זאת על עצמו — למשל "לקום מיוזמתי ולא בגלל שמישהו/משהו עורר אותי", ולא בגוף שני ("מיוזמתך", "אותך").

כללים קשיחים:
- אסור להמציא הלכה שאינה נובעת מהטקסט שנשלח אליך.
- אם יש מחלוקת, הסתייגות או חוסר ודאות במקורות — ציין זאת במפורש בתוך הסיכום ו/או בנקודה הרלוונטית, ואל תציג מסקנה חד-משמעית שאינה קיימת במקורות.
- אם המקורות קצרים או חלקיים, תן ניתוח קצר בהתאם ואל תמלא בתוכן שאינו שם.`;

export const BLOCK_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    practical_points: {
      type: "array",
      items: {
        type: "object",
        properties: {
          what: { type: "string" },
          when: { type: "string" },
          how: { type: "string" },
        },
        required: ["what"],
      },
    },
  },
  required: ["summary", "practical_points"],
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  return text.slice(0, MAX_SOURCE_CHARS) + " ... [קוצר]";
}

/** Builds the user-turn prompt from a main source plus its commentary notes. */
export function buildBlockPrompt(
  sourceLabel: string,
  sourceText: string,
  commentaries: { heRef: string; text: string }[]
): string {
  const blockText = [
    `[${sourceLabel}]`,
    stripHtml(sourceText),
    ...commentaries
      .filter((c) => c && typeof c.text === "string" && c.text.trim())
      .map((c) => `\n[${c.heRef}]\n${stripHtml(c.text)}`),
  ].join("\n");

  return truncate(blockText);
}
