import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchUsers, getGroupMemberUserIds } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const groupId = req.nextUrl.searchParams.get("groupId");
  if (q.length < 2) return NextResponse.json([]);
  const excludeIds = groupId ? getGroupMemberUserIds(groupId) : [session.user.id];
  return NextResponse.json(searchUsers(q, excludeIds));
}
