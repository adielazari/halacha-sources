import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroupMember, addGroupMember } from "@/lib/db";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

// POST — owner directly adds a user (by userId)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const member = getGroupMember(id, session.user.id);
  if (member?.role !== "owner") return NextResponse.json({ error: "רק בעל הקבוצה" }, { status: 403 });

  const { userId } = await req.json() as { userId?: string };
  if (!userId) return NextResponse.json({ error: "חסר userId" }, { status: 400 });
  if (getGroupMember(id, userId)) return NextResponse.json({ error: "המשתמש כבר חבר" }, { status: 409 });

  addGroupMember({ id: randomUUID(), groupId: id, userId, role: "read" });
  return NextResponse.json({ ok: true }, { status: 201 });
}
