import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runClaudeStructured } from "@/lib/claudeCli";
import type { BlockAnalysisResult } from "@/lib/types";

const MAX_SOURCE_CHARS = 15000;

const SYSTEM_PROMPT = `אתה עוזר לימוד הלכה. תקבל בלוק הלכתי: מקור מרכזי (למשל שולחן ערוך) יחד עם קטעי מפרשים ששייכים אליו. המשימה שלך היא לנתח את הבלוק הזה בלבד ולהחזיר ניתוח מובנה.

סגנון כתיבה: אנושי, ישיר וקצר. לא אקדמי, לא רובוטי, לא דרשני. כתוב כמו מישהו שמסביר לחבר, לא כמו ספר לימוד.

סיכום (summary):
כמה משפטים ספורים על מה שעולה מכלל המקורות יחד. כשזה משנה, הבחן בין עיקר הדין (מהמקור המרכזי) לבין תוספות, חידושים או הסתייגויות של המפרשים.

הלכה למעשה (practical_points):
נקודות יישומיות בלבד. לכל נקודה נסה לציין: מה לעשות (what), מתי זה רלוונטי (when), ואיך לבצע זאת בפועל (how) — אך אל תמציא פרטים שאין להם בסיס בטקסט; השמט שדה אם אין לו תוכן אמיתי.

כללים קשיחים:
- אסור להמציא הלכה שאינה נובעת מהטקסט שנשלח אליך.
- אם יש מחלוקת, הסתייגות או חוסר ודאות במקורות — ציין זאת במפורש בתוך הסיכום ו/או בנקודה הרלוונטית, ואל תציג מסקנה חד-משמעית שאינה קיימת במקורות.
- אם המקורות קצרים או חלקיים, תן ניתוח קצר בהתאם ואל תמלא בתוכן שאינו שם.`;

const JSON_SCHEMA = {
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

type RequestBody = {
  sourceLabel?: string;
  sourceText?: string;
  commentaries?: { heRef: string; text: string }[];
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  return text.slice(0, MAX_SOURCE_CHARS) + " ... [קוצר]";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  const sourceText = body?.sourceText?.trim();
  if (!body || !sourceText) {
    return NextResponse.json({ error: "sourceText is required" }, { status: 400 });
  }
  const sourceLabel = body.sourceLabel?.trim() || "מקור";
  const commentaries = Array.isArray(body.commentaries) ? body.commentaries : [];

  const blockText = [
    `[${sourceLabel}]`,
    stripHtml(sourceText),
    ...commentaries
      .filter((c) => c && typeof c.text === "string" && c.text.trim())
      .map((c) => `\n[${c.heRef}]\n${stripHtml(c.text)}`),
  ].join("\n");

  const userPrompt = truncate(blockText);

  try {
    const result = await runClaudeStructured<BlockAnalysisResult>(SYSTEM_PROMPT, userPrompt, JSON_SCHEMA);

    if (!result || typeof result.summary !== "string" || !Array.isArray(result.practical_points)) {
      return NextResponse.json({ error: "תשובה לא תקינה מהמודל" }, { status: 502 });
    }

    return NextResponse.json(result satisfies BlockAnalysisResult);
  } catch {
    return NextResponse.json({ error: "הניתוח נכשל" }, { status: 502 });
  }
}
