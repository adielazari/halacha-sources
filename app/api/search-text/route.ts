import { NextRequest, NextResponse } from "next/server";
import { readCache, writeCache } from "@/lib/cache";

// Tractate English name (with spaces) → full Sefaria path prefix for Bavli
const BAVLI_PATH: Record<string, string> = {
  Berakhot: "Talmud/Bavli/Seder Zeraim",
  Shabbat: "Talmud/Bavli/Seder Moed", Eruvin: "Talmud/Bavli/Seder Moed",
  Pesachim: "Talmud/Bavli/Seder Moed", Yoma: "Talmud/Bavli/Seder Moed",
  Sukkah: "Talmud/Bavli/Seder Moed", Beitzah: "Talmud/Bavli/Seder Moed",
  "Rosh Hashanah": "Talmud/Bavli/Seder Moed", Taanit: "Talmud/Bavli/Seder Moed",
  Megillah: "Talmud/Bavli/Seder Moed", "Moed Katan": "Talmud/Bavli/Seder Moed",
  Chagigah: "Talmud/Bavli/Seder Moed",
  Yevamot: "Talmud/Bavli/Seder Nashim", Ketubot: "Talmud/Bavli/Seder Nashim",
  Nedarim: "Talmud/Bavli/Seder Nashim", Nazir: "Talmud/Bavli/Seder Nashim",
  Sotah: "Talmud/Bavli/Seder Nashim", Gittin: "Talmud/Bavli/Seder Nashim",
  Kiddushin: "Talmud/Bavli/Seder Nashim",
  "Bava Kamma": "Talmud/Bavli/Seder Nezikin", "Bava Metzia": "Talmud/Bavli/Seder Nezikin",
  "Bava Batra": "Talmud/Bavli/Seder Nezikin", Sanhedrin: "Talmud/Bavli/Seder Nezikin",
  Makkot: "Talmud/Bavli/Seder Nezikin", Shevuot: "Talmud/Bavli/Seder Nezikin",
  "Avodah Zarah": "Talmud/Bavli/Seder Nezikin", Horayot: "Talmud/Bavli/Seder Nezikin",
  Zevachim: "Talmud/Bavli/Seder Kodashim", Menachot: "Talmud/Bavli/Seder Kodashim",
  Chullin: "Talmud/Bavli/Seder Kodashim", Bekhorot: "Talmud/Bavli/Seder Kodashim",
  Arakhin: "Talmud/Bavli/Seder Kodashim", Temurah: "Talmud/Bavli/Seder Kodashim",
  Keritot: "Talmud/Bavli/Seder Kodashim", "Me'ilah": "Talmud/Bavli/Seder Kodashim",
  Tamid: "Talmud/Bavli/Seder Kodashim", Middot: "Talmud/Bavli/Seder Kodashim",
  Kinnim: "Talmud/Bavli/Seder Kodashim",
  Niddah: "Talmud/Bavli/Seder Taharot",
};

// Tractate English name (with spaces) → Seder for Yerushalmi
const YERUSHALMI_SEDER: Record<string, string> = {
  Berakhot: "Seder Zeraim", Peah: "Seder Zeraim", Demai: "Seder Zeraim",
  Kilayim: "Seder Zeraim", Sheviit: "Seder Zeraim", Terumot: "Seder Zeraim",
  Maasrot: "Seder Zeraim", "Maaser Sheni": "Seder Zeraim", Challah: "Seder Zeraim",
  Orlah: "Seder Zeraim", Bikkurim: "Seder Zeraim",
  Shabbat: "Seder Moed", Eruvin: "Seder Moed", Pesachim: "Seder Moed",
  Shekalim: "Seder Moed", Yoma: "Seder Moed", Sukkah: "Seder Moed",
  Beitzah: "Seder Moed", "Rosh Hashanah": "Seder Moed", Taanit: "Seder Moed",
  Megillah: "Seder Moed", Chagigah: "Seder Moed", "Moed Katan": "Seder Moed",
  Yevamot: "Seder Nashim", Ketubot: "Seder Nashim", Sotah: "Seder Nashim",
  Nedarim: "Seder Nashim", Nazir: "Seder Nashim", Gittin: "Seder Nashim",
  Kiddushin: "Seder Nashim",
  "Bava Kamma": "Seder Nezikin", "Bava Metzia": "Seder Nezikin",
  "Bava Batra": "Seder Nezikin", Sanhedrin: "Seder Nezikin",
  Makkot: "Seder Nezikin", Shevuot: "Seder Nezikin",
  "Avodah Zarah": "Seder Nezikin", Horayot: "Seder Nezikin",
};

function tractateToSpaces(t: string): string {
  return t.replace(/_/g, " ");
}

function buildPathFilter(tractate: string, yerushalmi: boolean): string | null {
  const name = tractateToSpaces(tractate);
  if (yerushalmi) {
    const seder = YERUSHALMI_SEDER[name];
    if (!seder) return null;
    return `Talmud/Yerushalmi/${seder}/Jerusalem Talmud ${name}`;
  } else {
    const sederPath = BAVLI_PATH[name];
    if (!sederPath) return null;
    return `${sederPath}/${name}`;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("query");
  // tractate: English name (may have underscores). Prefix "Jerusalem Talmud " means Yerushalmi.
  const tractateParam = searchParams.get("tractate") ?? "";

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    // Strip niqqud and cantillation marks so vocalized queries match unvocalized text
    const cleanQuery = query.replace(/[\u05B0-\u05C7\u05F3\u05F4\u0591-\u05AF]/g, "").trim();

    const yerushalmi = tractateParam.startsWith("Jerusalem Talmud ");
    const tractateEn = yerushalmi
      ? tractateParam.replace("Jerusalem Talmud ", "")
      : tractateParam;

    const pathFilter = tractateEn ? buildPathFilter(tractateEn, yerushalmi) : null;

    // Cache key: tractate + query
    const searchCacheKey = `search-${tractateParam.replace(/[^a-zA-Z0-9]/g, "_")}-${cleanQuery}`;
    const cachedResults = await readCache<{ ref: string; heRef: string; snippet: string }[]>(searchCacheKey);
    if (cachedResults) {
      return NextResponse.json(
        { results: cachedResults },
        { headers: { "Cache-Control": "public, max-age=3600" } }
      );
    }

    const body: Record<string, unknown> = {
      query: cleanQuery,
      type: "text",
      field: "exact",
      source_proj: true,
      slop: 0,
      start: 0,
      size: 10,
      sort_method: "num_sources",
      min_score: 0.05,
    };

    if (pathFilter) {
      body.filters = [pathFilter];
      body.filter_fields = ["path"];
    }

    const res = await fetch("https://www.sefaria.org/api/search-wrapper", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        Origin: "https://www.sefaria.org",
        Referer: "https://www.sefaria.org/search",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Sefaria search: ${res.status}`);

    const data = await res.json();
    const hits: any[] = data?.hits?.hits ?? [];

    const seen = new Set<string>();
    const results = hits
      .map((hit) => ({
        ref: String(hit._source?.ref ?? hit._id ?? ""),
        heRef: String(hit._source?.heRef ?? hit._id ?? ""),
        snippet: String(hit._source?.he ?? hit._source?.exact ?? "")
          .replace(/<[^>]+>/g, "")
          .slice(0, 80),
      }))
      .filter((r) => {
        if (!r.ref || seen.has(r.ref)) return false;
        seen.add(r.ref);
        return true;
      });

    await writeCache(searchCacheKey, results);
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
