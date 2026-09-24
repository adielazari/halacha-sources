import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { AgentDefinition, AgentLanguage, Annotation, Collection, CollectionSiman, CollectionWithSimanim, CommentaryEntry, Excerpt, OrgMode, PracticalPoint } from "./types";

// Increment this whenever the schema changes — forces re-run after HMR reloads
const SCHEMA_VERSION = 7;

const SEED_PRACTICAL_POINTS_PROMPT =
  "אתה עוזר הלכתי. קיבלת את הטקסטים ההלכתיים הגולמיים של הסימן (טור, בית יוסף, שולחן ערוך, ט\"ז, ש\"ך, פתחי תשובה) וכן את קטעי המקורות שהמשתמש כבר בחר ותקצר בעצמו עבור סימן זה. " +
  "המשימה שלך: לחלץ נקודות הלכה למעשה, מדויקות, מעשיות ותכליתיות, בתמצות נפלא, כך שקורא אותן ייקח מהן את הדברים הכי תכלסיים ליישום בחייו. " +
  "כל נקודה צריכה להסתיים בציון המקור שממנו נלקחה, בסוגריים.";

const SEED_TECH_INSIGHTS_PROMPT =
  "אתה יועץ חזוני. בהתבסס על הטקסטים ההלכתיים של הסימן, הצע תובנות מציאותיות וטכנולוגיות: כיצד ניתן להרים ולקדם את קיום ההלכות הללו צעד למעלה בחיי היום-יום — בבית, בבית הכנסת, בעבודה, בלימודים, בצבא, ובכל מקום בארץ ישראל, במדינת ישראל ובעולם. " +
  "הצע רעיונות לפיתוחים טכנולוגיים שיכולים לקדם את העולם התורני, ההלכתי והפרקטי של חיי תורה ומצוות ביום-יום ולאורך זמן, ושייתנו מענה הן לפעולות עכשוויות והן לעניינים עתידיים (כמו חיי המקדש, ימות המשיח, כשתהיה לנו ריבונות מלאה יותר).";

const globalForDb = globalThis as unknown as {
  __db?: Database.Database;
  __dbSchemaVersion?: number;
};

