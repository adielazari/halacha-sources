import { NextRequest, NextResponse } from "next/server";
import { updateAnnotation, deleteAnnotation } from "@/lib/db";
import type { UpdateAnnotationData } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json() as UpdateAnnotationData;
    const annotation = updateAnnotation(params.id, body);

    if (!annotation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ annotation });
  } catch (err) {
    console.error("PATCH /api/annotations/:id error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ok = deleteAnnotation(params.id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/annotations/:id error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
