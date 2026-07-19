import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { AgentDefinition, AgentLanguage, Annotation, Collection, CollectionSiman, CollectionWithSimanim, CommentaryEntry, Excerpt, Group, GroupMember, GroupRole, GroupSiman, GroupWithDetails, OrgMode } from "./types";

// Increment this whenever the schema changes — forces re-run after HMR reloads
const SCHEMA_VERSION = 6;

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

    CREATE TABLE IF NOT EXISTS invitations (
      id         TEXT PRIMARY KEY,
      token      TEXT UNIQUE NOT NULL,
      email      TEXT,
      invited_by TEXT NOT NULL,
      used_by    TEXT,
      used_at    TEXT,
      created_at TEXT DEFAULT (datetime('now'))
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

  // ── Groups (v2: no password, name not unique, join requests) ─────────────
  // Migrate old groups table if it had password_hash
  const groupCols = db.pragma("table_info(groups)") as { name: string }[];
  if (groupCols.some((c) => c.name === "password_hash")) {
    db.exec(`
      ALTER TABLE groups RENAME TO groups_old;
      DROP TABLE IF EXISTS group_members;
      DROP TABLE IF EXISTS group_simanim;
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id        TEXT PRIMARY KEY,
      group_id  TEXT NOT NULL,
      user_id   TEXT NOT NULL,
      role      TEXT NOT NULL DEFAULT 'read',
      joined_at TEXT DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_gm_user  ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_gm_group ON group_members(group_id);

    CREATE TABLE IF NOT EXISTS group_join_requests (
      id           TEXT PRIMARY KEY,
      group_id     TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_gjr_group ON group_join_requests(group_id);

    CREATE TABLE IF NOT EXISTS group_simanim (
      id           TEXT PRIMARY KEY,
      group_id     TEXT NOT NULL,
      chelek       TEXT NOT NULL,
      siman_number INTEGER NOT NULL,
      added_by     TEXT NOT NULL,
      added_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(group_id, chelek, siman_number)
    );
    CREATE INDEX IF NOT EXISTS idx_gs_group ON group_simanim(group_id);
  `);

  // Clean up old groups table after migration
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='groups_old'").get()) as { name: string } | undefined;
  if (tables) db.exec("DROP TABLE groups_old");

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

// ── Users ─────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  role: "user" | "admin";
  createdAt: string;
};

export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { id: row.id as string, name: row.name as string, email: row.email as string, passwordHash: row.password_hash as string | null, role: row.role as "user" | "admin", createdAt: row.created_at as string };
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { id: row.id as string, name: row.name as string, email: row.email as string, passwordHash: row.password_hash as string | null, role: row.role as "user" | "admin", createdAt: row.created_at as string };
}

export function getAllUsers(): User[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map((row) => ({ id: row.id as string, name: row.name as string, email: row.email as string, passwordHash: row.password_hash as string | null, role: row.role as "user" | "admin", createdAt: row.created_at as string }));
}

export function createUser(user: { id: string; name: string; email: string; passwordHash: string | null; role: "user" | "admin" }): User {
  const db = getDb();
  db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)").run(user.id, user.name, user.email, user.passwordHash, user.role);
  return getUserById(user.id)!;
}

export function updateUserRole(id: string, role: "user" | "admin"): void {
  const db = getDb();
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

export function hasAnyUser(): boolean {
  const db = getDb();
  const row = db.prepare("SELECT id FROM users LIMIT 1").get();
  return !!row;
}

// ── Invitations ───────────────────────────────────────────────────────────────

export type Invitation = {
  id: string;
  token: string;
  email: string | null;
  invitedBy: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
};

export function createInvitation(inv: { id: string; token: string; email: string | null; invitedBy: string }): Invitation {
  const db = getDb();
  db.prepare("INSERT INTO invitations (id, token, email, invited_by) VALUES (?, ?, ?, ?)").run(inv.id, inv.token, inv.email, inv.invitedBy);
  return getInvitationByToken(inv.token)!;
}

export function getInvitationByToken(token: string): Invitation | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM invitations WHERE token = ?").get(token) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { id: row.id as string, token: row.token as string, email: row.email as string | null, invitedBy: row.invited_by as string, usedBy: row.used_by as string | null, usedAt: row.used_at as string | null, createdAt: row.created_at as string };
}

