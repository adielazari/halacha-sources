import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Annotation, CommentaryEntry } from "./types";

const globalForDb = globalThis as unknown as { __db?: Database.Database };

function getDb(): Database.Database {
  if (!globalForDb.__db) {
    const dbDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const dbPath = path.join(dbDir, "annotations.db");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");

    db.exec(`
      CREATE TABLE IF NOT EXISTS annotations (
        id             TEXT PRIMARY KEY,
        chelek         TEXT NOT NULL,
        siman          TEXT NOT NULL,
        source_key     TEXT NOT NULL,
        source_label   TEXT NOT NULL,
        text           TEXT NOT NULL DEFAULT '',
        source_ref     TEXT,
        commentaries   TEXT DEFAULT '[]',
        section_index  INTEGER,
        highlight_text TEXT,
        section_html   TEXT,
        user_name      TEXT DEFAULT 'anonymous',
        status         TEXT NOT NULL DEFAULT 'pending',
        created_at     TEXT DEFAULT (datetime('now')),
        updated_at     TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_annotations_siman ON annotations(chelek, siman);
    `);

    // Migration for existing DBs that have 'approved' instead of 'status'
    const cols = db.pragma("table_info(annotations)") as { name: string }[];
    const hasStatus = cols.some((c) => c.name === "status");
    const hasApproved = cols.some((c) => c.name === "approved");
    if (!hasStatus) {
      db.exec("ALTER TABLE annotations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
      if (hasApproved) {
        db.exec(
          "UPDATE annotations SET status = CASE WHEN approved = 1 THEN 'approved' ELSE 'pending' END"
        );
      }
    }

    globalForDb.__db = db;
  }
  return globalForDb.__db;
}

type DbRow = {
  id: string;
  chelek: string;
  siman: string;
  source_key: string;
  source_label: string;
  text: string;
  source_ref: string | null;
  commentaries: string;
  section_index: number | null;
  highlight_text: string | null;
  section_html: string | null;
  user_name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function rowToAnnotation(row: DbRow): Annotation {
  let commentaries: CommentaryEntry[] = [];
  try { commentaries = JSON.parse(row.commentaries) as CommentaryEntry[]; } catch { /* empty */ }
  const status = (["pending", "approved", "rejected"].includes(row.status)
    ? row.status
    : "pending") as Annotation["status"];
  return {
    id: row.id,
    chelek: row.chelek,
    siman: row.siman,
    sourceKey: row.source_key,
    sourceLabel: row.source_label,
    text: row.text,
    sourceRef: row.source_ref,
    commentaries,
    sectionIndex: row.section_index,
    highlightText: row.highlight_text,
    sectionHtml: row.section_html,
    userName: row.user_name,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllAnnotations(
  chelek: string,
  siman: string,
  status?: string
): Annotation[] {
  const db = getDb();
  let query = "SELECT * FROM annotations WHERE chelek = ? AND siman = ?";
  const params: unknown[] = [chelek, siman];
  if (status && status !== "all") {
    query += " AND status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at ASC";
  const rows = db.prepare(query).all(...params) as DbRow[];
  return rows.map(rowToAnnotation);
}

export function getAllAnnotationsAdmin(status?: string): Annotation[] {
  const db = getDb();
  let query = "SELECT * FROM annotations";
  const params: unknown[] = [];
  if (status && status !== "all") {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC";
  const rows = db.prepare(query).all(...params) as DbRow[];
  return rows.map(rowToAnnotation);
}

export function getAnnotation(id: string): Annotation | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM annotations WHERE id = ?").get(id) as DbRow | undefined;
  return row ? rowToAnnotation(row) : null;
}

export type CreateAnnotationData = {
  id: string;
  chelek: string;
  siman: string;
  sourceKey: string;
  sourceLabel: string;
  text?: string;
  sourceRef?: string | null;
  commentaries?: CommentaryEntry[];
  sectionIndex?: number | null;
  highlightText?: string | null;
  sectionHtml?: string | null;
  userName?: string;
};

export function createAnnotation(data: CreateAnnotationData): Annotation {
  const db = getDb();
  db.prepare(`
    INSERT INTO annotations
      (id, chelek, siman, source_key, source_label, text, source_ref,
       commentaries, section_index, highlight_text, section_html, user_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    data.id,
    data.chelek,
    data.siman,
    data.sourceKey,
    data.sourceLabel,
    data.text ?? "",
    data.sourceRef ?? null,
    JSON.stringify(data.commentaries ?? []),
    data.sectionIndex ?? null,
    data.highlightText ?? null,
    data.sectionHtml ?? null,
    data.userName ?? "anonymous",
  );
  return getAnnotation(data.id)!;
}

export type UpdateAnnotationData = Partial<{
  sourceLabel: string;
  text: string;
  sourceRef: string | null;
  commentaries: CommentaryEntry[];
  sectionIndex: number | null;
  highlightText: string | null;
  sectionHtml: string | null;
  userName: string;
  status: "pending" | "approved" | "rejected";
}>;

export function updateAnnotation(id: string, data: UpdateAnnotationData): Annotation | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.sourceLabel !== undefined) { fields.push("source_label = ?"); values.push(data.sourceLabel); }
  if (data.text !== undefined) { fields.push("text = ?"); values.push(data.text); }
  if (data.sourceRef !== undefined) { fields.push("source_ref = ?"); values.push(data.sourceRef); }
  if (data.commentaries !== undefined) { fields.push("commentaries = ?"); values.push(JSON.stringify(data.commentaries)); }
  if (data.sectionIndex !== undefined) { fields.push("section_index = ?"); values.push(data.sectionIndex); }
  if (data.highlightText !== undefined) { fields.push("highlight_text = ?"); values.push(data.highlightText); }
  if (data.sectionHtml !== undefined) { fields.push("section_html = ?"); values.push(data.sectionHtml); }
  if (data.userName !== undefined) { fields.push("user_name = ?"); values.push(data.userName); }
  if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }

  if (fields.length === 0) return getAnnotation(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE annotations SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getAnnotation(id);
}

export function deleteAnnotation(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM annotations WHERE id = ?").run(id);
  return result.changes > 0;
}
