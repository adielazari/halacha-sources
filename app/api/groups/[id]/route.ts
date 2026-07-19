import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroupWithDetails, getGroupMember, deleteGroup } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const grp = getGroupWithDetails(id, session.user.id);
  if (!grp) return NextResponse.json({ error: "לא נמצא או אינך חבר" }, { status: 404 });
  return NextResponse.json(grp);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const member = getGroupMember(id, session.user.id);
  if (member?.role !== "owner" && session.user.role !== "admin") return NextResponse.json({ error: "רק מנהל הקבוצה יכול למחוק" }, { status: 403 });
  deleteGroup(id);
  return NextResponse.json({ ok: true });
}
