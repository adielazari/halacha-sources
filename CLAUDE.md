# CLAUDE.md

Guidance for Claude Code when working in this repo. See `README.md` for the
full feature list and user-facing workflow — this file is for working on the
code itself.

## Overview

Next.js 14 (App Router, TypeScript) app for building a personal "document"
(דף מקורות) of halachic sources per siman — Tur, Beit Yosef, Shulchan Arukh,
and the relevant mefarshim per chelek — pulled live from Sefaria. Users
mark/pull sources into a per-siman document, export it as PDF/Word, and
organize simanim into "collections" (קבצי לימוד).

**Local, single-user.** There is no login, no accounts, no groups — the app
resolves one local profile (`lib/localSession.ts`) and scopes all data to it.
Multi-user code (NextAuth, groups, admin/moderation) was removed and lives on
branch `archive/multi-user` if sharing ever becomes relevant again. Data is a
local better-sqlite3 DB (`data/annotations.db`, schema + migrations in
`lib/db.ts`), never committed.

Dev server: `nvm use && npm run local` (or `npm run dev`). **Node must be
18.20.1 exactly** (`.nvmrc`) — the installed `better-sqlite3` binary is built
for that version specifically; a newer Node fails to open the DB. Binding
port 3000 needs `dangerouslyDisableSandbox: true` in this environment.

## AI: one mechanism, local `claude` CLI only

There is exactly one AI feature: per-se'if summary + practical points on the
"לפי סעיפי שו״ע" view (`/api/seif-analysis`, `components/SeifBlockAnalysis.tsx`,
persisted in `block_analyses`). It shells out to the developer's own
authenticated `claude` CLI (`lib/claudeCli.ts`) — **not** a paid API key, by
design (no billing to manage). Every practical point must cite a `source`
from the closed list of labels actually sent to the model
(`lib/seifAnalysisPrompt.ts`), validated server-side.

Two ways to trigger it:
1. **From the UI** — the "✨ סיכום" / "✓ למעשה" buttons under each block.
2. **From Claude Code** — `.claude/skills/seif-analysis` batch-(re)generates
   across a siman's se'ifim via the same endpoint; useful for running many
   simanim at once. This replaced `~/.claude/skills/siman-points`, which
   drove the now-removed `/agents` mechanism.

There used to be three AI paths (a paid Anthropic SDK route, a customizable
"agents" mechanism, and an ephemeral per-excerpt analysis on the document
page) — all removed as duplicative or unused; see
`docs/plan/2026-09-23-redesign-plan.md` for the full rationale.

## Source identification has real test coverage

`lib/parser.ts` (whole-paragraph scanner, handles Rishonim/Aharonim authors)
and `lib/detectSourceRef.ts` (focused single-snippet detector, drives
SourcePullView's form fields) are the app's most bug-prone, most load-bearing
code — years of one-off regex fixes with zero prior tests. They're now
wrapped behind one entry point, `lib/sourceDetection.ts`'s `detectSource()`
(focused detector first, whole-text scanner as fallback — the same two-step
logic SourcePullView always did inline), and covered by golden-set snapshot
tests (`lib/parser.test.ts`, `lib/detectSourceRef.test.ts`, run via
`npm test`) seeded from real OC siman 1 pulls and historical git-log bug
fixes. **Run `npm test` before touching either file** — a regex change that
"looks safe" has broken unrelated cases before.

The se'if↔mefaresh mapping (`buildSeifBlocks` in `lib/sefaria.ts`) has its
own consistency check: if a mefaresh's total matched-link count doesn't equal
its fetched note count, every block containing its notes is flagged
`uncertainSourceKeys` (shown as "⚠️ מיפוי לא ודאי" in the UI, and gates
AI-analysis generation behind an explicit confirm). Sample real simanim for
mismatches with `npm run check-seif-mapping`.

## Other archived work

- `archive/otzar-alignment` — a dead-end OCR/text-alignment experiment for
  auto-linking Tur↔Beit Yosef, never wired into the live app. Not on main.
- `halachic-extractor` (sibling directory, Python/FastAPI) — the predecessor
  project this app replaced. Left in place, not touched by this repo.
