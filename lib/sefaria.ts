import { readCache, writeCache } from "./cache";

export type BeytYosefText = {
  ref: string;
  title: string;
  text: string[];        // array of se'ifim (Hebrew strings)
  heTitle: string;
};

export type SourceText = {
  ref: string;
  heRef: string;
  text: string;          // Hebrew text (may contain HTML)
  segments: Array<{ ref: string; text: string }>;
  links?: Link[];
};

export type Link = {
  ref: string;
  heRef: string;
  type: string;
  category: string;
  collectiveTitle?: string;
};

const CHELEK_MAP: Record<string, string> = {
  OrachChayim: "Beit_Yosef%2C_Orach_Chayim",
  YorehDeah: "Beit_Yosef%2C_Yoreh_Deah",
  EvenHaEzer: "Beit_Yosef%2C_Even_HaEzer",
  ChoshenMishpat: "Beit_Yosef%2C_Choshen_Mishpat",
};

const SA_CHELEK_MAP: Record<string, string> = {
  OrachChayim: "Shulchan_Arukh%2C_Orach_Chayim",
  YorehDeah: "Shulchan_Arukh%2C_Yoreh_De%27ah",
  EvenHaEzer: "Shulchan_Arukh%2C_Even_HaEzer",
  ChoshenMishpat: "Shulchan_Arukh%2C_Choshen_Mishpat",
};

// null = mefaresh doesn't cover that chelek
const MEFARESH_CHELEK_MAP: Record<string, Record<string, string | null>> = {
  shakh: {
    OrachChayim: null,
    YorehDeah: "Siftei_Kohen_on_Shulchan_Arukh%2C_Yoreh_De%27ah",
    EvenHaEzer: null,
    ChoshenMishpat: "Siftei_Kohen_on_Shulchan_Arukh%2C_Choshen_Mishpat",
  },
  taz: {
    OrachChayim: "Taz_on_Shulchan_Arukh%2C_Orach_Chayim",
    YorehDeah: "Taz_on_Shulchan_Arukh%2C_Yoreh_De%27ah",
    EvenHaEzer: "Taz_on_Shulchan_Arukh%2C_Even_HaEzer",
    ChoshenMishpat: null,
  },
  "pitchei-teshuvah": {
    OrachChayim: null,
    YorehDeah: "Pitchei_Teshuva_on_Shulchan_Arukh%2C_Yoreh_De%27ah",
    EvenHaEzer: "Pitchei_Teshuva_on_Shulchan_Arukh%2C_Even_HaEzer",
    ChoshenMishpat: "Pitchei_Teshuva_on_Shulchan_Arukh%2C_Choshen_Mishpat",
  },
};

export type SeifimText = {
  ref: string;
  text: string[];  // one entry per se'if
};

const SEFARIA_BASE = "https://www.sefaria.org/api/v3/texts";

