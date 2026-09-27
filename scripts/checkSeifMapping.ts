// One-off diagnostic (docs/plan/2026-09-23-redesign-plan.md §4.2 bullet 2):
// runs the se'if-mapping consistency check (lib/sefaria.ts buildSeifBlocks)
// across a sample of real simanim from all four chelakim and reports any
// mefaresh whose running-cursor total didn't match its fetched note count —
// i.e. every siman/mefaresh combination the "לפי סעיפי שו״ע" view would
// currently show a "⚠️ מיפוי לא ודאי" warning for.
//
// Not part of `npm test` (it makes live Sefaria calls) — run by hand:
//   npm run check-seif-mapping
import {
  fetchShulchanArukh,
  fetchMefareshText,
  buildSeifBlocks,
} from "../lib/sefaria";

const CHELAKIM = ["OrachChayim", "YorehDeah", "EvenHaEzer", "ChoshenMishpat"];
const SAMPLE_SIMANIM = [1, 2, 3, 4, 5];

async function checkOne(chelek: string, siman: number) {
  const sa = await fetchShulchanArukh(chelek, siman).catch(() => null);
  if (!sa || sa.text.length === 0) {
    return { chelek, siman, skipped: true as const };
  }

  const [taz, shakh, pitcheiTeshuva, magenAvraham, beitShmuel, meiratEinayim] = await Promise.all([
    fetchMefareshText("taz", chelek, siman).catch(() => null),
    fetchMefareshText("shakh", chelek, siman).catch(() => null),
    fetchMefareshText("pitchei-teshuvah", chelek, siman).catch(() => null),
    fetchMefareshText("magen-avraham", chelek, siman).catch(() => null),
    fetchMefareshText("beit-shmuel", chelek, siman).catch(() => null),
    fetchMefareshText("meirat-einayim", chelek, siman).catch(() => null),
  ]);

  const blocks = await buildSeifBlocks(chelek, siman, sa.text, {
    taz: taz?.text, shakh: shakh?.text, pitcheiTeshuva: pitcheiTeshuva?.text,
    magenAvraham: magenAvraham?.text, beitShmuel: beitShmuel?.text, meiratEinayim: meiratEinayim?.text,
  });

  const uncertainKeys = new Set<string>();
  for (const b of blocks) for (const k of b.uncertainSourceKeys) uncertainKeys.add(k);

  return { chelek, siman, skipped: false as const, seifCount: sa.text.length, uncertainKeys: Array.from(uncertainKeys) };
}

async function main() {
  const results: Awaited<ReturnType<typeof checkOne>>[] = [];
  for (const chelek of CHELAKIM) {
    for (const siman of SAMPLE_SIMANIM) {
      results.push(await checkOne(chelek, siman));
    }
  }

  console.log("\n=== seif-mapping consistency report ===\n");
  let mismatchCount = 0;
  for (const r of results) {
    if (r.skipped) {
      console.log(`  ${r.chelek} ${r.siman}: skipped (no SA text)`);
      continue;
    }
    if (r.uncertainKeys.length === 0) {
      console.log(`  ${r.chelek} ${r.siman}: ok (${r.seifCount} se'ifim)`);
    } else {
      mismatchCount++;
      console.log(`  ${r.chelek} ${r.siman}: ⚠️ uncertain — ${r.uncertainKeys.join(", ")}`);
    }
  }
  console.log(`\n${mismatchCount} / ${results.length} sampled simanim have at least one uncertain mefaresh mapping.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
