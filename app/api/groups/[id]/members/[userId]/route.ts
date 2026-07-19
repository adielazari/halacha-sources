import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroupMember, updateGroupMemberRole, removeGroupMember } from "@/lib/db";
import type { GroupRole } from "@/lib/types";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id, userId } = await params;

  const myMember = getGroupMember(id, session.user.id);
  if (myMember?.role !== "owner") return NextResponse.json({ error: "רק בעל הקבוצה יכול לשנות תפקידים" }, { status: 403 });
  if (userId === session.user.id) return NextResponse.json({ error: "לא ניתן לשנות את עצמך" }, { status: 400 });

  const { role } = await req.json() as { role?: GroupRole };
  if (!role || !["read", "write"].includes(role)) return NextResponse.json({ error: "תפקיד לא תקין" }, { status: 400 });

  updateGroupMemberRole(id, userId, role);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id, userId } = await params;

  const myMember = getGroupMember(id, session.user.id);
  // Owner can remove anyone except themselves; members can only remove themselves
  if (userId !== session.user.id && myMember?.role !== "owner") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  if (userId === session.user.id && myMember?.role === "owner") {
    return NextResponse.json({ error: "הבעלים לא יכול לעזוב — מחק את הקבוצה במקום" }, { status: 400 });
  }

  removeGroupMember(id, userId);
  return NextResponse.json({ ok: true });
}
