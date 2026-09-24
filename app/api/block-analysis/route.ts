import { NextRequest, NextResponse } from "next/server";
import { getLocalSession } from "@/lib/localSession";
import { runClaudeStructured } from "@/lib/claudeCli";
import { BLOCK_ANALYSIS_SYSTEM_PROMPT, BLOCK_ANALYSIS_JSON_SCHEMA, buildBlockPrompt } from "@/lib/blockAnalysisPrompt";
import type { BlockAnalysisResult } from "@/lib/types";

type RequestBody = {
  sourceLabel?: string;
  sourceText?: string;
  commentaries?: { heRef: string; text: string }[];
};

export async function POST(req: NextRequest) {
  const session = getLocalSession();
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

  const userPrompt = buildBlockPrompt(sourceLabel, sourceText, commentaries);

  try {
    const result = await runClaudeStructured<BlockAnalysisResult>(
      BLOCK_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
      BLOCK_ANALYSIS_JSON_SCHEMA
    );

    if (!result || typeof result.summary !== "string" || !Array.isArray(result.practical_points)) {
      return NextResponse.json({ error: "תשובה לא תקינה מהמודל" }, { status: 502 });
    }

    return NextResponse.json(result satisfies BlockAnalysisResult);
  } catch {
    return NextResponse.json({ error: "הניתוח נכשל" }, { status: 502 });
  }
}
