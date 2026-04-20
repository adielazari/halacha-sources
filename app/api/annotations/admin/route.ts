import { NextRequest, NextResponse } from "next/server";
import { getAllAnnotationsAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all";

  try {
    const annotations = getAllAnnotationsAdmin(status);
    return NextResponse.json({ annotations });
  } catch (err) {
    console.error("GET /api/annotations/admin error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
