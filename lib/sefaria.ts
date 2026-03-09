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

const SEFARIA_BASE = "https://www.sefaria.org/api/v3/texts";

async function fetchSefaria<T>(ref: string, cacheKey: string): Promise<T> {
  const cached = await readCache<T>(cacheKey);
  if (cached) return cached;

  const url = `${SEFARIA_BASE}/${ref}?context=0&pad=0&language=he`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
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

  return {
    ref: raw.ref ?? ref,
    heRef: raw.heRef ?? ref,
    text,
  };
}

export async function fetchLinks(ref: string): Promise<Link[]> {
  const encoded = encodeURIComponent(ref);
  const cacheKey = `links-${ref.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "")}`;

  const cached = await readCache<Link[]>(cacheKey);
  if (cached) return cached;

  const url = `https://www.sefaria.org/api/links/${encoded}?with_text=0`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
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
