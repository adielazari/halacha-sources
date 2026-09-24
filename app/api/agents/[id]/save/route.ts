import { NextRequest, NextResponse } from "next/server";
import { getLocalSession } from "@/lib/localSession";
import { getAgentDefinition } from "@/lib/db";
import { saveAgentBatch } from "@/lib/agentRuns";

/**
 * Persists a batch of already-generated points for an agent — no external API
 * call happens here. Used when the points were generated elsewhere (e.g. by
 * Claude Code itself via the `siman-points` skill) instead of through the
 * paid `/run` endpoint, but should be saved with the same replace-by-agentId
 * semantics.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getLocalSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  const agentDef = getAgentDefinition(params.id);
  if (!agentDef) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json() as { chelek?: string; siman?: string; points?: unknown };
  const { chelek, siman } = body;
  if (!chelek || !siman) {
    return NextResponse.json({ error: "chelek and siman are required" }, { status: 400 });
  }

  const rawPoints = Array.isArray(body.points) ? body.points : [];
  const points = rawPoints.filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0
  ).map((p) => p.trim());

  if (points.length === 0) {
    return NextResponse.json({ error: "points array is required and must be non-empty" }, { status: 400 });
  }

  const saved = saveAgentBatch({
    userId: session.user.id,
    chelek,
    siman,
    agentDef,
    points,
  });

  return NextResponse.json({ document: saved });
}
