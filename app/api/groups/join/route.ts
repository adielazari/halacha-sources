import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createJoinRequest } from "@/lib/db";
import { randomUUID } from "crypto";

// POST /api/groups/join  { groupId }  — send a join request
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });

  const { groupId } = await req.json() as { groupId?: string };
  if (!groupId) return NextResponse.json({ error: "חסר groupId" }, { status: 400 });

  const result = createJoinRequest({ id: randomUUID(), groupId, userId: session.user.id });
  if (result === "already_member") return NextResponse.json({ error: "כבר חבר בקבוצה" }, { status: 409 });
  if (result === "already_requested") return NextResponse.json({ error: "בקשה כבר נשלחה" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
