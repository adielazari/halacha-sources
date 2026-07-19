import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllUsers, updateUserRole } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "אסור" }, { status: 403 });
  return NextResponse.json(getAllUsers().map((u) => ({ ...u, passwordHash: undefined })));
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "אסור" }, { status: 403 });
  const { id, role } = await req.json() as { id?: string; role?: "user" | "admin" };
  if (!id || !role) return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  if (id === session.user.id) return NextResponse.json({ error: "לא ניתן לשנות את עצמך" }, { status: 400 });
  updateUserRole(id, role);
  return NextResponse.json({ ok: true });
}
