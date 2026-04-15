# Admin Panel + User Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add localStorage-based user switching and an admin panel for approving/rejecting annotation proposals before they appear as highlights to all users.

**Architecture:** Replace the `approved boolean` column with a `status` text column (`pending|approved|rejected`). New annotations default to `pending` and show only to their creator. A `/admin` page lets the admin approve/reject pending annotations and browse history. Users switch identity via `/user1`, `/user2` etc. which sets `localStorage.currentUser`.

**Tech Stack:** Next.js 14 App Router, TypeScript, better-sqlite3, Tailwind CSS, Zustand (not changed here)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/types.ts` | Modify | Replace `approved: boolean` → `status: "pending"\|"approved"\|"rejected"` |
| `lib/db.ts` | Modify | DB migration, updated CRUD to use `status` |
| `lib/userContext.tsx` | Create | React context: `currentUser` + `setCurrentUser` via localStorage |
| `lib/highlightAnnotations.ts` | Modify | Add `currentUser` param, filter by visibility |
| `app/providers.tsx` | Create | Client wrapper for `UserProvider` (layout can't be client) |
| `app/layout.tsx` | Modify | Wrap `{children}` with `<Providers>` |
| `app/[username]/page.tsx` | Create | Set user in localStorage, redirect to `/` |
| `app/admin/page.tsx` | Create | Two-tab admin panel: pending queue + history |
| `app/api/annotations/route.ts` | Modify | GET supports `?status=`, POST saves `status='pending'` |
| `app/api/annotations/[id]/route.ts` | Modify | PATCH accepts `{ status }` |
| `app/api/annotations/admin/route.ts` | Create | Returns all annotations (no chelek/siman filter) |
| `app/siman/[chelek]/[number]/page.tsx` | Modify | Read `currentUser`, pass to POST, fetch `?status=all` |
| `components/TextPanel.tsx` | Modify | Accept `currentUser` prop, pass to `highlightAnnotations` |

---

## Task 1: Update `Annotation` type + DB layer

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/db.ts`

- [ ] **Step 1: Update `Annotation` type in `lib/types.ts`**

Replace `approved: boolean` with `status`:

```typescript
export type Annotation = {
  id: string;
  chelek: string;
  siman: string;
  sourceKey: string;
  sourceLabel: string;
  text: string;
  sourceRef: string | null;
  commentaries: CommentaryEntry[];
  sectionIndex: number | null;
  highlightText: string | null;
  sectionHtml: string | null;
  userName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Rewrite `lib/db.ts`**

Replace the entire file with the following. Key changes: schema adds `status` column, removes `approved`; migration runs on startup for existing DBs; `rowToAnnotation`, `createAnnotation`, `updateAnnotation`, and `getAllAnnotations` are all updated.

```typescript
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

    // Create table (new installs: status column included from the start)
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
```

- [ ] **Step 3: TypeScript check**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only from files that still reference `approved` (Task 4 will fix them).

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/db.ts
git commit -m "feat: replace approved boolean with status field in Annotation type + DB"
```

---

## Task 2: Update API routes

**Files:**
- Modify: `app/api/annotations/route.ts`
- Modify: `app/api/annotations/[id]/route.ts`
- Create: `app/api/annotations/admin/route.ts`

