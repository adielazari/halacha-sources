import { NextRequest, NextResponse } from "next/server";
import { getLocalSession } from "@/lib/localSession";
import { getAllAgentDefinitions, createAgentDefinition } from "@/lib/db";
import type { AgentLanguage } from "@/lib/types";

// Reads the local SQLite DB on every request — never prerender/cache at build.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = getLocalSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }
  return NextResponse.json({ agents: getAllAgentDefinitions() });
}

export async function POST(req: NextRequest) {
  const session = getLocalSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  try {
    const body = await req.json() as {
      name?: string;
      model?: string;
      systemPrompt?: string;
      language?: AgentLanguage;
    };

    if (!body.name || !body.model || !body.systemPrompt) {
      return NextResponse.json({ error: "name, model and systemPrompt are required" }, { status: 400 });
    }

    const agent = createAgentDefinition({
      id: crypto.randomUUID(),
      name: body.name,
      model: body.model,
      systemPrompt: body.systemPrompt,
      language: body.language,
    });
    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    console.error("POST /api/agents error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
