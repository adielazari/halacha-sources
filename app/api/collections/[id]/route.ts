import { NextRequest, NextResponse } from "next/server";
import { getLocalSession } from "@/lib/localSession";
import { getCollectionWithSimanim, updateCollection, deleteCollection } from "@/lib/db";
import type { OrgMode } from "@/lib/types";

// Reads the local SQLite DB on every request — never prerender/cache at build.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = getLocalSession();
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const coll = getCollectionWithSimanim(id);
  if (!coll) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  if (coll.userId !== session.user.id && session.user.role !== "admin") return NextResponse.json({ error: "אסור" }, { status: 403 });
  return NextResponse.json(coll);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = getLocalSession();
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const coll = getCollectionWithSimanim(id);
  if (!coll) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  if (coll.userId !== session.user.id) return NextResponse.json({ error: "אסור" }, { status: 403 });

  const body = await req.json() as Partial<{ name: string; orgMode: OrgMode; chelek: string | null; topic: string | null }>;
  const updated = updateCollection(id, body);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = getLocalSession();
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const coll = getCollectionWithSimanim(id);
  if (!coll) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  if (coll.userId !== session.user.id && session.user.role !== "admin") return NextResponse.json({ error: "אסור" }, { status: 403 });
  deleteCollection(id);
  return NextResponse.json({ ok: true });
}
