import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDocument, saveDocument } from "@/lib/db";
import type { Excerpt } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const chelek = searchParams.get("chelek");
  const siman = searchParams.get("siman");
  if (!chelek || !siman) {
    return NextResponse.json({ error: "chelek and siman are required" }, { status: 400 });
  }

  const document = getDocument(session.user.id, chelek, siman);
  return NextResponse.json({ document });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  try {
    const body = await req.json() as {
      chelek?: string;
      siman?: string;
      excerpts?: Excerpt[];
      expandedPanels?: Record<string, boolean>;
    };

    if (!body.chelek || !body.siman) {
      return NextResponse.json({ error: "chelek and siman are required" }, { status: 400 });
    }

    const document = saveDocument({
      userId: session.user.id,
      chelek: body.chelek,
      siman: body.siman,
      excerpts: body.excerpts ?? [],
      expandedPanels: body.expandedPanels ?? {},
    });
    return NextResponse.json({ document });
  } catch (err) {
    console.error("PUT /api/documents error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
