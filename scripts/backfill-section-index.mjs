/**
 * backfill-section-index.mjs
 *
 * One-time retroactive backfill: for every saved document, fills in the
 * `sectionIndex` on any "source" excerpt that's missing it, so the
 * document's origin-section grouping heading (see lib/groupExcerpts.ts)
 * shows up immediately for sources marked before that feature existed —
 * instead of waiting for the per-page reactive backfill effect in
 * app/siman/[chelek]/[number]/page.tsx to run next time that siman happens
 * to be opened.
 *
 * Two recovery strategies, in order:
 *   1. If the excerpt has an annotationId, copy sectionIndex from that
 *      annotation row (if it has one).
 *   2. Otherwise, best-effort match an annotation row with the same
 *      (chelek, siman, source_key, text) that has a non-null section_index
 *      — covers excerpts that predate the annotation-linking feature.
 *
 * Defaults to a dry run (prints what would change, writes nothing).
 * Pass --apply to actually write.
 *
 * Run: node scripts/backfill-section-index.mjs [--apply]
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dir, "..", "data", "annotations.db");
const APPLY = process.argv.includes("--apply");

const db = new Database(DB_PATH);

const annotationsByChelekSiman = new Map(); // "chelek|siman" -> Annotation[]
for (const ann of db.prepare("SELECT * FROM annotations").all()) {
  const key = `${ann.chelek}|${ann.siman}`;
  if (!annotationsByChelekSiman.has(key)) annotationsByChelekSiman.set(key, []);
  annotationsByChelekSiman.get(key).push(ann);
}
const annotationById = new Map(db.prepare("SELECT * FROM annotations").all().map((a) => [a.id, a]));

const documents = db.prepare("SELECT * FROM documents").all();

let totalDocsChanged = 0;
let totalExcerptsFixed = 0;
const report = [];

for (const doc of documents) {
  let parsed;
  try {
    parsed = JSON.parse(doc.data);
  } catch {
    continue;
  }
  const excerpts = Array.isArray(parsed.excerpts) ? parsed.excerpts : [];
  if (excerpts.length === 0) continue;

  const key = `${doc.chelek}|${doc.siman}`;
  const candidateAnnotations = annotationsByChelekSiman.get(key) ?? [];

  let changedInDoc = 0;
  const fixes = [];

  for (const ex of excerpts) {
    const itemType = ex.type ?? "source";
    if (itemType !== "source") continue;
    if (ex.sectionIndex !== undefined && ex.sectionIndex !== null) continue;

    let resolvedSectionIndex;
    let via;

    if (ex.annotationId) {
      const ann = annotationById.get(ex.annotationId);
      if (ann && ann.section_index !== null && ann.section_index !== undefined) {
        resolvedSectionIndex = ann.section_index;
        via = "annotationId";
      }
    }

    if (resolvedSectionIndex === undefined) {
      const match = candidateAnnotations.find(
        (a) =>
          a.source_key === ex.sourceKey &&
          a.text === ex.text &&
          a.section_index !== null &&
          a.section_index !== undefined
      );
      if (match) {
        resolvedSectionIndex = match.section_index;
        via = "matched";
      }
    }

    if (resolvedSectionIndex !== undefined) {
      fixes.push({
        excerptId: ex.id,
        sourceKey: ex.sourceKey,
        sourceLabel: ex.sourceLabel,
        sectionIndex: resolvedSectionIndex,
        via,
      });
      ex.sectionIndex = resolvedSectionIndex;
      changedInDoc++;
    }
  }

  if (changedInDoc > 0) {
    totalDocsChanged++;
    totalExcerptsFixed += changedInDoc;
    report.push({ chelek: doc.chelek, siman: doc.siman, userId: doc.user_id, changedInDoc, fixes });

    if (APPLY) {
      db.prepare("UPDATE documents SET data = ?, updated_at = datetime('now') WHERE id = ?").run(
        JSON.stringify(parsed),
        doc.id
      );
    }
  }
}

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${documents.length} documents scanned\n`);
for (const r of report) {
  console.log(`${r.chelek} סימן ${r.siman} (user ${r.userId}) — ${r.changedInDoc} excerpt(s) fixed:`);
  for (const f of r.fixes) {
    console.log(`  [${f.via}] ${f.sourceLabel} (${f.sourceKey}) → sectionIndex=${f.sectionIndex}`);
  }
}
console.log(`\nTotals: ${totalDocsChanged} document(s), ${totalExcerptsFixed} excerpt(s) fixed.`);
if (!APPLY) {
  console.log("\nDry run only — nothing was written. Re-run with --apply to write these changes.");
}

db.close();
