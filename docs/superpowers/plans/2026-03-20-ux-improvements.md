# UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 issues: parser dedup bug, commentary edit modal, missed-source panel replaced by structured form, Hebrew chapter input, and remove all English from UI.

**Architecture:** All changes are in existing files. No new abstractions needed. Parser fix is pure logic. UI changes extend `AddManualSourceModal` with an optional `rawText` prop and replace `AddMissedSourcePanel`. Commentary edit moves from inline to modal. Hebrew chapter input replaces `type="number"` inputs with text inputs that parse both Hebrew and Arabic numerals.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, React hooks. No test framework — use `npm run build` for compile verification.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `lib/parser.ts` | Modify | Fix positional dedup to also discard resolved matches contained in wider resolved matches |
| `components/ActiveSourcePanel.tsx` | Modify | Commentary edit → modal overlay instead of inline textarea |
| `components/AddManualSourceModal.tsx` | Modify | Add `rawText?: string` prop; Hebrew chapter input; remove ref preview block |
| `components/AddMissedSourcePanel.tsx` | Delete | Replaced entirely by `AddManualSourceModal` with `rawText` |
| `app/siman/[chelek]/[number]/page.tsx` | Modify | Replace `AddMissedSourcePanel` usage with `AddManualSourceModal` + `rawText`; audit for any remaining English UI text |

---

### Task 1: Fix parser dedup — resolved matches contained in wider resolved matches

**Files:**
- Modify: `lib/parser.ts:460-472`

- [ ] **Step 1: Understand the current filter**

Read `lib/parser.ts` lines 459–473. The current code is:
```typescript
return allMatches
  .filter(r => {
    if (r.data.sefariaRef) return true;           // ← bug: always keeps resolved
    if (r.data.unresolved) {
      return !resolvedRanges.some(([s, e]) => s <= r.start && r.end <= e);
    }
    return true;
  })
```
`resolvedRanges` is built from all resolved matches on line 461. The bug: a resolved match whose span [start,end] is fully inside another resolved match's span also passes.

- [ ] **Step 2: Apply the fix**

Replace the `if (r.data.sefariaRef) return true;` line with:
```typescript
if (r.data.sefariaRef) {
  // Drop if strictly contained within a wider resolved match
  return !resolvedRanges.some(
    ([s, e]) => s <= r.start && r.end <= e && !(s === r.start && e === r.end)
  );
}
```

- [ ] **Step 3: Verify with build**

```bash
cd .worktrees/beit-yosef-explorer && source ~/.nvm/nvm.sh && nvm use 20 && npm run build
```
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Manual test**

Run `npm run dev`, open a siman that contains `ירושלמי פ"ק דערלה` in the Beit Yosef text. Verify only ONE source appears (the Yerushalmi), not two (Yerushalmi + Mishnah).

- [ ] **Step 5: Commit**

```bash
cd .worktrees/beit-yosef-explorer && git add lib/parser.ts && git commit -m "fix: drop resolved parser matches contained within wider resolved matches"
```

---

### Task 2: Commentary edit — modal overlay

**Files:**
- Modify: `components/ActiveSourcePanel.tsx`

- [ ] **Step 1: Add modal state**

In `ActiveSourcePanel.tsx`, the existing state is:
```typescript
const [editingRef, setEditingRef] = useState<string | null>(null);
const [editingText, setEditingText] = useState<string>("");
```
These stay as-is. `editingRef !== null` means the modal is open.

- [ ] **Step 2: Remove the inline editing block**

Find the inline edit block inside the `commentaries.map(...)` section (around line 439–468):
```tsx
{editingRef === c.ref ? (
  <div className="space-y-1">
    <textarea ... />
    <div className="flex gap-2">
      <button onClick={() => saveCommentaryEdit(c.ref)}>שמור</button>
      <button onClick={() => setEditingRef(null)}>ביטול</button>
    </div>
  </div>
) : (
  <div className="text-xs text-gray-600 ...">
    {c.text.split("\n")...}
  </div>
)}
```
Replace the entire ternary with always showing the read-only text:
```tsx
<div className="text-xs text-gray-600 space-y-1" dir="rtl">
  {c.text.split("\n").filter(Boolean).map((line, j) => (
    <p key={j}>{line}</p>
  ))}
</div>
```

