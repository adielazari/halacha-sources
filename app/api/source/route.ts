import { NextRequest, NextResponse } from "next/server";
import { fetchSourceText, fetchLinks } from "@/lib/sefaria";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ref = searchParams.get("ref");
  const withLinks = searchParams.get("links") === "1";

  if (!ref) {
    return NextResponse.json({ error: "Missing ref" }, { status: 400 });
  }

  try {
    const [source, links] = await Promise.all([
      fetchSourceText(ref),
      withLinks ? fetchLinks(ref) : Promise.resolve([]),
    ]);
    return NextResponse.json(
      { ...source, links },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
