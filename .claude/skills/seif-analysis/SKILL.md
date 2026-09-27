---
name: seif-analysis
description: Batch-(re)generate the "לפי סעיפי שו״ע" AI summary + practical points for a siman (or several) in halacha-sources, via the local dev server's /api/seif-analysis endpoint. Use when the user asks to analyze/refresh a siman's se'ifim, e.g. "תנתח את סימן א באו"ח" or "תעדכן ניתוחים שהתיישנו בסימן ה ביו"ד".
---

# seif-analysis

Runs the same generation the in-app "✨ סיכום" / "✓ למעשה" buttons trigger on
the "לפי סעיפי שו״ע" view — the server itself shells out to the local `claude`
CLI (`lib/claudeCli.ts`), so this skill does no generation of its own; it just
drives the endpoint across every se'if of a siman (or several simanim) in one
go, which is awkward to do by clicking through the UI one block at a time.

Repo: `~/side_projects/halacha-sources`. Requires the local dev server running
at `http://localhost:3000` (`npm run dev` — no login needed, the app is
single-local-user).

## Args

`<chelek> <siman number>[,<siman number>...]` — chelek is one of
`OrachChayim`, `YorehDeah`, `EvenHaEzer`, `ChoshenMishpat`. If the user says
"כל הסימנים ש..." or gives a range, expand it to individual siman numbers
first and repeat the steps below per siman.

## Steps, per siman

1. **Confirm the dev server is up**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`. If not `200`, tell the user to start it and stop — don't start it yourself unless asked.

2. **Fetch the siman's HalachicBlocks**:
   ```bash
   curl -s "http://localhost:3000/api/siman-texts?chelek=<chelek>&siman=<num>"
   ```
   Read the `seifBlocks` array: each entry is `{ seifIndex, saHtml, notes: [{sourceKey, sourceLabel, noteIndex, html}], contentHash }`. If `seifBlocks` is empty or missing, tell the user this siman has no SA text / no anchored mefarshim yet and skip it.

3. **Fetch existing stored analyses**:
   ```bash
   curl -s "http://localhost:3000/api/seif-analysis?chelek=<chelek>&siman=<num>"
   ```
   Returns `{ analyses: [{ seifIndex, contentHash, summary, practicalPoints, createdAt }] }`.

4. **For each block**, compare `block.contentHash` to the stored analysis's `contentHash` for that `seifIndex` (if any). Skip blocks that already have a matching stored analysis — only (re)generate what's missing or stale, unless the user explicitly asked to force-regenerate everything.

   This only tracks the *automatically anchored* mefarshim (the block's own `notes`) — it does not know about Tur/Beit Yosef excerpts the user manually linked to a se'if in the document (`Excerpt.linkedSeif`), which the in-app button does fold into its hash. If you need those included too, use the in-app "✨" button for that specific se'if instead of this skill.

5. **For each block to (re)generate**, POST:
   ```bash
   curl -s -X POST "http://localhost:3000/api/seif-analysis" \
     -H "Content-Type: application/json" \
     -d '{
       "chelek": "<chelek>", "siman": "<num>", "seifIndex": <seifIndex>,
       "contentHash": "<block.contentHash>",
       "sourceLabel": "סעיף <hebrew numeral of seifIndex+1>",
       "sourceText": "<block.saHtml>",
       "commentaries": [ { "heRef": "<note.sourceLabel>", "text": "<note.html>" }, ... ]
     }'
   ```
   `commentaries` is `block.notes` mapped to `{heRef: note.sourceLabel, text: note.html}`, in order. The server itself calls the local `claude` CLI and validates that every returned practical point's `source` is one of `sourceLabel` or a `commentaries[].heRef` — you don't need to do that validation yourself, just build the request correctly.

   Response is `{ analysis: {...} }` on success, `{ error: "..." }` on failure (e.g. the `claude` CLI isn't authenticated, or timed out).

6. **Report back**: how many blocks were generated vs. already up to date vs. failed, per siman, and — if any failed — the error message so the user can decide whether to retry.

## Notes

- This replaces the old `siman-points` skill (`~/.claude/skills/siman-points`), which drove the now-removed `/agents` mechanism (NextAuth login, `/api/agents/*`). That skill and the feature it drove no longer exist in this app — delete `~/.claude/skills/siman-points` if it's still present.
- Never invent a `contentHash` — always use the value the server just gave you in `seifBlocks`, so staleness detection stays meaningful.