async function fetchSefaria<T>(ref: string, cacheKey: string): Promise<T> {
  const cached = await readCache<T>(cacheKey);
  if (cached) return cached;

  const url = `${SEFARIA_BASE}/${ref}?context=0&pad=0&language=he`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sefaria API error: ${res.status} for ${ref}`);
  const data: T = await res.json();
  await writeCache(cacheKey, data);
  return data;
}

export async function fetchBeytYosef(
  chelek: string,
  siman: number
): Promise<BeytYosefText> {
  const chelekKey = CHELEK_MAP[chelek];
  if (!chelekKey) throw new Error(`Unknown chelek: ${chelek}`);

  const ref = `${chelekKey}.${siman}`;
  const cacheKey = `by-${chelek}-${siman}`;

  const raw = await fetchSefaria<any>(ref, cacheKey);

  // v3 API: versions array, Hebrew is in versions[0].text
  const versions: any[] = raw.versions ?? [];
  const heVersion = versions.find((v: any) => v.language === "he") ?? versions[0];
  const textContent = heVersion?.text ?? [];

  // Flatten nested arrays if needed
  const seifim: string[] = Array.isArray(textContent)
    ? textContent.map((s: any) => (Array.isArray(s) ? s.join(" ") : String(s ?? "")))
    : [String(textContent)];

  return {
    ref: raw.ref ?? ref,
    title: raw.title ?? ref,
    heTitle: raw.heTitle ?? ref,
    text: seifim,
  };
}

export async function fetchSourceText(ref: string): Promise<SourceText> {
  const encoded = encodeURIComponent(ref);
  const cacheKey = `src-${ref.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "")}`;

  const raw = await fetchSefaria<any>(encoded, cacheKey);

  const versions: any[] = raw.versions ?? [];
  const heVersion = versions.find((v: any) => v.language === "he") ?? versions[0];
  const rawText = heVersion?.text ?? "";
  const text = Array.isArray(rawText) ? rawText.flat().join(" ") : String(rawText);

  let segments: Array<{ ref: string; text: string }> = [];
  if (Array.isArray(rawText)) {
    const baseRef = (raw.ref ?? ref).replace(/\s+/g, "_");
    segments = rawText.map((seg: any, i: number) => {
      const segText = Array.isArray(seg) ? seg.flat().join(" ") : String(seg ?? "");
      return { ref: `${baseRef}.${i + 1}`, text: segText };
    });
  }

  return {
    ref: raw.ref ?? ref,
    heRef: raw.heRef ?? ref,
    text,
    segments,
  };
}

export async function fetchShulchanArukh(
  chelek: string,
  siman: number
): Promise<SeifimText> {
  const chelekKey = SA_CHELEK_MAP[chelek];
  if (!chelekKey) throw new Error(`Unknown chelek for SA: ${chelek}`);

  const ref = `${chelekKey}.${siman}`;
  const cacheKey = `sa-${chelek}-${siman}`;

  const raw = await fetchSefaria<any>(ref, cacheKey);

  const versions: any[] = raw.versions ?? [];
  const heVersion = versions.find((v: any) => v.language === "he") ?? versions[0];
  const textContent = heVersion?.text ?? [];

  const seifim: string[] = Array.isArray(textContent)
    ? textContent.map((s: any) => (Array.isArray(s) ? s.join(" ") : String(s ?? "")))
    : [String(textContent)];

  return { ref: raw.ref ?? ref, text: seifim };
}

// Returns seifim text for a mefaresh; returns null if mefaresh doesn't cover this chelek.
export async function fetchMefareshText(
  mefaresh: string,
  chelek: string,
  siman: number
): Promise<SeifimText | null> {
  const chelekMap = MEFARESH_CHELEK_MAP[mefaresh];
  if (!chelekMap) throw new Error(`Unknown mefaresh: ${mefaresh}`);

  const chelekKey = chelekMap[chelek];
  if (!chelekKey) return null; // mefaresh doesn't cover this chelek

  const ref = `${chelekKey}.${siman}`;
  const cacheKey = `mefaresh-${mefaresh}-${chelek}-${siman}`;

  try {
    const raw = await fetchSefaria<any>(ref, cacheKey);

    const versions: any[] = raw.versions ?? [];
    const heVersion = versions.find((v: any) => v.language === "he") ?? versions[0];
    const textContent = heVersion?.text ?? [];

    const seifim: string[] = Array.isArray(textContent)
      ? textContent.map((s: any) => {
          if (Array.isArray(s)) {
            // mefarshim are often doubly nested: outer = se'if, inner = individual notes
            return s.map((note: any) => (Array.isArray(note) ? note.join(" ") : String(note ?? ""))).join(" ");
          }
          return String(s ?? "");
        })
      : [String(textContent)];

    return { ref: raw.ref ?? ref, text: seifim };
  } catch {
    return null;
  }
}

const TUR_CHELEK_MAP: Record<string, string> = {
  OrachChayim: "Tur%2C_Orach_Chayim",
  YorehDeah: "Tur%2C_Yoreh_Deah",
  EvenHaEzer: "Tur%2C_Even_HaEzer",
  ChoshenMishpat: "Tur%2C_Choshen_Mishpat",
};

// Returns the full siman text as a single HTML string (Tur has 1 element per siman)
export async function fetchTur(
  chelek: string,
  siman: number
): Promise<{ ref: string; text: string }> {
  const chelekKey = TUR_CHELEK_MAP[chelek];
  if (!chelekKey) throw new Error(`Unknown chelek for Tur: ${chelek}`);

  const ref = `${chelekKey}.${siman}`;
  const cacheKey = `tur-${chelek}-${siman}`;

  const raw = await fetchSefaria<any>(ref, cacheKey);

  const versions: any[] = raw.versions ?? [];
  const heVersion = versions.find((v: any) => v.language === "he") ?? versions[0];
  const textContent = heVersion?.text ?? "";

  const text = Array.isArray(textContent)
    ? textContent.map((s: any) => (Array.isArray(s) ? s.join(" ") : String(s ?? ""))).join(" ")
    : String(textContent);

  return { ref: raw.ref ?? ref, text };
}

export async function fetchLinks(ref: string): Promise<Link[]> {
  const encoded = encodeURIComponent(ref);
  const cacheKey = `links-${ref.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "")}`;

  const cached = await readCache<Link[]>(cacheKey);
  if (cached) return cached;

  const url = `https://www.sefaria.org/api/links/${encoded}?with_text=0`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data: any[] = await res.json();

  const links: Link[] = data.map((l: any) => ({
    ref: l.ref ?? "",
    heRef: l.heRef ?? "",
    type: l.type ?? "",
    category: l.category ?? "",
    collectiveTitle: l.collectiveTitle?.he ?? l.collectiveTitle?.en ?? "",
  }));

  await writeCache(cacheKey, links);
  return links;
}
