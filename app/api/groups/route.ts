import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createGroup, getUserGroups, searchGroupsByName } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });

  const query = req.nextUrl.searchParams.get("search");
  if (query !== null) {
    // Search mode: return groups matching name (for join request flow)
    return NextResponse.json(searchGroupsByName(query));
  }
  return NextResponse.json(getUserGroups(session.user.id));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });

  const { name } = await req.json() as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "שם קבוצה חסר" }, { status: 400 });

  const group = createGroup({ id: randomUUID(), name: name.trim(), createdBy: session.user.id });
  return NextResponse.json(group, { status: 201 });
}
