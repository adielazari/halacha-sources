import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAnnotationCountsByChelek } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const chelek = req.nextUrl.searchParams.get("chelek");
  if (!chelek) return NextResponse.json({ error: "chelek חסר" }, { status: 400 });
  return NextResponse.json(getAnnotationCountsByChelek(chelek));
}