function applySchema(db: Database.Database) {
  // ── Core tables ──────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collections (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      org_mode   TEXT NOT NULL DEFAULT 'free',
      chelek     TEXT,
      topic      TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collection_simanim (
      id            TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL,
      chelek        TEXT NOT NULL,
      siman_number  INTEGER NOT NULL,
      position      INTEGER NOT NULL DEFAULT 0,
      UNIQUE(collection_id, chelek, siman_number)
    );
    CREATE INDEX IF NOT EXISTS idx_coll_simanim ON collection_simanim(collection_id);

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

    CREATE TABLE IF NOT EXISTS documents (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      chelek     TEXT NOT NULL,
      siman      TEXT NOT NULL,
      data       TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, chelek, siman)
    );
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

    CREATE TABLE IF NOT EXISTS agent_definitions (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      model         TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      language      TEXT NOT NULL DEFAULT 'he',
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    -- One row per HalachicBlock (a Shulchan Arukh se'if + its mefaresh
    -- notes) that's been AI-analyzed, for the "לפי סעיפי שו״ע" view.
    -- content_hash is the block's contentHash at generation time — compared
    -- against the live block's current hash to detect staleness (a mefaresh
    -- added later) without ever deleting the previous analysis; a
    -- regenerate just overwrites this row in place.
    CREATE TABLE IF NOT EXISTS block_analyses (
      chelek           TEXT NOT NULL,
      siman            TEXT NOT NULL,
      seif_index       INTEGER NOT NULL,
      content_hash     TEXT NOT NULL,
      summary          TEXT NOT NULL,
      practical_points TEXT NOT NULL DEFAULT '[]',
      created_at       TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (chelek, siman, seif_index)
    );
  `);

  // Seed the two default agents once (idempotent — only runs while the table is empty)
  const agentCount = (db.prepare("SELECT COUNT(*) as c FROM agent_definitions").get() as { c: number }).c;
  if (agentCount === 0) {
    const insertAgent = db.prepare(
      "INSERT INTO agent_definitions (id, name, model, system_prompt, language) VALUES (?, ?, ?, ?, ?)"
    );
    insertAgent.run(crypto.randomUUID(), "נקודות הלכה למעשה", "claude-opus-4-8", SEED_PRACTICAL_POINTS_PROMPT, "he");
    insertAgent.run(crypto.randomUUID(), "תובנות טכנולוגיות ויישומיות", "claude-fable-5", SEED_TECH_INSIGHTS_PROMPT, "he");
  }

  // ── Column migrations ────────────────────────────────────────────────────
  const annCols = db.pragma("table_info(annotations)") as { name: string }[];
  if (!annCols.some((c) => c.name === "user_id")) db.exec("ALTER TABLE annotations ADD COLUMN user_id TEXT");
  if (!annCols.some((c) => c.name === "status")) {
    db.exec("ALTER TABLE annotations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
    const hasApproved = annCols.some((c) => c.name === "approved");
    if (hasApproved) db.exec("UPDATE annotations SET status = CASE WHEN approved = 1 THEN 'approved' ELSE 'pending' END");
  }
}

function getDb(): Database.Database {
  if (!globalForDb.__db) {
    const dbDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const db = new Database(path.join(dbDir, "annotations.db"));
    db.pragma("journal_mode = WAL");
    globalForDb.__db = db;
    globalForDb.__dbSchemaVersion = 0; // force schema run
  }
  // Re-run schema whenever SCHEMA_VERSION changes (catches HMR reloads)
  if (globalForDb.__dbSchemaVersion !== SCHEMA_VERSION) {
    applySchema(globalForDb.__db);
    globalForDb.__dbSchemaVersion = SCHEMA_VERSION;
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
  user_id: string | null;
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
  userId?: string | null;
  status?: "pending" | "approved" | "rejected";
};

export function createAnnotation(data: CreateAnnotationData): Annotation {
  const db = getDb();
  db.prepare(`
    INSERT INTO annotations
      (id, chelek, siman, source_key, source_label, text, source_ref,
       commentaries, section_index, highlight_text, section_html, user_name, user_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.chelek, data.siman, data.sourceKey, data.sourceLabel,
    data.text ?? "", data.sourceRef ?? null,
    JSON.stringify(data.commentaries ?? []),
    data.sectionIndex ?? null, data.highlightText ?? null, data.sectionHtml ?? null,
    data.userName ?? "anonymous", data.userId ?? null, data.status ?? "pending",
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

// ── Documents (per-siman personal study document / "summary") ──────────────────

export type SavedDocument = {
  id: string;
  userId: string;
  chelek: string;
  siman: string;
  excerpts: Excerpt[];
  expandedPanels: Record<string, boolean>;
  updatedAt: string;
};

type DocumentRow = {
  id: string;
  user_id: string;
  chelek: string;
  siman: string;
  data: string;
  updated_at: string;
};

function rowToDocument(row: DocumentRow): SavedDocument {
  let parsed: { excerpts?: Excerpt[]; expandedPanels?: Record<string, boolean> } = {};
  try { parsed = JSON.parse(row.data); } catch { /* empty */ }
  return {
    id: row.id,
    userId: row.user_id,
    chelek: row.chelek,
    siman: row.siman,
    excerpts: parsed.excerpts ?? [],
    expandedPanels: parsed.expandedPanels ?? {},
    updatedAt: row.updated_at,
  };
}

export function getDocument(userId: string, chelek: string, siman: string): SavedDocument | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM documents WHERE user_id = ? AND chelek = ? AND siman = ?"
  ).get(userId, chelek, siman) as DocumentRow | undefined;
  return row ? rowToDocument(row) : null;
}

export function saveDocument(data: {
  userId: string;
  chelek: string;
  siman: string;
  excerpts: Excerpt[];
  expandedPanels: Record<string, boolean>;
}): SavedDocument {
  const db = getDb();
  const payload = JSON.stringify({ excerpts: data.excerpts, expandedPanels: data.expandedPanels });
  db.prepare(`
    INSERT INTO documents (id, user_id, chelek, siman, data, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, chelek, siman)
    DO UPDATE SET data = excluded.data, updated_at = datetime('now')
  `).run(crypto.randomUUID(), data.userId, data.chelek, data.siman, payload);
  return getDocument(data.userId, data.chelek, data.siman)!;
}

// ── Agent definitions ───────────────────────────────────────────────────────

type AgentDefinitionRow = {
  id: string;
  name: string;
  model: string;
  system_prompt: string;
  language: string;
  created_at: string;
  updated_at: string;
};

