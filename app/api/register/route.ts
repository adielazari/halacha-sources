import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail, getInvitationByToken, markInvitationUsed, hasAnyUser } from "@/lib/db";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const { name, email, password, token } = await req.json() as {
    name?: string; email?: string; password?: string; token?: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json({ error: "נא למלא את כל השדות" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const isFirstUser = !hasAnyUser();

  // First user ever = becomes admin (no invitation needed)
  if (!isFirstUser) {
    if (!token) return NextResponse.json({ error: "נדרש קישור הזמנה" }, { status: 403 });
    const inv = getInvitationByToken(token);
    if (!inv) return NextResponse.json({ error: "קישור הזמנה לא תקין" }, { status: 403 });
    if (inv.usedBy) return NextResponse.json({ error: "קישור הזמנה כבר נוצל" }, { status: 403 });
    if (inv.email && inv.email.toLowerCase() !== normalizedEmail) {
      return NextResponse.json({ error: "כתובת האימייל אינה תואמת להזמנה" }, { status: 403 });
    }
  }

  if (getUserByEmail(normalizedEmail)) {
    return NextResponse.json({ error: "אימייל זה כבר רשום" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = randomUUID();
  const role = isFirstUser ? "admin" : "user";

  const user = createUser({ id, name, email: normalizedEmail, passwordHash, role });

  if (!isFirstUser && token) {
    markInvitationUsed(token, id);
  }

  return NextResponse.json({ ok: true, role: user.role });
}
