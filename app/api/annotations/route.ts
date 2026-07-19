import { NextRequest, NextResponse } from "next/server";
import { getAllAnnotations, createAnnotation, getGroupsForSiman } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { CommentaryEntry } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chelek = searchParams.get("chelek");
  const siman = searchParams.get("siman");
  const requestedStatus = searchParams.get("status") ?? "approved";

  if (!chelek || !siman) {
    return NextResponse.json({ error: "chelek and siman are required" }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);

    // Admins can request any status
    if (session?.user?.role === "admin") {
      return NextResponse.json({ annotations: getAllAnnotations(chelek, siman, requestedStatus) });
    }

    // Group members see all annotations for group simanim
    if (session?.user?.id) {
      const groups = getGroupsForSiman(session.user.id, chelek, parseInt(siman, 10));
      if (groups.length > 0) {
        return NextResponse.json({ annotations: getAllAnnotations(chelek, siman, "all") });
      }
    }

    // Default: approved only
    return NextResponse.json({ annotations: getAllAnnotations(chelek, siman, "approved") });
  } catch (err) {
    console.error("GET /api/annotations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json() as {
      chelek: string;
      siman: string;
      sourceKey: string;
      sourceLabel: string;
      text?: string;
      sourceRef?: string | null;
      commentaries?: CommentaryEntry[];
      sectionIndex?: number | null;
      highlightText?: string | null;
      sectionHtml?: string | null;
      userName?: string;
    };

    if (!body.chelek || !body.siman || !body.sourceKey || !body.sourceLabel) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check write permission: if siman is in a group, only write/owner members can annotate
    if (session?.user?.id) {
      const groups = getGroupsForSiman(session.user.id, body.chelek, parseInt(body.siman, 10));
      const isGroupSiman = groups.length > 0;
      if (isGroupSiman && groups.every((g) => g.myRole === "read")) {
        return NextResponse.json({ error: "אין הרשאת כתיבה בקבוצה" }, { status: 403 });
      }
    }

    const annotation = createAnnotation({
      id: crypto.randomUUID(),
      ...body,
      userId: session?.user?.id ?? null,
      userName: session?.user?.name ?? body.userName ?? "anonymous",
      // Auto-approve on creation — this is single-user local work, not a
      // moderated public queue, so a mark should be visible the moment it's
      // made. (Admin can still flip status manually from /admin if ever needed.)
      status: "approved",
    });

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (err) {
    console.error("POST /api/annotations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
