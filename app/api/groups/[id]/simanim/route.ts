import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroupMember, addSimanToGroup, removeSimanFromGroup } from "@/lib/db";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const member = getGroupMember(id, session.user.id);
  if (!member || member.role === "read") return NextResponse.json({ error: "אין הרשאת כתיבה" }, { status: 403 });

  const { chelek, simanNumber } = await req.json() as { chelek?: string; simanNumber?: number };
  if (!chelek || !simanNumber) return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });

  const ok = addSimanToGroup({ id: randomUUID(), groupId: id, chelek, simanNumber, addedBy: session.user.id });
  if (!ok) return NextResponse.json({ error: "סימן כבר קיים" }, { status: 409 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const member = getGroupMember(id, session.user.id);
  if (!member || member.role === "read") return NextResponse.json({ error: "אין הרשאת כתיבה" }, { status: 403 });

  const { chelek, simanNumber } = await req.json() as { chelek?: string; simanNumber?: number };
  if (!chelek || !simanNumber) return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  removeSimanFromGroup(id, chelek, simanNumber);
  return NextResponse.json({ ok: true });
}
