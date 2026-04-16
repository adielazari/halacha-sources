/**
 * Fetch aligned Tur + Beit Yosef data for a siman and save locally.
 *
 * Usage:
 *   node scripts/save-siman.mjs YorehDeah 294
 *   node scripts/save-siman.mjs OrachChayim 25
 *
 * Output:
 *   data/YorehDeah/294/index.json  — full aligned structure
 *   data/YorehDeah/294/seif-01.json, seif-02.json, ...
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const [,, chelek, simanArg] = process.argv;
if (!chelek || !simanArg) {
  console.error('Usage: node scripts/save-siman.mjs <chelek> <siman>');
  console.error('  e.g. node scripts/save-siman.mjs YorehDeah 294');
  process.exit(1);
}

const siman = parseInt(simanArg, 10);
if (isNaN(siman)) {
  console.error('siman must be a number');
  process.exit(1);
}

// ── Fetch from local dev server ──────────────────────────────────────────────
const url = `http://localhost:3000/api/siman-texts?chelek=${chelek}&siman=${siman}`;
console.log(`\n📡 Fetching ${chelek} ${siman}...`);
console.log(`   ${url}\n`);

let data;
try {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  data = await res.json();
} catch (e) {
  console.error('❌ Fetch failed:', e.message);
  console.error('   Is the dev server running? npm run dev');
  process.exit(1);
}

const { saSeifim, alignedSeifim, turFullText } = data;
console.log(`✅ Got ${alignedSeifim.length} seifim`);

// ── Confidence summary ────────────────────────────────────────────────────────
const counts = { high: 0, medium: 0, low: 0, none: 0 };
for (const s of alignedSeifim) counts[s.confidence] = (counts[s.confidence] ?? 0) + 1;
console.log(`   Confidence: high=${counts.high} medium=${counts.medium} low=${counts.low} none=${counts.none}`);

// ── Build output dir ──────────────────────────────────────────────────────────
const dir = join(ROOT, 'data', chelek, String(siman));
mkdirSync(dir, { recursive: true });

// ── Strip HTML helper ─────────────────────────────────────────────────────────
function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ── Build per-seif files ──────────────────────────────────────────────────────
const seifimIndex = [];

for (let i = 0; i < alignedSeifim.length; i++) {
  const s = alignedSeifim[i];
  const num = String(i + 1).padStart(2, '0');

  const seifData = {
    seifIndex: i,
    seifNumber: i + 1,

    // SA (Shulchan Aruch) text
    sa: {
      html: s.saText,
      text: stripHtml(s.saText),
    },

    // Tur text (aligned segment)
    tur: {
      text: s.turText,
      startPos: s.turStartPos,
      endPos: s.turEndPos,
    },

    // Beit Yosef seifim aligned to this SA seif
    beitYosef: s.bySeifim.map((by, bi) => ({
      index: bi,
      text: by,
    })),

    // Alignment metadata
    alignment: {
      confidence: s.confidence,
      score: s.score,
      needsReview: s.needsReview,
    },
  };

  const filename = `seif-${num}.json`;
  writeFileSync(join(dir, filename), JSON.stringify(seifData, null, 2));

  seifimIndex.push({
    seifIndex: i,
    seifNumber: i + 1,
    saSnippet: stripHtml(s.saText).slice(0, 80),
    turSnippet: s.turText.slice(0, 80),
    byCount: s.bySeifim.length,
    confidence: s.confidence,
    score: parseFloat(s.score.toFixed(3)),
    needsReview: s.needsReview,
    file: filename,
  });
}

// ── index.json ────────────────────────────────────────────────────────────────
const index = {
  chelek,
  siman,
  seifimCount: alignedSeifim.length,
  confidenceSummary: counts,
  turFullText,
  seifim: seifimIndex,
  generatedAt: new Date().toISOString(),
};

writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2));

// ── Report ────────────────────────────────────────────────────────────────────
console.log(`\n📁 Saved to data/${chelek}/${siman}/`);
console.log(`   index.json + ${alignedSeifim.length} seif-NN.json files\n`);

console.log('Seif  Confidence  Score  BY  SA snippet');
console.log('─'.repeat(70));
for (const s of seifimIndex) {
  const dot = { high: '🟢', medium: '🟡', low: '🟠', none: '🔴' }[s.confidence] ?? '⚪';
  console.log(
    `${String(s.seifNumber).padStart(3)}   ${dot} ${s.confidence.padEnd(7)}  ${s.score.toFixed(2)}   ${s.byCount}   ${s.saSnippet.slice(0, 50)}`
  );
}
console.log();
