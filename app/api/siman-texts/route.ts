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

  const [
    turResult, byResult, saResult, tazResult, shakhResult, ptResult,
    magenAvrahamResult, beitShmuelResult, meiratEinayimResult,
  ] = await Promise.allSettled([
      fetchTur(chelek, siman),
      fetchBeytYosef(chelek, siman),
      fetchShulchanArukh(chelek, siman),
      fetchMefareshText("taz", chelek, siman),
      fetchMefareshText("shakh", chelek, siman),
      fetchMefareshText("pitchei-teshuvah", chelek, siman),
      fetchMefareshText("magen-avraham", chelek, siman),
      fetchMefareshText("beit-shmuel", chelek, siman),
      fetchMefareshText("meirat-einayim", chelek, siman),
    ]);

  // Prefetch adjacent simanim in the background — fire and forget, do not await
  const prefetchSiman = (s: number) => {
    if (s < 1) return;
    void Promise.allSettled([
      fetchTur(chelek, s),
      fetchBeytYosef(chelek, s),
      fetchShulchanArukh(chelek, s),
      fetchMefareshText("taz", chelek, s),
      fetchMefareshText("shakh", chelek, s),
      fetchMefareshText("pitchei-teshuvah", chelek, s),
      fetchMefareshText("magen-avraham", chelek, s),
      fetchMefareshText("beit-shmuel", chelek, s),
      fetchMefareshText("meirat-einayim", chelek, s),
    ]).catch(() => {});
  };
  prefetchSiman(siman - 1);
  prefetchSiman(siman + 1);

  const fromResult = (r: PromiseSettledResult<{ ref: string; text: string[] } | null>) =>
    r.status === "fulfilled" && r.value ? { ref: r.value.ref, text: r.value.text } : null;

  return NextResponse.json(
    {
      tur: turResult.status === "fulfilled" ? turResult.value : null,
      beitYosef: byResult.status === "fulfilled" ? { ref: byResult.value.ref, text: byResult.value.text } : null,
      shulchanArukh: saResult.status === "fulfilled" ? { ref: saResult.value.ref, text: saResult.value.text } : null,
      taz: fromResult(tazResult),
      shakh: fromResult(shakhResult),
      pitcheiTeshuva: fromResult(ptResult),
      magenAvraham: fromResult(magenAvrahamResult),
      beitShmuel: fromResult(beitShmuelResult),
      meiratEinayim: fromResult(meiratEinayimResult),
    },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } }
  );
}
