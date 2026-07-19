# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Overview

Next.js 14 (App Router, TypeScript) app for building a personal "document"
(דף מקורות) of halachic sources per siman — Tur, Beit Yosef, Shulchan Arukh,
Taz, Shakh, Pitchei Teshuva, pulled live from Sefaria. Users mark/pull sources
into a per-siman document, export it as PDF/Word, and organize simanim into
shared "collections". Auth via NextAuth (JWT + credentials), data in a local
better-sqlite3 DB (`data/annotations.db`, schema in `lib/db.ts`).

Dev server: `source ~/.nvm/nvm.sh && nvm use 18.20.1 && npm run dev` (system
Node is too old for Next.js). Binding port 3000 needs
`dangerouslyDisableSandbox: true` in this environment.

Login (local dev) password lives in macOS Keychain:
`security find-generic-password -a "$USER" -s "halacha-sources-local-login" -w`

## Agents feature (points auto-generated into a siman's document)

`/agents` (also linked from the nav bar) lets the user define named "agent"
prompts — e.g. "נקודות הלכה למעשה" (practical halachic points) and "תובנות
טכנולוגיות ויישומיות" (tech/practical insights) — each with an editable
`systemPrompt` and `language` (`he`/`en`), stored in the `agent_definitions`
table (`lib/db.ts`). Output gets appended into the siman's document as a
`heading` + several `agentPoint` excerpts, tagged with `agentId` so a rerun
**replaces** that agent's previous batch rather than duplicating it
(`lib/agentRuns.ts`'s `saveAgentBatch`).

There are **two ways** to actually produce the points:

1. **Paid path** — the "🤖 הרץ" buttons on the document page call
   `POST /api/agents/[id]/run`, which fetches the siman's sources + curated
   document, calls the real Anthropic API (model from the agent definition,
   e.g. `claude-opus-4-8` / `claude-fable-5`) via `lib/anthropicClient.ts`
   (reads the key from Keychain, service `halacha-sources-anthropic-api-key`),
   parses the response, and saves. **Not currently used** — the user doesn't
   want to pay for a separate Anthropic API key.

2. **Free path (preferred)** — ask Claude Code directly, e.g. *"תריץ agents
   על סימן א באורח חיים"*. This uses the `siman-points` skill
   (`~/.claude/skills/siman-points/SKILL.md`): Claude logs into the local app
   (scripted NextAuth flow), fetches the raw sources + curated document +
   agent definitions via the existing API, generates the points itself
   (no external API call — it *is* the model), and saves them via
   `POST /api/agents/[id]/save` — a persistence-only endpoint that takes a
   pre-generated `points: string[]` array and writes it through the same
   `saveAgentBatch` replace-by-`agentId` logic as the paid path. Costs nothing
   beyond the user's normal Claude usage.

Both paths write through the same `saveAgentBatch` helper, so from the
document's point of view they're interchangeable — the UI, rendering
(`ExcerptItem` in `document/page.tsx`, `renderExcerpt` in
`lib/documentHtml.ts` for PDF/Word), and grouping logic don't know or care
which path produced the content.