export function markInvitationUsed(token: string, userId: string): void {
  const db = getDb();
  db.prepare("UPDATE invitations SET used_by = ?, used_at = datetime('now') WHERE token = ?").run(userId, token);
}

export function getAllInvitations(): Invitation[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM invitations ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map((row) => ({ id: row.id as string, token: row.token as string, email: row.email as string | null, invitedBy: row.invited_by as string, usedBy: row.used_by as string | null, usedAt: row.used_at as string | null, createdAt: row.created_at as string }));
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

// ── Groups ────────────────────────────────────────────────────────────────────

function randomId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function rowToGroup(r: Record<string, unknown>): Group {
  return { id: r.id as string, name: r.name as string, createdBy: r.created_by as string, createdAt: r.created_at as string };
}
function rowToGroupMember(r: Record<string, unknown>): GroupMember {
  return { id: r.id as string, groupId: r.group_id as string, userId: r.user_id as string, userName: r.user_name as string, role: r.role as GroupRole, joinedAt: r.joined_at as string };
}
function rowToGroupSiman(r: Record<string, unknown>): GroupSiman {
  return { id: r.id as string, groupId: r.group_id as string, chelek: r.chelek as string, simanNumber: r.siman_number as number, addedBy: r.added_by as string, addedAt: r.added_at as string };
}

export function createGroup(data: { id: string; name: string; createdBy: string }): Group {
  const db = getDb();
  db.prepare("INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)").run(data.id, data.name, data.createdBy);
  db.prepare("INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'owner')").run(randomId(), data.id, data.createdBy);
  return getGroupById(data.id)!;
}

export function getGroupById(id: string): Group | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM groups WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToGroup(row) : null;
}

export function searchGroupsByName(name: string): Group[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM groups WHERE name LIKE ? ORDER BY created_at DESC LIMIT 20").all(`%${name}%`) as Record<string, unknown>[];
  return rows.map(rowToGroup);
}

export function getUserGroups(userId: string): (Group & { myRole: GroupRole; pendingRequests: number })[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT g.*, gm.role as my_role,
      (SELECT COUNT(*) FROM group_join_requests gjr WHERE gjr.group_id = g.id AND gjr.status = 'pending') as pending_requests
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `).all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({ ...rowToGroup(r), myRole: r.my_role as GroupRole, pendingRequests: r.pending_requests as number }));
}

export function getGroupWithDetails(id: string, userId: string): GroupWithDetails | null {
  const grp = getGroupById(id);
  if (!grp) return null;
  const db = getDb();
  const memberRows = db.prepare(`
    SELECT gm.*, u.name as user_name FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ? ORDER BY gm.joined_at ASC
  `).all(id) as Record<string, unknown>[];
  const members = memberRows.map(rowToGroupMember);
  const simanRows = db.prepare("SELECT * FROM group_simanim WHERE group_id = ? ORDER BY added_at ASC").all(id) as Record<string, unknown>[];
  const simanim = simanRows.map(rowToGroupSiman);
  const myMember = members.find((m) => m.userId === userId);
  if (!myMember) return null;
  return { ...grp, members, simanim, myRole: myMember.role };
}

export function getGroupMember(groupId: string, userId: string): GroupMember | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT gm.*, u.name as user_name FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ? AND gm.user_id = ?
  `).get(groupId, userId) as Record<string, unknown> | undefined;
  return row ? rowToGroupMember(row) : null;
}

export function addGroupMember(data: { id: string; groupId: string; userId: string; role: GroupRole }): void {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, ?)").run(data.id, data.groupId, data.userId, data.role);
}

export function updateGroupMemberRole(groupId: string, userId: string, role: GroupRole): void {
  getDb().prepare("UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?").run(role, groupId, userId);
}

export function removeGroupMember(groupId: string, userId: string): void {
  getDb().prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").run(groupId, userId);
}

export function deleteGroup(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM group_join_requests WHERE group_id = ?").run(id);
  db.prepare("DELETE FROM group_members WHERE group_id = ?").run(id);
  db.prepare("DELETE FROM group_simanim WHERE group_id = ?").run(id);
  db.prepare("DELETE FROM groups WHERE id = ?").run(id);
}

// ── Join requests ─────────────────────────────────────────────────────────────

export type JoinRequest = {
  id: string; groupId: string; userId: string; userName: string;
  userEmail: string; status: "pending" | "approved" | "rejected"; requestedAt: string;
};

