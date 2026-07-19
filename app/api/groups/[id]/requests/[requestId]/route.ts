import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroupMember, processJoinRequest } from "@/lib/db";

type Params = { params: Promise<{ id: string; requestId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id, requestId } = await params;
  const member = getGroupMember(id, session.user.id);
  if (member?.role !== "owner") return NextResponse.json({ error: "רק בעל הקבוצה" }, { status: 403 });
  const { action } = await req.json() as { action?: "approved" | "rejected" };
  if (action !== "approved" && action !== "rejected") return NextResponse.json({ error: "פעולה לא תקינה" }, { status: 400 });
  processJoinRequest(requestId, action);
  return NextResponse.json({ ok: true });
}
