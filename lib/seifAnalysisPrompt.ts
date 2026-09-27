// The one remaining AI feature (see docs/plan/2026-09-23-redesign-plan.md
// §3.2/§4.3): a persisted summary + practical points per HalachicBlock,
// generated via app/api/seif-analysis. Every practical point must cite one
// of the source labels actually sent in the request — buildSeifJsonSchema
// bakes the closed list into the schema's enum, and validatePracticalPoints
// re-checks it server-side in case the model still drifts.

export const MAX_SOURCE_CHARS = 15000;

export const SEIF_ANALYSIS_SYSTEM_PROMPT = `אתה עוזר לימוד הלכה. תקבל בלוק הלכתי: מקור מרכזי (למשל שולחן ערוך) יחד עם קטעי מפרשים ששייכים אליו. המשימה שלך היא לנתח את הבלוק הזה בלבד ולהחזיר ניתוח מובנה.

סגנון כתיבה: אנושי, ישיר וקצר. לא אקדמי, לא רובוטי, לא דרשני. כתוב כמו מישהו שמסביר לחבר, לא כמו ספר לימוד.

סיכום (summary):
כמה משפטים ספורים על מה שעולה מכלל המקורות יחד. כשזה משנה, הבחן בין עיקר הדין (מהמקור המרכזי) לבין תוספות, חידושים או הסתייגויות של המפרשים.

הלכה למעשה (practical_points):
נקודות יישומיות בלבד. לכל נקודה נסה לציין: מה לעשות (what), מתי זה רלוונטי (when), ואיך לבצע זאת בפועל (how) — אך אל תמציא פרטים שאין להם בסיס בטקסט; השמט שדה אם אין לו תוכן אמיתי.
ניסוח הנקודות צריך להיות בגוף ראשון, כאילו הקורא אומר זאת על עצמו — למשל "לקום מיוזמתי ולא בגלל שמישהו/משהו עורר אותי", ולא בגוף שני ("מיוזמתך", "אותך").
לכל נקודה חובה לציין את שדה source — בדיוק אחת מהתוויות שמופיעות בסוגריים מרובעים בטקסט שנשלח אליך (למשל "[ט"ז]"), בלי הסוגריים. אסור להמציא תווית שלא נשלחה אליך.

כללים קשיחים:
- אסור להמציא הלכה שאינה נובעת מהטקסט שנשלח אליך.
- אם יש מחלוקת, הסתייגות או חוסר ודאות במקורות — ציין זאת במפורש בתוך הסיכום ו/או בנקודה הרלוונטית, ואל תציג מסקנה חד-משמעית שאינה קיימת במקורות.
- אם המקורות קצרים או חלקיים, תן ניתוח קצר בהתאם ואל תמלא בתוכן שאינו שם.`;

/** JSON schema for the structured output, scoped to this request's actual source labels. */
export function buildSeifJsonSchema(validLabels: string[]) {
  return {
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
            source: { type: "string", enum: validLabels },
          },
          required: ["what", "source"],
        },
      },
    },
    required: ["summary", "practical_points"],
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  return text.slice(0, MAX_SOURCE_CHARS) + " ... [קוצר]";
}

/** Builds the user-turn prompt from a main source plus its commentary notes. */
export function buildSeifPrompt(
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

/** The closed list of labels a practical point's `source` may cite for this block. */
export function collectValidSourceLabels(
  sourceLabel: string,
  commentaries: { heRef: string; text: string }[]
): string[] {
  return [sourceLabel, ...commentaries.map((c) => c.heRef)];
}

/**
 * Server-side re-check: drops any point whose `source` isn't one of the
 * labels actually sent to the model. Defense in depth — the JSON schema's
 * enum should already constrain this, but a CLI-mediated model call is
 * never a guarantee.
 */
export function filterValidPracticalPoints<T extends { source?: string }>(
  points: T[],
  validLabels: string[]
): T[] {
  const valid = new Set(validLabels);
  return points.filter((p) => typeof p.source === "string" && valid.has(p.source));
}
