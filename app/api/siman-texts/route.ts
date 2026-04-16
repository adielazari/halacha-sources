import { NextRequest, NextResponse } from "next/server";
import {
  fetchBeytYosef,
  fetchShulchanArukh,
  fetchMefareshText,
  fetchTur,
} from "@/lib/sefaria";

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

  const [turResult, byResult, saResult, tazResult, shakhResult, ptResult] =
    await Promise.allSettled([
      fetchTur(chelek, siman),
      fetchBeytYosef(chelek, siman),
      fetchShulchanArukh(chelek, siman),
      fetchMefareshText("taz", chelek, siman),
      fetchMefareshText("shakh", chelek, siman),
      fetchMefareshText("pitchei-teshuvah", chelek, siman),
    ]);

  return NextResponse.json({
    tur:
      turResult.status === "fulfilled" ? turResult.value : null,
    beitYosef:
      byResult.status === "fulfilled"
        ? { ref: byResult.value.ref, text: byResult.value.text }
        : null,
    shulchanArukh:
      saResult.status === "fulfilled"
        ? { ref: saResult.value.ref, text: saResult.value.text }
        : null,
    taz:
      tazResult.status === "fulfilled" && tazResult.value
        ? { ref: tazResult.value.ref, text: tazResult.value.text }
        : null,
    shakh:
      shakhResult.status === "fulfilled" && shakhResult.value
        ? { ref: shakhResult.value.ref, text: shakhResult.value.text }
        : null,
    pitcheiTeshuva:
      ptResult.status === "fulfilled" && ptResult.value
        ? { ref: ptResult.value.ref, text: ptResult.value.text }
        : null,
  });
}