- [ ] **Step 3: Add the modal at the bottom of the component**

Just before the final closing `</div>` of the component return (after the bottom action row), add:
```tsx
{/* Commentary edit modal */}
{editingRef !== null && (() => {
  const editing = commentaries.find((c) => c.ref === editingRef);
  if (!editing) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setEditingRef(null)}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-amber-900">{editing.heRef}</h2>
        <textarea
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          className="w-full border border-amber-300 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
          style={{ minHeight: "300px" }}
          dir="rtl"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={() => saveCommentaryEdit(editingRef)}
            className="flex-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
          >
            שמור
          </button>
          <button
            onClick={() => setEditingRef(null)}
            className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
})()}
```

- [ ] **Step 4: Verify with build**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 5: Manual test**

Open a siman, approve a source that has commentaries, click "ערוך" on a commentary — a large modal should open with the commentary text.

- [ ] **Step 6: Commit**

```bash
git add components/ActiveSourcePanel.tsx && git commit -m "feat: open commentary edit in large modal instead of inline textarea"
```

---

### Task 3: Hebrew chapter input + remove English + rawText prop in AddManualSourceModal

**Files:**
- Modify: `components/AddManualSourceModal.tsx`

This task has 3 sub-changes done together since they're all in the same file.

#### 3a — Remove ref preview block

- [ ] **Step 1: Delete the ref preview block**

Find and delete lines 323–328 (the `{built && ...}` block that renders `קישור לספריא: {built.sefariaRef}`):
```tsx
{/* Constructed ref preview — DELETE THIS ENTIRE BLOCK */}
{built && (
  <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
    <span className="font-medium">קישור לספריא: </span>
    <span dir="ltr" className="font-mono">{built.sefariaRef}</span>
  </div>
)}
```

#### 3b — Hebrew chapter input

- [ ] **Step 2: Add a helper function to parse Hebrew/Arabic input**

Add this function just before the `AddManualSourceModal` component definition:
```typescript
function parseHeOrArabic(s: string): number {
  if (!s.trim()) return 0;
  const fromHe = fromHebrewNumeral(s.trim());
  if (fromHe !== null && fromHe > 0) return fromHe;
  const n = parseInt(s.trim(), 10);
  return isNaN(n) ? 0 : n;
}
```
Note: `fromHebrewNumeral` is already imported at the top of the file via `toHebrewNumeral` — check the import and add `fromHebrewNumeral` if it's not already there.

- [ ] **Step 3: Add a helper to display Hebrew label for text input**

Add this function:
```typescript
function hebrewLabel(s: string): string {
  const n = parseHeOrArabic(s);
  if (n <= 0) return "";
  return toHebrewNumeral(n);
}
```

- [ ] **Step 4: Replace chapter fields with text inputs**

For the **משנה tab — פרק** field (around line 241–255), replace:
```tsx
<label className="text-sm font-medium text-gray-700">
  פרק{chapter && !isNaN(Number(chapter)) ? ` (${toHebrewNumeral(Number(chapter))})` : ""}
</label>
<input
  type="number"
  min={1}
  value={chapter}
  onChange={(e) => { setChapter(e.target.value); resetFetch(); }}
  placeholder="מספר פרק"
  ...
/>
```
With:
```tsx
<label className="text-sm font-medium text-gray-700">
  פרק{chapter ? ` (${hebrewLabel(chapter)})` : ""}
</label>
<input
  type="text"
  value={chapter}
  onChange={(e) => { setChapter(e.target.value); resetFetch(); }}
  placeholder="א / ב / ג..."
  dir="rtl"
  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
/>
```

- [ ] **Step 5: Replace משנה number field**

Similarly for the **משנה (אופציונלי)** field (around line 258–272):
```tsx
<label className="text-sm font-medium text-gray-700">
  משנה (אופציונלי){mishna ? ` (${hebrewLabel(mishna)})` : ""}
</label>
<input
  type="text"
  value={mishna}
  onChange={(e) => { setMishna(e.target.value); resetFetch(); }}
  placeholder="א / ב / ג..."
  dir="rtl"
  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
/>
```

- [ ] **Step 6: Replace רמב"ם פרק field**

