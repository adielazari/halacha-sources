import type Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { CommentaryEntry, Excerpt } from "./types";

// One-time move of panel highlights from the old `annotations` table onto the
// document excerpts themselves (Excerpt.highlightText), so the document is
// the single source of truth. The `annotations` table is left in place,
// untouched, and a full DB backup is written first.
//
// Why matching isn't just "follow annotationId": a race in the old page code
// (a backfill effect firing before the annotation POST returned) created a
// second annotation whose highlight was the *pulled Sefaria text*, and that
// one sometimes won the excerpt's annotationId — orphaning the real one (the
// mention in the Tur/Beit Yosef, e.g. "נדרים (י.)"). So for each excerpt we
// consider every annotation of the same siman/panel/paragraph/label, and
// reject a highlight equal to the text of a Sefaria-pulled excerpt.

const MIGRATION_KEY = "annotations_to_documents";

type AnnotationRow = {
  id: string;
  chelek: string;
  siman: string;
  source_key: string;
  source_label: string;
  text: string;
  source_ref: string | null;
  commentaries: string | null;
  section_index: number | null;
  highlight_text: string | null;
  status: string;
};

type DocumentRow = { id: string; user_id: string; chelek: string; siman: string; data: string };

type LegacyExcerpt = Excerpt & { annotationId?: string };

export type MigrationReport = {
  skipped?: "already-done" | "no-annotations-table";
  backupPath?: string;
  highlightsAttached: number;
  excerptsCreated: number;
  annotationsIgnored: number;
};

const stripTags = (html: string) => html.replace(/<[^>]+>/g, "").trim();

function sameSection(a: number | null, b: number | string | undefined): boolean {
  const norm = (v: number | string | null | undefined) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  return norm(a) === norm(b);
}

// A highlight must be findable in the panel. A Sefaria-pulled excerpt's own
// text never is — that's the race-bug fingerprint.
function isUsableHighlight(ann: AnnotationRow, ex: LegacyExcerpt): boolean {
  const hl = (ann.highlight_text ?? "").trim();
  if (!hl || ann.status === "rejected") return false;
  if (ex.sourceRef && hl === stripTags(ex.text ?? "")) return false;
  return true;
}

export function migrateAnnotationsToDocuments(db: Database.Database, primaryUserId: string | null): MigrationReport {
  const report: MigrationReport = { highlightsAttached: 0, excerptsCreated: 0, annotationsIgnored: 0 };

  db.exec("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  if (db.prepare("SELECT 1 FROM app_meta WHERE key = ?").get(MIGRATION_KEY)) {
    return { ...report, skipped: "already-done" };
  }
  const markDone = () =>
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, datetime('now'))").run(MIGRATION_KEY);

  const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'annotations'").get();
  if (!hasTable) {
    markDone();
    return { ...report, skipped: "no-annotations-table" };
  }

  // Backup first — VACUUM INTO can't run inside a transaction.
  const backupDir = path.join(path.dirname(db.name), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  report.backupPath = path.join(backupDir, `annotations-before-highlight-migration-${stamp}.db`);
  db.prepare("VACUUM INTO ?").run(report.backupPath);

  const annotations = db.prepare("SELECT * FROM annotations ORDER BY created_at").all() as AnnotationRow[];
  const docs = db.prepare("SELECT id, user_id, chelek, siman, data FROM documents").all() as DocumentRow[];
  const consumed = new Set<string>();

  const run = db.transaction(() => {
    const parsed = docs.map((row) => {
      let data: { excerpts?: LegacyExcerpt[]; expandedPanels?: Record<string, boolean> } = {};
      try { data = JSON.parse(row.data); } catch { /* keep empty */ }
      return { row, data, changed: false };
    });

    // 1. Attach a highlight to each existing source excerpt.
    for (const doc of parsed) {
      for (const ex of doc.data.excerpts ?? []) {
        const belongs = annotations.filter(
          (a) =>
            a.chelek === doc.row.chelek &&
            a.siman === doc.row.siman &&
            (a.id === ex.annotationId ||
              (a.source_key === ex.sourceKey &&
                a.source_label === ex.sourceLabel &&
                sameSection(a.section_index, ex.sectionIndex)))
        );
        belongs.forEach((a) => consumed.add(a.id));

        if ((ex.type ?? "source") === "source" && !ex.highlightText) {
          const linked = belongs.find((a) => a.id === ex.annotationId);
          const pick = [linked, ...belongs.filter((a) => a !== linked)].find(
            (a): a is AnnotationRow => !!a && isUsableHighlight(a, ex)
          );
          if (pick) {
            ex.highlightText = pick.highlight_text!.trim();
            report.highlightsAttached++;
            doc.changed = true;
          }
        }
        if (ex.annotationId !== undefined) {
          delete ex.annotationId;
          doc.changed = true;
        }
      }
    }

    // 2. Leftover highlights (marks whose excerpt never reached the server
    // document) become source excerpts in the local user's document.
    const seen = new Set<string>();
    for (const a of annotations) {
      if (consumed.has(a.id)) continue;
      const hl = (a.highlight_text ?? "").trim();
      const key = [a.chelek, a.siman, a.source_key, a.section_index, a.source_label, hl].join("\u0000");
      if (!hl || a.status === "rejected" || !primaryUserId || seen.has(key)) {
        report.annotationsIgnored++;
        continue;
      }
      seen.add(key);

      let doc = parsed.find((d) => d.row.user_id === primaryUserId && d.row.chelek === a.chelek && d.row.siman === a.siman);
      if (!doc) {
        doc = {
          row: { id: crypto.randomUUID(), user_id: primaryUserId, chelek: a.chelek, siman: a.siman, data: "{}" },
          data: { excerpts: [], expandedPanels: {} },
          changed: true,
        };
        parsed.push(doc);
      }
      let commentaries: CommentaryEntry[] = [];
      try { commentaries = JSON.parse(a.commentaries ?? "[]"); } catch { /* none */ }
      (doc.data.excerpts ??= []).push({
        id: crypto.randomUUID(),
        type: "source",
        sourceKey: a.source_key,
        sourceLabel: a.source_label,
        text: a.text || hl,
        ...(a.source_ref ? { sourceRef: a.source_ref } : {}),
        ...(commentaries.length ? { commentaries } : {}),
        ...(a.section_index !== null ? { sectionIndex: a.section_index } : {}),
        highlightText: hl,
      });
      doc.changed = true;
      report.excerptsCreated++;
    }

    const upsert = db.prepare(`
      INSERT INTO documents (id, user_id, chelek, siman, data, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, chelek, siman)
      DO UPDATE SET data = excluded.data, updated_at = datetime('now')
    `);
    for (const doc of parsed) {
      if (!doc.changed) continue;
      const payload = JSON.stringify({ excerpts: doc.data.excerpts ?? [], expandedPanels: doc.data.expandedPanels ?? {} });
      upsert.run(doc.row.id, doc.row.user_id, doc.row.chelek, doc.row.siman, payload);
    }
    markDone();
  });
  run();

  console.log(
    `[migrate] highlights → documents: ${report.highlightsAttached} attached, ` +
      `${report.excerptsCreated} excerpts created, ${report.annotationsIgnored} ignored. Backup: ${report.backupPath}`
  );
  return report;
}
