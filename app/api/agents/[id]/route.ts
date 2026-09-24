import { NextRequest, NextResponse } from "next/server";
import { getLocalSession } from "@/lib/localSession";
import { updateAgentDefinition, deleteAgentDefinition } from "@/lib/db";
import type { AgentLanguage } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getLocalSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  try {
    const body = await req.json() as Partial<{
      name: string;
      model: string;
      systemPrompt: string;
      language: AgentLanguage;
    }>;
    const agent = updateAgentDefinition(params.id, body);
    if (!agent) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ agent });
  } catch (err) {
    console.error("PATCH /api/agents/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getLocalSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  try {
    const ok = deleteAgentDefinition(params.id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/agents/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