function rowToJoinRequest(r: Record<string, unknown>): JoinRequest {
  return { id: r.id as string, groupId: r.group_id as string, userId: r.user_id as string, userName: r.user_name as string, userEmail: r.user_email as string, status: r.status as JoinRequest["status"], requestedAt: r.requested_at as string };
}

export function createJoinRequest(data: { id: string; groupId: string; userId: string }): "ok" | "already_member" | "already_requested" {
  const db = getDb();
  if (getGroupMember(data.groupId, data.userId)) return "already_member";
  try {
    db.prepare("INSERT INTO group_join_requests (id, group_id, user_id) VALUES (?, ?, ?)").run(data.id, data.groupId, data.userId);
    return "ok";
  } catch { return "already_requested"; }
}

export function getPendingJoinRequests(groupId: string): JoinRequest[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT gjr.*, u.name as user_name, u.email as user_email
    FROM group_join_requests gjr JOIN users u ON gjr.user_id = u.id
    WHERE gjr.group_id = ? AND gjr.status = 'pending'
    ORDER BY gjr.requested_at ASC
  `).all(groupId) as Record<string, unknown>[];
  return rows.map(rowToJoinRequest);
}

export function getUserPendingRequests(userId: string): (JoinRequest & { groupName: string })[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT gjr.*, u.name as user_name, u.email as user_email, g.name as group_name
    FROM group_join_requests gjr
    JOIN users u ON gjr.user_id = u.id
    JOIN groups g ON gjr.group_id = g.id
    WHERE gjr.user_id = ? AND gjr.status = 'pending'
    ORDER BY gjr.requested_at DESC
  `).all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({ ...rowToJoinRequest(r), groupName: r.group_name as string }));
}

export function processJoinRequest(requestId: string, action: "approved" | "rejected"): void {
  const db = getDb();
  const req = db.prepare("SELECT * FROM group_join_requests WHERE id = ?").get(requestId) as Record<string, unknown> | undefined;
  if (!req) return;
  db.prepare("UPDATE group_join_requests SET status = ? WHERE id = ?").run(action, requestId);
  if (action === "approved") {
    db.prepare("INSERT OR IGNORE INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'read')").run(randomId(), req.group_id, req.user_id);
  }
}

// ── Group simanim ─────────────────────────────────────────────────────────────

export function addSimanToGroup(data: { id: string; groupId: string; chelek: string; simanNumber: number; addedBy: string }): boolean {
  try {
    getDb().prepare("INSERT INTO group_simanim (id, group_id, chelek, siman_number, added_by) VALUES (?, ?, ?, ?, ?)").run(data.id, data.groupId, data.chelek, data.simanNumber, data.addedBy);
    return true;
  } catch { return false; }
}

export function removeSimanFromGroup(groupId: string, chelek: string, simanNumber: number): void {
  getDb().prepare("DELETE FROM group_simanim WHERE group_id = ? AND chelek = ? AND siman_number = ?").run(groupId, chelek, simanNumber);
}

export function getGroupsForSiman(userId: string, chelek: string, simanNumber: number): (GroupSiman & { groupName: string; myRole: GroupRole })[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT gs.*, g.name as group_name, gm.role as my_role
    FROM group_simanim gs
    JOIN groups g ON gs.group_id = g.id
    JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
    WHERE gs.chelek = ? AND gs.siman_number = ?
  `).all(userId, chelek, simanNumber) as Record<string, unknown>[];
  return rows.map((r) => ({ ...rowToGroupSiman(r), groupName: r.group_name as string, myRole: r.my_role as GroupRole }));
}

export function getGroupMemberUserIds(groupId: string): string[] {
  return (getDb().prepare("SELECT user_id FROM group_members WHERE group_id = ?").all(groupId) as { user_id: string }[]).map((r) => r.user_id);
}

// ── User search (for owner inviting members) ──────────────────────────────────

export function searchUsers(query: string, excludeUserIds: string[]): { id: string; name: string; email: string }[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, name, email FROM users
    WHERE (name LIKE ? OR email LIKE ?)
    ORDER BY name ASC LIMIT 10
  `).all(`%${query}%`, `%${query}%`) as { id: string; name: string; email: string }[];
  return rows.filter((u) => !excludeUserIds.includes(u.id));
}
