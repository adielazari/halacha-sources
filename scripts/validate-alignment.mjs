/**
 * Validate alignment algorithm output against ground truth from Otzar scans.
 *
 * Usage:
 *   node scripts/validate-alignment.mjs YorehDeah 294
 *   node scripts/validate-alignment.mjs YorehDeah 294 --fetch   (re-fetch from API)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const [,, chelek = 'YorehDeah', simanArg = '294', ...flags] = process.argv;
const siman = parseInt(simanArg, 10);
const doFetch = flags.includes('--fetch');

// ── Load ground truth ──────────────────────────────────────────────────────────
const gtPath = join(ROOT, 'cache', 'otzar', 'ground-truth', `yd${siman}.json`);
if (!existsSync(gtPath)) {
  console.error(`❌ No ground truth file at ${gtPath}`);
  process.exit(1);
}
const gt = JSON.parse(readFileSync(gtPath, 'utf8'));

// ── Load algorithm output ──────────────────────────────────────────────────────
let alignedSeifim;

if (doFetch) {
  const url = `http://localhost:3000/api/siman-texts?chelek=${chelek}&siman=${siman}`;
  console.log(`📡 Fetching from ${url}...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`❌ Fetch failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  alignedSeifim = data.alignedSeifim;
} else {
  // Load from saved data files
  const indexPath = join(ROOT, 'data', chelek, String(siman), 'index.json');
  if (!existsSync(indexPath)) {
    console.error(`❌ No saved data at ${indexPath}. Run: node scripts/save-siman.mjs ${chelek} ${siman}`);
    process.exit(1);
  }
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  alignedSeifim = index.seifim.map((s, i) => {
    const seifFile = join(ROOT, 'data', chelek, String(siman), s.file);
    const seifData = JSON.parse(readFileSync(seifFile, 'utf8'));
    return {
      seifIndex: i,
      saText: seifData.sa.text,
      turText: seifData.tur.text,
      confidence: seifData.alignment.confidence,
      score: seifData.alignment.score,
      needsReview: seifData.alignment.needsReview,
    };
  });
}

// ── Compare ────────────────────────────────────────────────────────────────────
console.log(`\n📋 Validation: ${chelek} ${siman} (${gt.seifim.length} seifim)\n`);
console.log('Ground truth source:', gt.source);
console.log('');

const issues = [];
let confirmed = 0, misaligned = 0, saOriginal = 0, unknown = 0;

for (const gtSeif of gt.seifim) {
  const i = gtSeif.seifNumber - 1;
  const alg = alignedSeifim[i];

  if (!alg) {
    console.log(`❓ Seif ${gtSeif.seifNumber}: not in algorithm output`);
    unknown++;
    continue;
  }

  const dot = { high: '🟢', medium: '🟡', low: '🟠', none: '🔴' }[alg.confidence] ?? '⚪';
  const algTur = alg.turText?.slice(0, 50) ?? '(empty)';
  const gtTur = gtSeif.turFirstWords?.slice(0, 50) ?? '(empty)';

  // Compare: does algorithm Tur start match ground truth?
  const algWords = alg.turText?.split(/\s+/).slice(0, 5).join(' ') ?? '';
  const gtWords = gtSeif.turFirstWords?.split(/\s+/).slice(0, 5).join(' ') ?? '';

  let status;
  if (gtSeif.confidence === 'sa_original') {
    status = alg.turText ? '⚠️  SA-original but has Tur text' : '✅ SA-original (empty Tur)';
    saOriginal++;
  } else if (gtSeif.confidence === 'suspected_algorithm_error') {
    status = `⚠️  KNOWN ALGORITHM ERROR`;
    issues.push({ seifNumber: gtSeif.seifNumber, note: gtSeif.notes });
    misaligned++;
  } else if (!alg.turText && gtSeif.turFirstWords) {
    status = `❌ Empty Tur but ground truth has text`;
    issues.push({ seifNumber: gtSeif.seifNumber, expected: gtTur, got: '(empty)' });
    misaligned++;
  } else if (gtSeif.confidence === 'confirmed') {
    // Check if GT phrase appears in algorithm's first 20 words (algorithm may start a few words early)
    const algFirst20 = alg.turText?.split(/\s+/).slice(0, 20).join(' ') ?? '';
    const gtFirst4 = gtSeif.turFirstWords?.split(/\s+/).slice(0, 4).join(' ') ?? '';
    const phraseFound = algFirst20.includes(gtFirst4.slice(0, 12));  // check first 12 chars of 4-word phrase

    if (phraseFound) {
      const offsetWords = findPhraseOffset(alg.turText, gtFirst4);
      if (offsetWords === 0) {
        status = `✅ Exact match`;
        confirmed++;
      } else {
        status = `⚠️  Match but starts ${offsetWords} words too early (split point offset)`;
        issues.push({ seifNumber: gtSeif.seifNumber, expected: gtTur, got: algTur, offsetWords });
        misaligned++;
      }
    } else {
      status = `❌ Mismatch — phrase not found`;
      issues.push({ seifNumber: gtSeif.seifNumber, expected: gtTur, got: algTur });
      misaligned++;
    }
  } else {
    // inferred — just show for review
    status = `ℹ️  Inferred`;
    confirmed++;
  }

  console.log(`${dot} Seif ${String(gtSeif.seifNumber).padStart(2)}: ${status}`);
  if (gtSeif.confidence === 'confirmed' || gtSeif.confidence === 'suspected_algorithm_error') {
    console.log(`     GT:  ${gtTur}`);
    console.log(`     Alg: ${algTur}`);
  }
  if (gtSeif.notes && (gtSeif.confidence === 'suspected_algorithm_error' || status.startsWith('❌'))) {
    console.log(`     Note: ${gtSeif.notes.slice(0, 100)}`);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`\n📊 Summary:`);
console.log(`  ✅ OK/confirmed:  ${confirmed}`);
console.log(`  ❌ Misaligned:    ${misaligned}`);
console.log(`  📄 SA-original:   ${saOriginal}`);
console.log(`  ❓ Unknown:       ${unknown}`);

if (issues.length > 0) {
  console.log(`\n🔧 Issues to fix:`);
  for (const iss of issues) {
    console.log(`\n  Seif ${iss.seifNumber}:`);
    if (iss.note) console.log(`    ${iss.note}`);
    if (iss.expected) console.log(`    Expected Tur: "${iss.expected}"`);
    if (iss.got) console.log(`    Algorithm:    "${iss.got}"`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function computeWordOverlap(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }
  return common / Math.max(wordsA.size, wordsB.size);
}

function findPhraseOffset(text, phrase) {
  if (!text || !phrase) return -1;
  const words = text.split(/\s+/);
  const phraseWords = phrase.split(/\s+/);
  for (let i = 0; i < Math.min(words.length, 20); i++) {
    let match = true;
    for (let j = 0; j < phraseWords.length && i + j < words.length; j++) {
      // Strip nikud/punctuation for comparison
      const a = words[i + j].replace(/[\u05B0-\u05C7"']/g, '');
      const b = phraseWords[j].replace(/[\u05B0-\u05C7"']/g, '');
      if (a !== b) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}
