# Admin Panel + User Switching — Design Spec

## Overview

Add a lightweight user-identity layer (localStorage-based, placeholder for real auth) and an admin panel for reviewing annotation proposals before they go live as highlights.

---

## 1. DB Schema Change

### Current
```sql
approved INTEGER DEFAULT 1
```

### New
```sql
status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'))
```

Migration: `ALTER TABLE annotations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`; then drop or ignore `approved`. For existing rows (if any), set `status = 'approved'` where `approved = 1`, `status = 'pending'` where `approved = 0`.

`lib/db.ts` — update `rowToAnnotation()`, `createAnnotation()`, `updateAnnotation()`. Remove `approved` field from the `Annotation` type; replace with `status: "pending" | "approved" | "rejected"`.

---

## 2. User Context

### `lib/userContext.tsx`
- React context that exposes `currentUser: string` and `setCurrentUser(name: string)`
- Reads/writes `localStorage.currentUser` (defaults to `"anonymous"`)
- Wrap `app/layout.tsx` with `<UserProvider>`

### User switching routes
- `app/[username]/page.tsx` — client component, calls `setCurrentUser(params.username)`, then `router.push("/")`. Works for `/user1`, `/user2`, etc.
- The `/admin` route does NOT redirect — it is the admin panel itself (see §4). When admin visits `/admin` it also sets `currentUser = "admin"` via `useEffect`.

### Using the context
- `app/siman/[chelek]/[number]/page.tsx` — read `currentUser` from context; pass it to `POST /api/annotations` as `userName`
- `highlightAnnotations(html, annotations, sourceKey, sectionIndex, currentUser)` — add `currentUser` param; show highlight if `annotation.status === "approved" OR annotation.userName === currentUser`

---

## 3. API Changes

### `GET /api/annotations`
Add optional query param `status`: `pending | approved | rejected | all`. Default remains `approved` (only approved annotations returned for non-admin callers). When `status=all`, return everything regardless of status.

### `POST /api/annotations`
New annotations saved with `status = "pending"` (changed from `approved = 1`).

### `PATCH /api/annotations/[id]`
Accept `{ status: "approved" | "rejected" }` in addition to existing fields. Remove `approved` boolean from accepted body.

### `GET /api/annotations/admin`
New endpoint — returns all annotations across all chelakkim/simanim with no filter. Used exclusively by the admin panel. Sorted by `created_at DESC`.

---

## 4. Admin Page — `app/admin/page.tsx`

Client component. On mount: sets `currentUser = "admin"` in localStorage.

### Layout
Simple full-page layout with two tabs:

**Tab A — "ממתינים לאישור"**
- Fetches `GET /api/annotations/admin?status=pending`
- Each row shows: sourceLabel, chelek + siman, highlightText (truncated to 80 chars), userName, createdAt
- Two action buttons per row:
  - ✓ **אשר** → `PATCH /api/annotations/{id}` `{ status: "approved" }` → remove row from list optimistically
  - ✗ **דחה** → `PATCH /api/annotations/{id}` `{ status: "rejected" }` → remove row from list optimistically
- Empty state: "אין הצעות ממתינות"

**Tab B — "היסטוריה"**
- Fetches `GET /api/annotations/admin?status=all`
- Read-only table: status badge (color-coded: green=approved, yellow=pending, red=rejected), sourceLabel, chelek+siman, userName, createdAt
- Filter bar at top: buttons to filter by status (all / pending / approved / rejected) — client-side filter, no refetch

### No pagination for now
The volume is expected to be small (single local deployment).

---

## 5. Highlight Visibility Logic

```ts
function shouldShowHighlight(ann: Annotation, currentUser: string): boolean {
  return ann.status === "approved" || ann.userName === currentUser;
}
```

`highlightAnnotations()` updated to accept and apply this filter.

---

## 6. `Annotation` Type Update

```ts
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
  status: "pending" | "approved" | "rejected";  // replaces approved: boolean
  createdAt: string;
  updatedAt: string;
};
```

---

## 7. Files Touched

| File | Change |
|------|--------|
| `lib/types.ts` | Replace `approved: boolean` with `status` |
| `lib/db.ts` | Migration + update CRUD + rowToAnnotation |
| `lib/userContext.tsx` | New — React context for current user |
| `lib/highlightAnnotations.ts` | Add `currentUser` param + visibility logic |
| `app/layout.tsx` | Wrap with `UserProvider` |
| `app/[username]/page.tsx` | New — sets user, redirects home |
| `app/admin/page.tsx` | New — admin panel with two tabs |
| `app/api/annotations/route.ts` | Add `status` query param support |
| `app/api/annotations/[id]/route.ts` | Accept `status` in PATCH body |
| `app/api/annotations/admin/route.ts` | New — returns all annotations |
| `app/siman/[chelek]/[number]/page.tsx` | Read currentUser, pass to POST |
| `components/TextPanel.tsx` | Pass currentUser to highlightAnnotations |

---

## 8. Out of Scope (Phase 2)

- Real authentication (replace localStorage with JWT/session)
- Per-user annotation editing history (`annotation_events` table)
- Admin notifications for new pending items
