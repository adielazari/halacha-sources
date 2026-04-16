/**
 * Extract Tur seif boundaries and BY seif boundaries from Otzar HaChochma page scans.
 * Uses Claude vision to read each crop and identify bold seif markers.
 *
 * Output: cache/otzar/ground-truth/yd294-physical-seifim.json
 *
 * Usage:
 *   node scripts/extract-otzar-seifim.mjs [--pages 320-339] [--force]
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local if present (for ANTHROPIC_API_KEY)
const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ZOOM_DIR = join(ROOT, 'cache', 'otzar', 'yd294-zoom');
const GT_DIR = join(ROOT, 'cache', 'otzar', 'ground-truth');
const OUT_FILE = join(GT_DIR, 'yd294-physical-seifim.json');

mkdirSync(GT_DIR, { recursive: true });

const args = process.argv.slice(2);
const forceReprocess = args.includes('--force');
const pagesArg = args.find(a => a.startsWith('--pages='));
let pageRange = [320, 339];
if (pagesArg) {
  const [s, e] = pagesArg.replace('--pages=', '').split('-').map(Number);
  pageRange = [s, e];
}

const client = new Anthropic();

// ── Prompts ───────────────────────────────────────────────────────────────────

const BY_PROMPT = `This is a scan of the Beit Yosef commentary column from a printed Tur (Arba'ah Turim / Yoreh Deah).

Your task: identify every seif (section) marker that starts a new section in this column.
Seif markers are BOLD standalone Hebrew letters (ב, ג, ד, ה, ו, ז, ח, ט, י, יא...) followed by a colon or period, or just bold and clearly larger/bolder than surrounding text.

For EACH seif marker you find, output a JSON object with:
- "marker": the Hebrew letter(s) you see (e.g., "ב", "ג", "יא")
- "openingWords": the first 30-40 characters of text that immediately follows the bold marker (not the marker itself)
- "isFirstOnPage": true if this marker is the very first visible seif on this page (i.e., the seif started on a previous page), false otherwise
- "isContinuation": true if this seif started on a PREVIOUS page (there's no bold marker, text just continues from top of column)

Return ONLY a valid JSON array, no commentary. Example:
[
  {"marker": "ב", "openingWords": "ומ\"ש אבל העלים והלולבים", "isFirstOnPage": false, "isContinuation": false},
  {"marker": "ג", "openingWords": "האביונות והתמרות של צלף", "isFirstOnPage": false, "isContinuation": false}
]

If no seif markers are visible (only continuation text), return an empty array [].
If the top of the column is a continuation of a seif from the previous page (no bold marker at top), include it with "isContinuation": true and "marker": "" and the opening words being the first words visible.`;

const TUR_PROMPT = `This is a scan of the Tur (Arba'ah Turim / Yoreh Deah) text column from a printed edition.

Your task: identify every seif (section) marker that starts a new section in this Tur column.
Seif markers in the Tur are BOLD Hebrew letters (ב, ג, ד, ה...) that appear as seif headings — they may be on their own line or bold inline before the seif text. Sometimes combined seifim appear as "ד׳ ה׳," meaning seifim dalet and heh share one passage.

For EACH seif marker you find, output a JSON object with:
- "marker": the Hebrew letter(s) you see (e.g., "ב", "ג", "ד ה" for combined seifim)
- "openingWords": the first 40-50 characters of Tur text that immediately follows the bold marker
- "isCombined": true if this marker covers two SA seifim (e.g., "ד׳ ה׳,")
- "isContinuation": true if this is a seif that started on a PREVIOUS page (text continues from top without a bold marker)

Return ONLY a valid JSON array, no commentary. If no new seif starts on this page (only continuation), return:
[{"marker": "", "openingWords": "<first visible words>", "isContinuation": true}]`;

// ── Image loader ──────────────────────────────────────────────────────────────

function loadImageAsBase64(path) {
  const buf = readFileSync(path);
  return buf.toString('base64');
}

// ── Process one page ──────────────────────────────────────────────────────────

async function processPage(pageNum) {
  const results = { page: pageNum, tur: null, by: null };

  // Tur column
  const turPath = join(ZOOM_DIR, `p${pageNum}-tur-only.png`);
  if (existsSync(turPath)) {
    console.log(`  📖 Tur p${pageNum}...`);
    try {
      const b64 = loadImageAsBase64(turPath);
      const resp = await client.messages.create({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
            { type: 'text', text: TUR_PROMPT },
          ],
        }],
      });
      const text = resp.content[0].text.trim();
      // Extract JSON from response (might have markdown code fences)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      results.tur = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (e) {
      console.error(`    ❌ Tur p${pageNum} error: ${e.message}`);
      results.tur = [];
    }
  }

  // BY column
  const byPath = join(ZOOM_DIR, `p${pageNum}-by-only.png`);
  if (existsSync(byPath)) {
    console.log(`  📜 BY  p${pageNum}...`);
    try {
      const b64 = loadImageAsBase64(byPath);
      const resp = await client.messages.create({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
            { type: 'text', text: BY_PROMPT },
          ],
        }],
      });
      const text = resp.content[0].text.trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      results.by = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (e) {
      console.error(`    ❌ BY  p${pageNum} error: ${e.message}`);
      results.by = [];
    }
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Load existing results if any (to allow resuming)
let existing = {};
if (existsSync(OUT_FILE) && !forceReprocess) {
  const data = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
  for (const entry of (data.rawPages || [])) {
    existing[entry.page] = entry;
  }
  console.log(`📂 Loaded ${Object.keys(existing).length} existing pages from cache`);
}

const rawPages = [];
for (let p = pageRange[0]; p <= pageRange[1]; p++) {
  if (existing[p] && !forceReprocess) {
    console.log(`⏭  Page ${p} — cached`);
    rawPages.push(existing[p]);
    continue;
  }
  console.log(`\n📄 Processing page ${p}...`);
  const result = await processPage(p);
  rawPages.push(result);

  // Save incrementally
  const output = buildOutput(rawPages);
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
}

console.log('\n✅ Done! Saved to', OUT_FILE);
console.log('\n📊 Summary:');
printSummary(rawPages);

// ── Build structured output ───────────────────────────────────────────────────

function buildOutput(pages) {
  return {
    siman: 294,
    chelek: 'YorehDeah',
    extractedAt: new Date().toISOString().slice(0, 10),
    source: 'Otzar HaChochma scans, Claude vision extraction',
    rawPages: pages,
    // Structured seifim: assembled from rawPages
    turSeifim: assembleTurSeifim(pages),
    bySeifim: assembleBySeifim(pages),
  };
}

function hebrewLetterToNum(letter) {
  const map = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8,
    'ט': 9, 'י': 10, 'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15,
    'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19, 'כ': 20, 'כא': 21, 'כב': 22,
    'כג': 23, 'כד': 24, 'כה': 25, 'כו': 26, 'כז': 27, 'כח': 28,
  };
  return map[letter.trim()] ?? null;
}

function assembleTurSeifim(pages) {
  const seifim = [];
  for (const page of pages) {
    for (const entry of (page.tur || [])) {
      if (!entry.marker || entry.isContinuation) continue;
      // Handle combined seifim like "ד ה" or "ד׳ ה׳"
      const cleaned = entry.marker.replace(/[׳']/g, '').trim();
      const parts = cleaned.split(/\s+/);
      const num = hebrewLetterToNum(parts[0]);
      if (num !== null) {
        seifim.push({
          seifNumber: num,
          otzarPage: page.page,
          turFirstWords: entry.openingWords,
          isCombined: entry.isCombined || parts.length > 1,
          combinedWith: parts.length > 1 ? hebrewLetterToNum(parts[1]) : null,
        });
      }
    }
  }
  // Sort by seifNumber
  seifim.sort((a, b) => a.seifNumber - b.seifNumber);
  return seifim;
}

function assembleBySeifim(pages) {
  const seifim = [];
  for (const page of pages) {
    for (const entry of (page.by || [])) {
      if (!entry.marker || entry.isContinuation) continue;
      const num = hebrewLetterToNum(entry.marker.trim());
      if (num !== null) {
        seifim.push({
          bySeifNumber: num,
          otzarPage: page.page,
          byFirstWords: entry.openingWords,
        });
      }
    }
  }
  seifim.sort((a, b) => a.bySeifNumber - b.bySeifNumber);
  return seifim;
}

function printSummary(pages) {
  const tur = [];
  const by = [];
  for (const p of pages) {
    for (const e of (p.tur || [])) {
      if (e.marker && !e.isContinuation) tur.push(`${e.marker}(p${p.page})`);
    }
    for (const e of (p.by || [])) {
      if (e.marker && !e.isContinuation) by.push(`${e.marker}(p${p.page})`);
    }
  }
  console.log(`  Tur seifim found: ${tur.join(', ')}`);
  console.log(`  BY  seifim found: ${by.join(', ')}`);
}