function rowToAgentDefinition(row: AgentDefinitionRow): AgentDefinition {
  return {
    id: row.id,
    name: row.name,
    model: row.model,
    systemPrompt: row.system_prompt,
    language: (row.language === "en" ? "en" : "he") as AgentLanguage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllAgentDefinitions(): AgentDefinition[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM agent_definitions ORDER BY created_at ASC").all() as AgentDefinitionRow[];
  return rows.map(rowToAgentDefinition);
}

export function getAgentDefinition(id: string): AgentDefinition | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM agent_definitions WHERE id = ?").get(id) as AgentDefinitionRow | undefined;
  return row ? rowToAgentDefinition(row) : null;
}

export function createAgentDefinition(data: {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  language?: AgentLanguage;
}): AgentDefinition {
  const db = getDb();
  db.prepare(
    "INSERT INTO agent_definitions (id, name, model, system_prompt, language) VALUES (?, ?, ?, ?, ?)"
  ).run(data.id, data.name, data.model, data.systemPrompt, data.language ?? "he");
  return getAgentDefinition(data.id)!;
}

export function updateAgentDefinition(
  id: string,
  data: Partial<{ name: string; model: string; systemPrompt: string; language: AgentLanguage }>
): AgentDefinition | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.model !== undefined) { fields.push("model = ?"); values.push(data.model); }
  if (data.systemPrompt !== undefined) { fields.push("system_prompt = ?"); values.push(data.systemPrompt); }
  if (data.language !== undefined) { fields.push("language = ?"); values.push(data.language); }

  if (fields.length === 0) return getAgentDefinition(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE agent_definitions SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getAgentDefinition(id);
}

export function deleteAgentDefinition(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM agent_definitions WHERE id = ?").run(id);
  return result.changes > 0;
}

// ── Block analyses (AI summary + practical points per HalachicBlock) ───────────

export type BlockAnalysisRow = {
  chelek: string;
  siman: string;
  seifIndex: number;
  contentHash: string;
  summary: string;
  practicalPoints: PracticalPoint[];
  createdAt: string;
};

type BlockAnalysisDbRow = {
  chelek: string;
  siman: string;
  seif_index: number;
  content_hash: string;
  summary: string;
  practical_points: string;
  created_at: string;
};

function rowToBlockAnalysis(row: BlockAnalysisDbRow): BlockAnalysisRow {
  let practicalPoints: PracticalPoint[] = [];
  try { practicalPoints = JSON.parse(row.practical_points) as PracticalPoint[]; } catch { /* empty */ }
  return {
    chelek: row.chelek,
    siman: row.siman,
    seifIndex: row.seif_index,
    contentHash: row.content_hash,
    summary: row.summary,
    practicalPoints,
    createdAt: row.created_at,
  };
}

export function getBlockAnalyses(chelek: string, siman: string): BlockAnalysisRow[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM block_analyses WHERE chelek = ? AND siman = ?"
  ).all(chelek, siman) as BlockAnalysisDbRow[];
  return rows.map(rowToBlockAnalysis);
}

export function upsertBlockAnalysis(data: {
  chelek: string;
  siman: string;
  seifIndex: number;
  contentHash: string;
  summary: string;
  practicalPoints: PracticalPoint[];
}): BlockAnalysisRow {
  const db = getDb();
  db.prepare(`
    INSERT INTO block_analyses (chelek, siman, seif_index, content_hash, summary, practical_points, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(chelek, siman, seif_index)
    DO UPDATE SET content_hash = excluded.content_hash, summary = excluded.summary,
                  practical_points = excluded.practical_points, created_at = datetime('now')
  `).run(
    data.chelek, data.siman, data.seifIndex, data.contentHash,
    data.summary, JSON.stringify(data.practicalPoints)
  );
  const row = db.prepare(
    "SELECT * FROM block_analyses WHERE chelek = ? AND siman = ? AND seif_index = ?"
  ).get(data.chelek, data.siman, data.seifIndex) as BlockAnalysisDbRow;
  return rowToBlockAnalysis(row);
}

// ── Users ─────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  role: "user" | "admin";
  createdAt: string;
};

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { id: row.id as string, name: row.name as string, email: row.email as string, passwordHash: row.password_hash as string | null, role: row.role as "user" | "admin", createdAt: row.created_at as string };
}

// The single local profile: oldest admin, else oldest user (see lib/localSession.ts).
export function getPrimaryUser(): User | null {
  const db = getDb();
  const row = db.prepare("SELECT id FROM users ORDER BY (role = 'admin') DESC, created_at ASC LIMIT 1").get() as { id: string } | undefined;
  return row ? getUserById(row.id) : null;
}

export function createUser(user: { id: string; name: string; email: string; passwordHash: string | null; role: "user" | "admin" }): User {
  const db = getDb();
  db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)").run(user.id, user.name, user.email, user.passwordHash, user.role);
  return getUserById(user.id)!;
}

// ── Collections ───────────────────────────────────────────────────────────────

