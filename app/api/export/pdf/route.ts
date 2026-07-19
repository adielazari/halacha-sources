import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { chromium } from "playwright";
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

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", right: "10mm", left: "10mm" },
    });
    const filename = items.length > 1 ? "מקורות-מאוחד.pdf" : `${items[0].chelek}-${items[0].siman}.pdf`;
    return new NextResponse(new Blob([pdf as unknown as ArrayBuffer]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } finally {
    await browser.close();
  }
}
