import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import HTMLtoDOCX from "html-to-docx";
import { authOptions } from "@/lib/auth";
import { getDocument } from "@/lib/db";
import { renderSimanSection, buildFullHtml } from "@/lib/documentHtml";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "אסור" }, { status: 401 });
  }

  const body = await req.json() as { items?: { chelek: string; siman: string }[] };
  const items = body.items ?? [];
  if (items.length === 0) {
    return NextResponse.json({ error: "items is required" }, { status: 400 });
  }

  const sections = items.map((item) => {
    const doc = getDocument(session.user.id, item.chelek, item.siman);
    return renderSimanSection(item.chelek, item.siman, doc?.excerpts ?? []);
  });
  const html = buildFullHtml(sections);

  const buffer = await HTMLtoDOCX(html, null, { orientation: "portrait", title: "דף מקורות הלכתי" });
  const filename = items.length > 1 ? "מקורות-מאוחד.docx" : `${items[0].chelek}-${items[0].siman}.docx`;

  return new NextResponse(new Blob([buffer as unknown as ArrayBuffer]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