function rowToCollection(row: Record<string, unknown>): Collection {
  return {
    id: row.id as string,
    name: row.name as string,
    userId: row.user_id as string,
    orgMode: row.org_mode as OrgMode,
    chelek: row.chelek as string | null,
    topic: row.topic as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToCollectionSiman(row: Record<string, unknown>): CollectionSiman {
  return {
    id: row.id as string,
    collectionId: row.collection_id as string,
    chelek: row.chelek as string,
    simanNumber: row.siman_number as number,
    position: row.position as number,
  };
}

export function createCollection(data: { id: string; name: string; userId: string; orgMode: OrgMode; chelek?: string | null; topic?: string | null }): Collection {
  const db = getDb();
  db.prepare("INSERT INTO collections (id, name, user_id, org_mode, chelek, topic) VALUES (?, ?, ?, ?, ?, ?)").run(data.id, data.name, data.userId, data.orgMode, data.chelek ?? null, data.topic ?? null);
  return db.prepare("SELECT * FROM collections WHERE id = ?").get(data.id) as Collection;
}

export function getCollection(id: string): Collection | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM collections WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToCollection(row) : null;
}

export function getCollectionWithSimanim(id: string): CollectionWithSimanim | null {
  const coll = getCollection(id);
  if (!coll) return null;
  const simanim = getCollectionSimanim(id);
  return { ...coll, simanim };
}

export function getUserCollections(userId: string): Collection[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM collections WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as Record<string, unknown>[];
  return rows.map(rowToCollection);
}

export function updateCollection(id: string, data: Partial<{ name: string; orgMode: OrgMode; chelek: string | null; topic: string | null }>): Collection | null {
  const db = getDb();
  const fields: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.unshift("name = ?"); values.push(data.name); }
  if (data.orgMode !== undefined) { fields.unshift("org_mode = ?"); values.push(data.orgMode); }
  if (data.chelek !== undefined) { fields.unshift("chelek = ?"); values.push(data.chelek); }
  if (data.topic !== undefined) { fields.unshift("topic = ?"); values.push(data.topic); }
  values.push(id);
  db.prepare(`UPDATE collections SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getCollection(id);
}

export function deleteCollection(id: string): boolean {
  const db = getDb();
  db.prepare("DELETE FROM collection_simanim WHERE collection_id = ?").run(id);
  const result = db.prepare("DELETE FROM collections WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getCollectionSimanim(collectionId: string): CollectionSiman[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM collection_simanim WHERE collection_id = ? ORDER BY position ASC, siman_number ASC").all(collectionId) as Record<string, unknown>[];
  return rows.map(rowToCollectionSiman);
}

export function addSimanToCollection(data: { id: string; collectionId: string; chelek: string; simanNumber: number; position: number }): CollectionSiman | null {
  const db = getDb();
  try {
    db.prepare("INSERT INTO collection_simanim (id, collection_id, chelek, siman_number, position) VALUES (?, ?, ?, ?, ?)").run(data.id, data.collectionId, data.chelek, data.simanNumber, data.position);
    db.prepare("UPDATE collections SET updated_at = datetime('now') WHERE id = ?").run(data.collectionId);
    return db.prepare("SELECT * FROM collection_simanim WHERE id = ?").get(data.id) as CollectionSiman;
  } catch {
    return null;
  }
}

export function removeSimanFromCollection(collectionId: string, chelek: string, simanNumber: number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM collection_simanim WHERE collection_id = ? AND chelek = ? AND siman_number = ?").run(collectionId, chelek, simanNumber);
  if (result.changes > 0) db.prepare("UPDATE collections SET updated_at = datetime('now') WHERE id = ?").run(collectionId);
  return result.changes > 0;
}

export function reorderCollectionSimanim(collectionId: string, orderedIds: string[]): void {
  const db = getDb();
  const update = db.prepare("UPDATE collection_simanim SET position = ? WHERE id = ? AND collection_id = ?");
  const tx = db.transaction(() => {
    orderedIds.forEach((id, i) => update.run(i, id, collectionId));
    db.prepare("UPDATE collections SET updated_at = datetime('now') WHERE id = ?").run(collectionId);
  });
  tx();
}

export function getAnnotationCountsByChelek(chelek: string): { siman: string; count: number }[] {
  const db = getDb();
  const rows = db.prepare("SELECT siman, COUNT(*) as count FROM annotations WHERE chelek = ? AND status = 'approved' GROUP BY siman ORDER BY count DESC").all(chelek) as { siman: string; count: number }[];
  return rows;
}
