import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createInvitation, getAllInvitations } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "אסור" }, { status: 403 });
  return NextResponse.json(getAllInvitations());
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "אסור" }, { status: 403 });

  const { email } = await req.json() as { email?: string };
  const token = randomUUID();
  const inv = createInvitation({ id: randomUUID(), token, email: email?.toLowerCase().trim() ?? null, invitedBy: session.user.id });
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3003";
  return NextResponse.json({ ...inv, link: `${base}/register?token=${token}` });
}
