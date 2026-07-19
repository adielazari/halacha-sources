import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroupsForSiman } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([]);
  const chelek = req.nextUrl.searchParams.get("chelek") ?? "";
  const siman = parseInt(req.nextUrl.searchParams.get("siman") ?? "0", 10);
  if (!chelek || !siman) return NextResponse.json([]);
  return NextResponse.json(getGroupsForSiman(session.user.id, chelek, siman));
}
