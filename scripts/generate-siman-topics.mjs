/**
 * generate-siman-topics.mjs
 * Fetches every siman heading from Sefaria API, detects topic boundaries,
 * and outputs TypeScript code for lib/simanTopics.ts.
 *
 * Run: node scripts/generate-siman-topics.mjs
 * Cache: scripts/siman-headings.json (re-run with --fresh to refetch)
 */

import https from 'https';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(__dir, 'siman-headings.json');
const FRESH = process.argv.includes('--fresh');

const BOOKS = [
  { key: 'OrachChayim',    api: "Shulchan_Arukh%2C_Orach_Chayyim",   n: 697 },
  { key: 'YorehDeah',      api: "Shulchan_Arukh%2C_Yoreh_De%27ah",    n: 403 },
  { key: 'EvenHaEzer',     api: "Shulchan_Arukh%2C_Even_HaEzer",      n: 178 },
  { key: 'ChoshenMishpat', api: "Shulchan_Arukh%2C_Choshen_Mishpat",  n: 427 },
];

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

async function fetchHeading(bookApi, n, retries = 3) {
  const url = `https://www.sefaria.org/api/texts/${bookApi}.${n}.1?context=0&pad=0&lang=he`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const data = await fetchJson(url);
      const he = Array.isArray(data.he) ? (data.he[0] ?? '') : (data.he ?? '');
      const text = typeof he === 'string' ? he : (Array.isArray(he) ? he[0] ?? '' : '');
      // Extract first bold heading
      const boldMatch = text.match(/<b[^>]*>([\s\S]*?)<\/b>/);
      const raw = boldMatch
        ? boldMatch[1].replace(/<[^>]+>/g, '').trim()
        : text.replace(/<[^>]+>/g, '').split('.')[0].trim().slice(0, 80);
      // Strip "ובו X סעיפים" suffix
      return raw.replace(/[\.\s]*ובו\s+[א-ת"']+\s+סעיפים?[:.]?$/, '').trim();
    } catch (e) {
      if (attempt === retries - 1) {
        process.stderr.write(`  [warn] ${bookApi} ${n}: ${e.message}\n`);
        return '';
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return '';
}

async function batchFetch(book, concurrency = 15) {
  const headings = new Array(book.n).fill('');
  let done = 0;

  for (let start = 0; start < book.n; start += concurrency) {
    const batch = [];
    for (let i = start; i < Math.min(start + concurrency, book.n); i++) {
      batch.push(fetchHeading(book.api, i + 1).then(h => { headings[i] = h; }));
    }
    await Promise.all(batch);
    done += batch.length;
    process.stderr.write(`  ${book.key}: ${done}/${book.n}\r`);
  }
  process.stderr.write('\n');
  return headings;
}

// ── Topic detection ───────────────────────────────────────────────────────────

const STRIP_PREFIXES = /^(דיני|הלכות|דין|כיצד|מי|מה|איזה|שלא|במה|שמותר|שאסור|שצריך|איסור|מצות|מצוות|שכר)\s+/;

function fingerprint(heading) {
  if (!heading) return '';
  return heading
    .replace(STRIP_PREFIXES, '')
    .replace(/\s*[\.\-].*/, '')   // cut at first period or dash
    .split(/\s+/)
    .slice(0, 2)
    .join(' ')
    .trim();
}

function detectBoundaries(headings) {
  // Returns array of { from, to, heading, fingerprint }
  const ranges = [];
  let rangeStart = 1;
  let rangeFingerprint = fingerprint(headings[0]);
  let rangeHeading = headings[0];

  for (let i = 1; i < headings.length; i++) {
    const fp = fingerprint(headings[i]);
    if (fp && fp !== rangeFingerprint) {
      ranges.push({ from: rangeStart, to: i, heading: rangeHeading, fingerprint: rangeFingerprint });
      rangeStart = i + 1;
      rangeFingerprint = fp;
      rangeHeading = headings[i];
    }
  }
  // Last range
  ranges.push({ from: rangeStart, to: headings.length, heading: rangeHeading, fingerprint: rangeFingerprint });
  return ranges;
}

// ── TypeScript generation ─────────────────────────────────────────────────────

function toTypeScript(ranges, constName) {
  const lines = [`export const ${constName}: TopicRange[] = [`];
  for (const r of ranges) {
    const from = String(r.from).padStart(3);
    const to   = String(r.to).padStart(3);
    const topic = r.topic ?? r.fingerprint;
    lines.push(`  { from: ${from}, to: ${to}, topic: "${topic}" },`);
  }
  lines.push('];');
  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Load or fetch headings
  let cache = {};
  if (!FRESH && existsSync(CACHE_FILE)) {
    cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    process.stderr.write('Using cached headings (pass --fresh to re-fetch)\n');
  }

  for (const book of BOOKS) {
    if (!cache[book.key]) {
      process.stderr.write(`Fetching ${book.key} (${book.n} simanim)...\n`);
      cache[book.key] = await batchFetch(book);
      writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    }
  }

  // Print raw headings + proposed ranges for each chelek
  for (const book of BOOKS) {
    const headings = cache[book.key];
    const ranges = detectBoundaries(headings);

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`## ${book.key} — ${book.n} simanim → ${ranges.length} proposed ranges`);
    console.log('');

    // Print numbered headings with range markers
    let rIdx = 0;
    for (let i = 0; i < headings.length; i++) {
      const siman = i + 1;
      const r = ranges[rIdx];
      if (r && r.from === siman) {
        console.log(`  ┌─ RANGE ${r.from}–${r.to}: fingerprint="${r.fingerprint}"`);
      }
      console.log(`  ${String(siman).padStart(3)}: ${headings[i]}`);
      if (r && r.to === siman) rIdx++;
    }

    console.log('');
    console.log('// ── Proposed TypeScript (review & edit before pasting) ──');
    console.log(toTypeScript(ranges, `${book.key.toUpperCase()}_TOPICS`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