For the **רמב"ם — פרק** field (around line 288–302), same pattern:
```tsx
<label className="text-sm font-medium text-gray-700">
  פרק{hilchotChapter ? ` (${hebrewLabel(hilchotChapter)})` : ""}
</label>
<input
  type="text"
  value={hilchotChapter}
  onChange={(e) => { setHilchotChapter(e.target.value); resetFetch(); }}
  placeholder="א / ב / ג..."
  dir="rtl"
  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
/>
```

- [ ] **Step 7: Replace הלכה (אופציונלי) field**

```tsx
<label className="text-sm font-medium text-gray-700">
  הלכה (אופציונלי){halacha ? ` (${hebrewLabel(halacha)})` : ""}
</label>
<input
  type="text"
  value={halacha}
  onChange={(e) => { setHalacha(e.target.value); resetFetch(); }}
  placeholder="א / ב / ג..."
  dir="rtl"
  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
/>
```

- [ ] **Step 8: Update buildRef to use parseHeOrArabic**

In `buildRef`, the `chapter`, `mishna`, `hilchotChapter`, `halacha` params arrive as strings. Update the cases that use them:

`case "mishna"`:
```typescript
const chNum = parseHeOrArabic(chapter);
if (!tractate || chNum <= 0) return null;
const misNum = parseHeOrArabic(mishna);
const sefariaRef = misNum > 0
  ? `Mishnah_${tractate}.${chNum}.${misNum}`
  : `Mishnah_${tractate}.${chNum}`;
const tractateLabel = TRACTATE_ENTRIES.find((e) => e.value === tractate)?.label ?? tractate;
const displayName = misNum > 0
  ? `משנה ${tractateLabel} פרק ${toHebrewNumeral(chNum)} משנה ${toHebrewNumeral(misNum)}`
  : `משנה ${tractateLabel} פרק ${toHebrewNumeral(chNum)}`;
return { sefariaRef, displayName };
```

`case "rambam"`:
```typescript
const chapNum = parseHeOrArabic(hilchotChapter);
const halNum = parseHeOrArabic(halacha);
if (!hilchot || chapNum <= 0) return null;
const sefariaRef = halNum > 0
  ? `Mishneh_Torah,_Laws_of_${hilchot}.${chapNum}.${halNum}`
  : `Mishneh_Torah,_Laws_of_${hilchot}.${chapNum}`;
const hilchotLabel = HILCHOT_ENTRIES.find((e) => e.value === hilchot)?.label ?? hilchot;
const displayName = halNum > 0
  ? `רמב"ם הלכות ${hilchotLabel} פרק ${toHebrewNumeral(chapNum)} הלכה ${toHebrewNumeral(halNum)}`
  : `רמב"ם הלכות ${hilchotLabel} פרק ${toHebrewNumeral(chapNum)}`;
return { sefariaRef, displayName };
```

Note: the `dafNum` call for gemara/rishonim uses `parseInt(daf, 10)` which stays as-is (daf remains a number input).

#### 3c — Add rawText prop

- [ ] **Step 9: Add rawText prop**

Update the `Props` type:
```typescript
type Props = {
  seifIndex?: number;
  rawText?: string;        // ← add this
  onAdd: (src: ManualSource) => void;
  onClose: () => void;
};
```

Update the component signature:
```typescript
export default function AddManualSourceModal({ seifIndex, rawText, onAdd, onClose }: Props) {
```

- [ ] **Step 10: Render rawText context block at top of modal**

Inside the modal `<div>`, just after the `<h2>הוסף מקור ידנית</h2>` heading, add:
```tsx
{rawText && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
    <p className="text-xs text-gray-500 mb-1">טקסט שנבחר:</p>
    <p className="text-sm text-amber-900 leading-relaxed line-clamp-4" dir="rtl">{rawText}</p>
  </div>
)}
```

- [ ] **Step 11: Verify with build**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add components/AddManualSourceModal.tsx && git commit -m "feat: hebrew chapter input, rawText context prop, remove sefaria ref preview"
```

---

### Task 4: Delete AddMissedSourcePanel and wire up AddManualSourceModal

