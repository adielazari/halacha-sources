import { NextRequest, NextResponse } from "next/server";
import { getAllAnnotations, createAnnotation } from "@/lib/db";
import { getLocalSession } from "@/lib/localSession";
import type { CommentaryEntry } from "@/lib/types";

// Reads the local SQLite DB on every request — never prerender/cache at build.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chelek = searchParams.get("chelek");
  const siman = searchParams.get("siman");
  const requestedStatus = searchParams.get("status") ?? "approved";

  if (!chelek || !siman) {
    return NextResponse.json({ error: "chelek and siman are required" }, { status: 400 });
  }

  try {
    return NextResponse.json({ annotations: getAllAnnotations(chelek, siman, requestedStatus) });
  } catch (err) {
    console.error("GET /api/annotations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getLocalSession();
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

    const annotation = createAnnotation({
      id: crypto.randomUUID(),
      ...body,
      userId: session.user.id,
      userName: session.user.name,
      // Single-user local app — no moderation queue, a mark is visible the
      // moment it's made.
      status: "approved",
    });

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (err) {
    console.error("POST /api/annotations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
