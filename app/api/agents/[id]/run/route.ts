import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAgentDefinition, getDocument } from "@/lib/db";
import { fetchTur, fetchBeytYosef, fetchShulchanArukh, fetchMefareshText } from "@/lib/sefaria";
import { getAnthropicClient } from "@/lib/anthropicClient";
import { CHELEK_LABELS } from "@/lib/documentHtml";
import { saveAgentBatch } from "@/lib/agentRuns";

const MAX_SOURCE_CHARS = 15000;

// Hardcoded here (not stored in the DB / not user-editable) so editing the
// agent's system prompt can never break the parsing contract below.
const FIXED_FORMAT_SUFFIX =
  'השב אך ורק במערך JSON של מחרוזות, מחרוזת אחת לכל נקודה, ללא טקסט נוסף, ללא הסברים, וללא markdown code fences (```json). לדוגמה: ["נקודה ראשונה... (מקור)", "נקודה שנייה... (מקור)"]';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  return text.slice(0, MAX_SOURCE_CHARS) + " ... [קוצר]";
}

function parsePoints(raw: string): string[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      const strings = parsed
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        .map((s) => s.trim());
      if (strings.length > 0) return strings;
    }
  } catch { /* fall through to line-split fallback */ }

  return cleaned
    .split("\n")
    .map((line) => line.trim().replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, ""))
    .filter((line) => line.length > 0);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  const agentDef = getAgentDefinition(params.id);
  if (!agentDef) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json() as { chelek?: string; siman?: string };
  const chelek = body.chelek;
  const simanStr = body.siman;
  if (!chelek || !simanStr) {
    return NextResponse.json({ error: "chelek and siman are required" }, { status: 400 });
  }
  const simanNum = parseInt(simanStr, 10);
  if (isNaN(simanNum) || simanNum < 1) {
    return NextResponse.json({ error: "Invalid siman number" }, { status: 400 });
  }

  const [turResult, byResult, saResult, tazResult, shakhResult, ptResult] =
    await Promise.allSettled([
      fetchTur(chelek, simanNum),
      fetchBeytYosef(chelek, simanNum),
      fetchShulchanArukh(chelek, simanNum),
      fetchMefareshText("taz", chelek, simanNum),
      fetchMefareshText("shakh", chelek, simanNum),
      fetchMefareshText("pitchei-teshuvah", chelek, simanNum),
    ]);

  const sections: string[] = [];
  if (turResult.status === "fulfilled" && turResult.value.text) {
    sections.push(`### טור\n${truncate(stripHtml(turResult.value.text))}`);
  }
  if (byResult.status === "fulfilled" && byResult.value.text.length) {
    sections.push(`### בית יוסף\n${truncate(stripHtml(byResult.value.text.join("\n")))}`);
  }
  if (saResult.status === "fulfilled" && saResult.value.text.length) {
    sections.push(`### שולחן ערוך\n${truncate(stripHtml(saResult.value.text.join("\n")))}`);
  }
  if (tazResult.status === "fulfilled" && tazResult.value && tazResult.value.text.length) {
    sections.push(`### ט"ז\n${truncate(stripHtml(tazResult.value.text.join("\n")))}`);
  }
  if (shakhResult.status === "fulfilled" && shakhResult.value && shakhResult.value.text.length) {
    sections.push(`### ש"ך\n${truncate(stripHtml(shakhResult.value.text.join("\n")))}`);
  }
  if (ptResult.status === "fulfilled" && ptResult.value && ptResult.value.text.length) {
    sections.push(`### פתחי תשובה\n${truncate(stripHtml(ptResult.value.text.join("\n")))}`);
  }

  const existingDoc = getDocument(session.user.id, chelek, simanStr);
  // Never feed an agent its own (or another agent's) prior output as if it
  // were the user's hand-picked material.
  const curatedExcerpts = (existingDoc?.excerpts ?? []).filter((e) => !e.agentId);
  if (curatedExcerpts.length > 0) {
    const summaryLines = curatedExcerpts.map((e) => {
      const label = e.sourceLabel ? `${e.sourceLabel}: ` : "";
      const note = e.note ? ` (הערה: ${e.note})` : "";
      return `- ${label}${stripHtml(e.text)}${note}`;
    });
    sections.push(`### סיכום שנאסף על ידי המשתמש\n${summaryLines.join("\n")}`);
  }

  if (sections.length === 0) {
    return NextResponse.json({ error: "לא נמצא תוכן הלכתי לסימן זה" }, { status: 400 });
  }

  const chelekLabel = CHELEK_LABELS[chelek] ?? chelek;
  const userPrompt = `סימן: ${chelekLabel} סימן ${simanStr}\n\n${sections.join("\n\n")}`;

  const languageLine =
    agentDef.language === "en"
      ? "Write all points in English only."
      : "כתוב את כל הנקודות בעברית בלבד.";
  const system = `${agentDef.systemPrompt}\n\n${languageLine}\n${FIXED_FORMAT_SUFFIX}`;

  let responseText = "";
  try {
    const client = getAnthropicClient();
    const resp = await client.messages.create({
      model: agentDef.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = resp.content.find((b) => b.type === "text") as
      | { type: "text"; text: string }
      | undefined;
    responseText = textBlock?.text ?? "";
  } catch (err) {
    console.error(`POST /api/agents/${params.id}/run — Anthropic call failed:`, err);
    return NextResponse.json({ error: "הקריאה למודל נכשלה" }, { status: 502 });
  }

  const points = parsePoints(responseText);
  if (points.length === 0) {
    // A garbled/empty response must never silently wipe a previously good run.
    return NextResponse.json({ error: "לא התקבלו נקודות תקינות מהמודל" }, { status: 502 });
  }

  const saved = saveAgentBatch({
    userId: session.user.id,
    chelek,
    siman: simanStr,
    agentDef,
    points,
  });

  return NextResponse.json({ document: saved });
}
