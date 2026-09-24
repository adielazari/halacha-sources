import { NextRequest, NextResponse } from "next/server";
import { getLocalSession } from "@/lib/localSession";
import { createCollection, getUserCollections } from "@/lib/db";
import type { OrgMode } from "@/lib/types";
import { randomUUID } from "crypto";

// Reads the local SQLite DB on every request — never prerender/cache at build.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = getLocalSession();
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  return NextResponse.json(getUserCollections(session.user.id));
}

export async function POST(req: NextRequest) {
  const session = getLocalSession();
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });

  const body = await req.json() as { name?: string; orgMode?: OrgMode; chelek?: string; topic?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: "שם חסר" }, { status: 400 });
  if (!["topic", "quantity", "free"].includes(body.orgMode ?? "")) return NextResponse.json({ error: "מצב ארגון לא תקין" }, { status: 400 });

  const collection = createCollection({
    id: randomUUID(),
    name: body.name.trim(),
    userId: session.user.id,
    orgMode: body.orgMode!,
    chelek: body.chelek ?? null,
    topic: body.topic ?? null,
  });

  return NextResponse.json(collection, { status: 201 });
}
