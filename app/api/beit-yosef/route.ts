import { NextRequest, NextResponse } from "next/server";
import { fetchBeytYosef } from "@/lib/sefaria";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const chelek = searchParams.get("chelek");
  const simanStr = searchParams.get("siman");

  if (!chelek || !simanStr) {
    return NextResponse.json({ error: "Missing chelek or siman" }, { status: 400 });
  }

  const siman = parseInt(simanStr, 10);
  if (isNaN(siman) || siman < 1) {
    return NextResponse.json({ error: "Invalid siman number" }, { status: 400 });
  }

  try {
    const result = await fetchBeytYosef(chelek, siman);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
