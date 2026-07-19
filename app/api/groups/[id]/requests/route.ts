import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroupMember, getPendingJoinRequests } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const member = getGroupMember(id, session.user.id);
  if (member?.role !== "owner") return NextResponse.json({ error: "רק בעל הקבוצה" }, { status: 403 });
  return NextResponse.json(getPendingJoinRequests(id));
}
