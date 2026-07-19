import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, getCollectionSimanim, addSimanToCollection, removeSimanFromCollection, reorderCollectionSimanim } from "@/lib/db";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const coll = getCollection(id);
  if (!coll) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  if (coll.userId !== session.user.id) return NextResponse.json({ error: "אסור" }, { status: 403 });

  const body = await req.json() as { chelek?: string; simanNumber?: number } | { simanim?: { chelek: string; simanNumber: number }[] } | { reorder?: string[] };

  // Bulk reorder
  if ("reorder" in body && Array.isArray(body.reorder)) {
    reorderCollectionSimanim(id, body.reorder);
    return NextResponse.json({ ok: true });
  }

  // Bulk add
  if ("simanim" in body && Array.isArray(body.simanim)) {
    const existing = getCollectionSimanim(id);
    const existingSet = new Set(existing.map((s) => `${s.chelek}:${s.simanNumber}`));
    const toAdd = body.simanim.filter((s) => !existingSet.has(`${s.chelek}:${s.simanNumber}`));
    const startPos = existing.length;
    for (let i = 0; i < toAdd.length; i++) {
      addSimanToCollection({ id: randomUUID(), collectionId: id, chelek: toAdd[i].chelek, simanNumber: toAdd[i].simanNumber, position: startPos + i });
    }
    return NextResponse.json({ added: toAdd.length });
  }

  // Single add
  const { chelek, simanNumber } = body as { chelek?: string; simanNumber?: number };
  if (!chelek || !simanNumber) return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  const existing = getCollectionSimanim(id);
  const result = addSimanToCollection({ id: randomUUID(), collectionId: id, chelek, simanNumber, position: existing.length });
  if (!result) return NextResponse.json({ error: "סימן כבר קיים" }, { status: 409 });
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const coll = getCollection(id);
  if (!coll) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  if (coll.userId !== session.user.id) return NextResponse.json({ error: "אסור" }, { status: 403 });

  const { chelek, simanNumber } = await req.json() as { chelek?: string; simanNumber?: number };
  if (!chelek || !simanNumber) return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  removeSimanFromCollection(id, chelek, simanNumber);
  return NextResponse.json({ ok: true });
}
