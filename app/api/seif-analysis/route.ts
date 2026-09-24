import { NextRequest, NextResponse } from "next/server";
import { getLocalSession } from "@/lib/localSession";
import { getBlockAnalyses, upsertBlockAnalysis } from "@/lib/db";
import { runClaudeStructured } from "@/lib/claudeCli";
import { BLOCK_ANALYSIS_SYSTEM_PROMPT, BLOCK_ANALYSIS_JSON_SCHEMA, buildBlockPrompt } from "@/lib/blockAnalysisPrompt";
import type { BlockAnalysisResult } from "@/lib/types";

// Reads the local SQLite DB on every request — never prerender/cache at build.
export const dynamic = "force-dynamic";

// GET — all stored analyses for a siman, so the "לפי סעיפי שו״ע" view can
// show "already analyzed" / stale state without the user having to click.
export async function GET(req: NextRequest) {
  const session = getLocalSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const chelek = searchParams.get("chelek");
  const siman = searchParams.get("siman");
  if (!chelek || !siman) {
    return NextResponse.json({ error: "Missing chelek or siman" }, { status: 400 });
  }

  return NextResponse.json({ analyses: getBlockAnalyses(chelek, siman) });
}

type RequestBody = {
  chelek?: string;
  siman?: string;
  seifIndex?: number;
  contentHash?: string;
  sourceLabel?: string;
  sourceText?: string;
  commentaries?: { heRef: string; text: string }[];
};

// POST — (re)generates and upserts the analysis for one HalachicBlock,
// keyed by (chelek, siman, seifIndex). Always send the block's *current*
// full content (not just what changed) — the stored row is fully replaced,
// never merged.
export async function POST(req: NextRequest) {
  const session = getLocalSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  const sourceText = body?.sourceText?.trim();
  const { chelek, siman, contentHash } = body ?? {};
  const seifIndex = body?.seifIndex;
  if (!body || !chelek || !siman || seifIndex === undefined || !contentHash || !sourceText) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    const row = upsertBlockAnalysis({
      chelek, siman, seifIndex, contentHash,
      summary: result.summary,
      practicalPoints: result.practical_points,
    });

    return NextResponse.json({ analysis: row });
  } catch {
    return NextResponse.json({ error: "הניתוח נכשל" }, { status: 502 });
  }
}