- [ ] **Step 1: Update `app/api/annotations/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAllAnnotations, createAnnotation } from "@/lib/db";
import type { CommentaryEntry } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chelek = searchParams.get("chelek");
  const siman = searchParams.get("siman");
  const status = searchParams.get("status") ?? "approved";

  if (!chelek || !siman) {
    return NextResponse.json(
      { error: "chelek and siman are required" },
      { status: 400 }
    );
  }

  try {
    const annotations = getAllAnnotations(chelek, siman, status);
    return NextResponse.json({ annotations });
  } catch (err) {
    console.error("GET /api/annotations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
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

    if (!body.chelek || !body.siman || !body.sourceKey || !body.sourceLabel) {
      return NextResponse.json(
        { error: "Missing required fields: chelek, siman, sourceKey, sourceLabel" },
        { status: 400 }
      );
    }

    const annotation = createAnnotation({
      id: crypto.randomUUID(),
      ...body,
    });

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (err) {
    console.error("POST /api/annotations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update `app/api/annotations/[id]/route.ts`**

Replace `UpdateAnnotationData` usage — the `status` field is already part of `UpdateAnnotationData` after Task 1. The only change needed is removing the old `approved` reference:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { updateAnnotation, deleteAnnotation } from "@/lib/db";
import type { UpdateAnnotationData } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json() as UpdateAnnotationData;
    const annotation = updateAnnotation(params.id, body);

    if (!annotation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ annotation });
  } catch (err) {
    console.error("PATCH /api/annotations/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ok = deleteAnnotation(params.id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/annotations/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `app/api/annotations/admin/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAllAnnotationsAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all";

  try {
    const annotations = getAllAnnotationsAdmin(status);
    return NextResponse.json({ annotations });
  } catch (err) {
    console.error("GET /api/annotations/admin error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: TypeScript check**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add app/api/annotations/route.ts app/api/annotations/[id]/route.ts app/api/annotations/admin/route.ts
git commit -m "feat: update annotation API routes for status-based filtering + admin endpoint"
```

---

## Task 3: User context + routing

**Files:**
- Create: `lib/userContext.tsx`
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx`
- Create: `app/[username]/page.tsx`

- [ ] **Step 1: Create `lib/userContext.tsx`**

```typescript
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type UserContextType = {
  currentUser: string;
  setCurrentUser: (name: string) => void;
};

const UserContext = createContext<UserContextType>({
  currentUser: "anonymous",
  setCurrentUser: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState("anonymous");

  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (stored) setCurrentUserState(stored);
  }, []);

  function setCurrentUser(name: string) {
    localStorage.setItem("currentUser", name);
    setCurrentUserState(name);
  }

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
```

- [ ] **Step 2: Create `app/providers.tsx`**

`app/layout.tsx` is a server component and cannot directly import client context. This thin wrapper keeps the layout clean:

```typescript
"use client";

import { UserProvider } from "@/lib/userContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}
```

- [ ] **Step 3: Modify `app/layout.tsx`**

```typescript
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "בית יוסף — בונה מקורות",
  description: "סייר מקורות בית יוסף",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-amber-50 text-gray-800 font-hebrew">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create `app/[username]/page.tsx`**

Note: Next.js static routes (`/admin`, `/siman`, `/api`) take priority over this dynamic route, so there is no conflict.

```typescript
"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/lib/userContext";

export default function UserSwitchPage() {
  const params = useParams<{ username: string }>();
  const { setCurrentUser } = useUser();
  const router = useRouter();

  useEffect(() => {
    setCurrentUser(params.username);
    router.replace("/");
  }, [params.username, setCurrentUser, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50" dir="rtl">
      <p className="text-gray-500 text-sm">מחליף משתמש...</p>
    </div>
  );
}
```

- [ ] **Step 5: TypeScript check**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 6: Commit**

```bash
git add lib/userContext.tsx app/providers.tsx app/layout.tsx "app/[username]/page.tsx"
git commit -m "feat: add localStorage user context + user switching route"
```

---

## Task 4: Wire user into highlight visibility + annotation saving

**Files:**
- Modify: `lib/highlightAnnotations.ts`
- Modify: `components/TextPanel.tsx`
- Modify: `app/siman/[chelek]/[number]/page.tsx`

- [ ] **Step 1: Update `lib/highlightAnnotations.ts`**

Add `currentUser` param. A highlight is shown if the annotation is approved, OR if the current user created it (so the creator always sees their own pending highlights).

```typescript
import type { Annotation } from "./types";

export function highlightAnnotations(
  html: string,
  annotations: Annotation[],
  sourceKey: string,
  sectionIndex?: number,
  currentUser?: string
): string {
  const relevant = annotations.filter(
    (a) =>
      a.sourceKey === sourceKey &&
      a.highlightText &&
      (sectionIndex === undefined || a.sectionIndex === sectionIndex) &&
      (a.status === "approved" || (currentUser !== undefined && a.userName === currentUser))
  );

  let result = html;
  for (const ann of relevant) {
    const ht = ann.highlightText!;
    const escaped = ht.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(escaped, "g"),
      `<mark data-annotation-id="${ann.id}" class="bg-yellow-200 rounded px-0.5 cursor-pointer hover:bg-yellow-300 transition-colors">${ht}</mark>`
    );
  }
  return result;
}
```

- [ ] **Step 2: Update `components/TextPanel.tsx`**

Add `currentUser?: string` prop, pass it through to both `highlightAnnotations` calls:

```typescript
"use client";

import type { Annotation } from "@/lib/types";
import { highlightAnnotations } from "@/lib/highlightAnnotations";

interface Section {
  index: number;
  label?: string;
  html: string;
}

interface TextPanelProps {
  title: string;
  hexColor: string;
  sourceKey: string;
  expanded: boolean;
  onToggle: () => void;
  sections?: Section[];
  html?: string;
  annotations?: Annotation[];
  currentUser?: string;
  onSectionClick?: (sourceKey: string, sectionIndex: number, label: string) => void;
}

export default function TextPanel({
  title,
  hexColor,
  sourceKey,
  expanded,
  onToggle,
  sections,
  html,
  annotations,
  currentUser,
  onSectionClick,
}: TextPanelProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-right select-none hover:brightness-95 transition"
        style={{ backgroundColor: hexColor + "18" }}
      >
        <span className="text-xs font-bold flex-shrink-0" style={{ color: hexColor }}>
          {expanded ? "▼" : "▶"}
        </span>
        <span className="font-bold text-gray-800 flex-1 text-right">{title}</span>
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: hexColor }}
        />
      </button>

      {expanded && (
        <div className="p-4 bg-white max-h-[55vh] overflow-y-auto">
          {html !== undefined ? (
            <div
              data-source-key={sourceKey}
              className="text-sm leading-loose text-gray-800"
              dir="rtl"
              dangerouslySetInnerHTML={{
                __html: highlightAnnotations(html, annotations ?? [], sourceKey, undefined, currentUser),
              }}
            />
          ) : sections && sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map((sec) => (
                <div
                  key={sec.index}
                  className="border-b border-gray-100 last:border-0 pb-3 last:pb-0"
                >
                  <div
                    data-source-key={sourceKey}
                    data-section-index={sec.index}
                    className="text-sm leading-loose text-gray-800"
                    dir="rtl"
                  >
                    {sec.label && (
                      onSectionClick && sourceKey === "shulchanArukh" ? (
                        <button
                          onClick={() => onSectionClick(sourceKey, sec.index, sec.label!)}
                          className="text-xs font-bold hover:underline cursor-pointer transition-opacity hover:opacity-70"
                          style={{ color: hexColor }}
                          title="הוסף ככותרת"
                        >
                          {sec.label}{" "}
                        </button>
                      ) : (
                        <strong className="text-xs font-bold" style={{ color: hexColor }}>
                          {sec.label}{" "}
                        </strong>
                      )
                    )}
                    <span
                      dangerouslySetInnerHTML={{
                        __html: highlightAnnotations(
                          sec.html,
                          annotations ?? [],
                          sourceKey,
                          sec.index,
                          currentUser
                        ),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">אין טקסט זמין</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `app/siman/[chelek]/[number]/page.tsx`**

Three changes:
1. Import `useUser` and read `currentUser`
2. In the annotations fetch effect, change `?` params to include `status=all` (so the client gets all statuses and `highlightAnnotations` filters by visibility)
3. Pass `currentUser` to the POST body and to each `TextPanel`

Read the file first, then apply these targeted changes:

**a) Add import at top of file (after other imports):**
```typescript
import { useUser } from "@/lib/userContext";
```

**b) Inside the component, after `useStore()` destructuring, add:**
```typescript
const { currentUser } = useUser();
```

**c) In the `useEffect` that fetches annotations (find the fetch call to `/api/annotations`):**

Change:
```typescript
const res = await fetch(`/api/annotations?chelek=${chelek}&siman=${number}`);
```
To:
```typescript
const res = await fetch(`/api/annotations?chelek=${chelek}&siman=${number}&status=all`);
```

**d) In `handleAdd` and `handleAddPulledSource` where the fire-and-forget POST happens, add `userName: currentUser` to the body:**

Find the `fetch("/api/annotations", { method: "POST", ... body: JSON.stringify({...})` calls and add `userName: currentUser` to the JSON body object.

**e) In the JSX where `TextPanel` components are rendered, add `currentUser={currentUser}` prop to each `<TextPanel>` instance.**

- [ ] **Step 4: TypeScript check**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit 2>&1 | head -40
```

Expected: clean (0 errors).

- [ ] **Step 5: Commit**

```bash
git add lib/highlightAnnotations.ts components/TextPanel.tsx "app/siman/[chelek]/[number]/page.tsx"
git commit -m "feat: wire currentUser into highlight visibility + annotation saving"
```

---

## Task 5: Admin page

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Create `app/admin/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/userContext";
import type { Annotation } from "@/lib/types";

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim: "אורח חיים",
  YorehDeah: "יורה דעה",
  EvenHaEzer: "אבן העזר",
  ChoshenMishpat: "חושן משפט",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  approved: "מאושר",
  rejected: "נדחה",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

type Tab = "pending" | "history";
type HistoryFilter = "all" | "pending" | "approved" | "rejected";

export default function AdminPage() {
  const { setCurrentUser } = useUser();

  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  // Set admin identity on mount
  useEffect(() => {
    setCurrentUser("admin");
  }, [setCurrentUser]);

  // Fetch pending on mount and when tab switches to pending
  useEffect(() => {
    if (tab !== "pending") return;
    setLoading(true);
    fetch("/api/annotations/admin?status=pending")
      .then((r) => r.json())
      .then((d) => setPending(d.annotations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  // Fetch history when switching to history tab
  useEffect(() => {
    if (tab !== "history") return;
    setLoading(true);
    fetch("/api/annotations/admin?status=all")
      .then((r) => r.json())
      .then((d) => setHistory(d.annotations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  async function handleAction(id: string, status: "approved" | "rejected") {
    setActionInFlight(id);
    try {
      await fetch(`/api/annotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      // Optimistic removal from pending list
      setPending((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // silent — item stays in list, user can retry
    } finally {
      setActionInFlight(null);
    }
  }

  const filteredHistory =
    historyFilter === "all"
      ? history
      : history.filter((a) => a.status === historyFilter);

  return (
    <div className="min-h-screen bg-amber-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <h1 className="text-lg font-bold text-gray-800">פאנל ניהול</h1>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">admin</span>
        <div className="flex-1" />
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">← ראשי</a>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {(["pending", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
                tab === t
                  ? "border-amber-600 text-amber-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "pending" ? "ממתינים לאישור" : "היסטוריה"}
              {t === "pending" && pending.length > 0 && (
                <span className="mr-2 bg-amber-600 text-white text-xs rounded-full px-1.5 py-0.5">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* ── PENDING TAB ── */}
        {tab === "pending" && (
          <>
            {loading ? (
              <p className="text-center text-gray-400 text-sm py-12">טוען...</p>
            ) : pending.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">אין הצעות ממתינות</p>
            ) : (
              <div className="space-y-3">
                {pending.map((ann) => (
                  <div
                    key={ann.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 items-start"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-gray-800 text-sm">{ann.sourceLabel}</span>
                        <span className="text-xs text-gray-400">
                          {CHELEK_LABELS[ann.chelek] ?? ann.chelek} סימן {ann.siman}
                        </span>
                      </div>
                      {ann.highlightText && (
                        <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mb-2 line-clamp-2">
                          {ann.highlightText.slice(0, 120)}{ann.highlightText.length > 120 ? "..." : ""}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>מאת: <strong className="text-gray-600">{ann.userName}</strong></span>
                        <span>{new Date(ann.createdAt).toLocaleDateString("he-IL")}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAction(ann.id, "approved")}
                        disabled={actionInFlight === ann.id}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        ✓ אשר
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(ann.id, "rejected")}
                        disabled={actionInFlight === ann.id}
                        className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
                      >
                        ✗ דחה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <>
            {/* Filter bar */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["all", "pending", "approved", "rejected"] as HistoryFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setHistoryFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    historyFilter === f
                      ? "bg-amber-600 text-white border-amber-600"
                      : "border-gray-300 text-gray-600 hover:border-amber-400"
                  }`}
                >
                  {f === "all" ? "הכל" : STATUS_LABELS[f]}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-center text-gray-400 text-sm py-12">טוען...</p>
            ) : filteredHistory.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">אין רשומות</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">סטטוס</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">מקור</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">סימן</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">משתמש</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">תאריך</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHistory.map((ann) => (
                      <tr key={ann.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ann.status]}`}>
                            {STATUS_LABELS[ann.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate">{ann.sourceLabel}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {CHELEK_LABELS[ann.chelek] ?? ann.chelek} {ann.siman}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{ann.userName}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(ann.createdAt).toLocaleDateString("he-IL")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: add admin panel with pending queue and history tabs"
```

---

## Verification

1. **User switching** — Navigate to `/user1`. Should redirect to `/`. Check `localStorage.currentUser` in browser devtools = `"user1"`.

2. **Pending annotations** — As `user1`, add a source to document. Check DB: `sqlite3 data/annotations.db "SELECT id, user_name, status FROM annotations ORDER BY created_at DESC LIMIT 3"`. Expected: `status = pending`.

3. **Creator sees own highlight** — As `user1`, reload the siman page. The highlight should appear (yellow) even though status is `pending`.

4. **Other user does not see highlight** — Navigate to `/user2`. Reload siman page. The highlight should NOT appear.

5. **Admin approval** — Navigate to `/admin`. The pending annotation should appear in tab א. Click ✓ אשר. Row disappears from pending list.

6. **Approved highlight visible to all** — Navigate to `/user2`, reload siman page. Highlight should now appear.

7. **History tab** — In `/admin`, switch to tab ב. All annotations appear. Use filter buttons to show only `מאושר` / `נדחה` / `ממתין`.

8. **Admin identity** — After visiting `/admin`, check `localStorage.currentUser = "admin"`.