**Files:**
- Delete: `components/AddMissedSourcePanel.tsx`
- Modify: `app/siman/[chelek]/[number]/page.tsx`

- [ ] **Step 1: Delete AddMissedSourcePanel.tsx**

```bash
rm .worktrees/beit-yosef-explorer/components/AddMissedSourcePanel.tsx
```

- [ ] **Step 2: Update the import in page.tsx**

In `app/siman/[chelek]/[number]/page.tsx`, remove:
```typescript
import AddMissedSourcePanel from "@/components/AddMissedSourcePanel";
```
`AddManualSourceModal` is already imported.

- [ ] **Step 3: Update handleApproveMissed signature**

In `page.tsx`, the following are already in scope:
- `currentSource` — defined at line ~100: `const currentSource: ParsedSource | undefined = sources[currentIndex]`
- `activeSeif` — from the store: `const { ..., activeSeif, ... } = useStore()`
- `addManual` — from `const { reject, addManual } = useParserFeedback()` (already used for the manual source button)
- `approveSource` — from the store

The current `handleApproveMissed(ref, selectedText, commentaries)` takes a raw ref string. With the new flow, `AddManualSourceModal` calls `onAdd(src: ManualSource)`. Replace `handleApproveMissed` with a new handler:

```typescript
function handleMissedAdd(src: ManualSource) {
  approveSource({
    ref: src.sefariaRef ?? src.ref,
    raw: src.ref,
    selectedText: "",
    commentaries: [],
    mefaresh: currentSource?.mefaresh ?? "beit-yosef",
    seifIndex: activeSeif,
  });
  addManual(src);
  setMissedSourceText(null);
}
```

- [ ] **Step 4: Replace AddMissedSourcePanel JSX with AddManualSourceModal**

Find the `{missedSourceText && (<AddMissedSourcePanel .../>)}` block and replace with:
```tsx
{missedSourceText && (
  <AddManualSourceModal
    rawText={missedSourceText}
    seifIndex={activeSeif}
    onAdd={handleMissedAdd}
    onClose={() => setMissedSourceText(null)}
  />
)}
```

- [ ] **Step 5: Verify with build**

```bash
npm run build
```
Expected: no errors, no reference to `AddMissedSourcePanel`.

- [ ] **Step 6: Manual test**

Run `npm run dev`. In a siman, select text in the Beit Yosef panel using the "הוסף מקור שפוספס" button. The modal that opens should show the selected text at top, then tabs גמרא/משנה/ראשונים/רמב"ם. Fill in a משנה with Hebrew chapter letter, add it — it should appear in approved sources.

- [ ] **Step 7: Commit**

```bash
git add components/ app/siman/ && git commit -m "feat: replace missed-source panel with structured source form"
```

---

### Task 5: Audit and remove remaining English from UI

**Files:**
- May modify: any component file

- [ ] **Step 1: Search for English strings in component files**

Run these two focused greps from inside `.worktrees/beit-yosef-explorer/`:

```bash
# Find English placeholder text
grep -rn --include="*.tsx" 'placeholder="[A-Za-z]' components/

# Find English visible text inside JSX (between > and <)
grep -rn --include="*.tsx" '>[A-Za-z][A-Za-z ]\+<' components/
```

Focus only on strings visible to the user — inside JSX text nodes or `placeholder` attributes.

- [ ] **Step 2: Check specific known locations**

Check these for leftover English user-visible text:
- `components/AddManualSourceModal.tsx` — placeholder on daf input (`"מספר דף"` is Hebrew, good). Check amud radio labels (`עמוד א'` / `עמוד ב'` — Hebrew, good).
- `components/ActiveSourcePanel.tsx` — check any English-looking placeholders or labels.
- `components/RedefineSourcePanel.tsx` — if it exists, open and check.
- `components/SearchableSelect.tsx` — check placeholder.

- [ ] **Step 3: Fix any found issues**

For each English string found in a user-visible position, replace with the Hebrew equivalent. Common cases:
- `placeholder="Enter..."` → replace with Hebrew
- Any error message text in English

- [ ] **Step 4: Verify with build**

```bash
npm run build
```

- [ ] **Step 5: Commit (only if changes were made)**

```bash
git add components/ && git commit -m "fix: remove remaining english text from UI"
```
