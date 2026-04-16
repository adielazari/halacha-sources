/**
 * Validate physical-alignment output against the ground-truth mapping.
 *
 * Usage (dev server must be running on localhost:3000):
 *   node scripts/validate-physical-alignment.mjs YorehDeah 294
 *
 * What is checked:
 *   - All non-SA-original seifim have non-empty turText
 *   - turText for seifim 6, 9 starts with the correct physical first-words
 *   - seifim 10, 11 are SA-original (no Tur marker on page 327) — no turText expected
 *   - BY distribution matches sefariaByIndices exactly
 *   - No BY entry is unassigned (maps to a valid SA seif index)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const [,, chelek = 'YorehDeah', simanArg = '294'] = process.argv;
const siman = parseInt(simanArg, 10);

// ── Load physical mapping ──────────────────────────────────────────────────────
const mappingPath = join(ROOT, 'data', chelek, String(siman), 'physical-mapping.json');
if (!existsSync(mappingPath)) {
  console.error(`No physical mapping at ${mappingPath}`);
  process.exit(1);
}
const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'));

// ── Fetch aligned output from API ─────────────────────────────────────────────
const url = `http://localhost:3000/api/siman-texts?chelek=${chelek}&siman=${siman}`;
console.log(`Fetching ${url} ...`);
let data;
try {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    process.exit(1);
  }
  data = await res.json();
} catch (e) {
  console.error(`Fetch failed: ${e.message}`);
  console.error('Make sure the dev server is running: npm run dev');
  process.exit(1);
}

const { alignedSeifim, byIndexToSaIndex } = data;
console.log(`\nPhysical-alignment validation: ${chelek} ${siman}\n`);

// ── Build lookup from mapping ──────────────────────────────────────────────────
const saOriginalSeifs = new Set(
  mapping.turSeifim.filter(s => s.isSaOriginal).map(s => s.seifNumber)
);
const combinedWithPrev = new Set(
  mapping.turSeifim.filter(s => s.isCombinedWithPrev).map(s => s.seifNumber)
);

// Expected turFirstWords per seifNumber
const expectedFirstWords = new Map(
  mapping.turSeifim
    .filter(s => s.turFirstWords)
    .map(s => [s.seifNumber, s.turFirstWords])
);

// ── 1. Tur text presence check ─────────────────────────────────────────────────
console.log('── Tur split-point check ──');
let turOk = 0, turFail = 0;

for (const seifData of mapping.turSeifim) {
  const i = seifData.seifNumber - 1;
  const aligned = alignedSeifim[i];
  if (!aligned) {
    console.log(`  MISS seif ${seifData.seifNumber}: not in output`);
    turFail++;
    continue;
  }

  if (seifData.isSaOriginal) {
    const status = !aligned.turText ? 'OK (SA-original, empty)' : 'FAIL (SA-original has Tur text)';
    const mark = !aligned.turText ? '' : 'FAIL';
    if (mark) { console.log(`  ${mark} seif ${seifData.seifNumber}: ${status}`); turFail++; }
    else turOk++;
    continue;
  }

  if (seifData.isCombinedWithPrev) {
    // Combined seifim share the previous seif's turText — just check non-empty
    const prevAligned = alignedSeifim[i - 1];
    if (aligned.turText) {
      turOk++;
    } else if (prevAligned?.turText) {
      // turText may be on prev — acceptable
      turOk++;
    } else {
      console.log(`  FAIL seif ${seifData.seifNumber}: combined-with-prev but both empty`);
      turFail++;
    }
    continue;
  }

  if (!aligned.turText) {
    console.log(`  FAIL seif ${seifData.seifNumber}: empty turText (expected: "${seifData.turFirstWords?.slice(0, 40)}")`);
    turFail++;
    continue;
  }

  // Check first-words match
  const expected = seifData.turFirstWords;
  const expWords = expected.split(/\s+/).slice(0, 4).join(' ');
  const algFirst50 = aligned.turText.split(/\s+/).slice(0, 15).join(' ');
  const expStripped = expWords.replace(/[\u05B0-\u05C7"'״׳]/g, '');
  const algStripped = algFirst50.replace(/[\u05B0-\u05C7"'״׳]/g, '');
  const found = algStripped.includes(expStripped.slice(0, 12));

  if (found) {
    const offset = findWordOffset(aligned.turText, expWords);
    if (offset === 0) {
      turOk++;
    } else {
      console.log(`  WARN seif ${seifData.seifNumber}: starts ${offset} word(s) late`);
      console.log(`       Expected: "${expected.slice(0, 50)}"`);
      console.log(`       Got:      "${aligned.turText.slice(0, 50)}"`);
      turFail++;
    }
  } else {
    console.log(`  FAIL seif ${seifData.seifNumber}: first-words not found`);
    console.log(`       Expected: "${expected.slice(0, 50)}"`);
    console.log(`       Got:      "${aligned.turText.slice(0, 50)}"`);
    turFail++;
  }
}

console.log(`  Result: ${turOk} OK, ${turFail} failed\n`);

// ── 2. BY assignment check ─────────────────────────────────────────────────────
console.log('── BY assignment check ──');
let byOk = 0, byFail = 0;

for (const byEntry of mapping.bySeifim) {
  const expectedSaIdx = byEntry.saSeifimCovered[0] - 1; // 0-based
  for (const byIdx of byEntry.sefariaByIndices) {
    const actualSaIdx = byIndexToSaIndex[byIdx];
    if (actualSaIdx === undefined || actualSaIdx === null) {
      console.log(`  FAIL by[${byIdx}]: unassigned (expected SA seif ${byEntry.saSeifimCovered[0]})`);
      byFail++;
    } else if (actualSaIdx !== expectedSaIdx) {
      console.log(`  FAIL by[${byIdx}]: assigned to SA ${actualSaIdx + 1}, expected SA ${expectedSaIdx + 1} (marker ${byEntry.byMarker})`);
      byFail++;
    } else {
      byOk++;
    }
  }
}

// Check that all BY indices are covered
const totalBy = byIndexToSaIndex.length;
let uncovered = 0;
for (let bi = 0; bi < totalBy; bi++) {
  const covered = mapping.bySeifim.some(e => e.sefariaByIndices.includes(bi));
  if (!covered) {
    console.log(`  WARN by[${bi}]: not listed in mapping (assigned to SA ${(byIndexToSaIndex[bi] ?? 0) + 1})`);
    uncovered++;
  }
}

console.log(`  Result: ${byOk} OK, ${byFail} failed${uncovered ? `, ${uncovered} uncovered` : ''}\n`);

// ── 3. Key regression checks ───────────────────────────────────────────────────
console.log('── Key regression checks (previously broken seifim) ──');
const regressions = [
  { seif: 6,  expected: 'שנה חמישית נקראין' },
  { seif: 9,  expected: 'הלכך בארץ ישראל' },
  // seifim 10, 11 are SA-original — no turText expected
];
let regrOk = 0, regrFail = 0;
for (const { seif, expected } of regressions) {
  const aligned = alignedSeifim[seif - 1];
  const turStart = aligned?.turText?.split(/\s+/).slice(0, 5).join(' ') ?? '(empty)';
  const expStripped = expected.replace(/[\u05B0-\u05C7"'״׳]/g, '');
  const algStripped = turStart.replace(/[\u05B0-\u05C7"'״׳]/g, '');
  if (algStripped.includes(expStripped.slice(0, 10))) {
    console.log(`  OK  seif ${seif}: "${turStart}"`);
    regrOk++;
  } else {
    console.log(`  FAIL seif ${seif}: expected "${expected}", got "${turStart}"`);
    regrFail++;
  }
}

console.log(`  Result: ${regrOk} OK, ${regrFail} failed\n`);

// ── 4. BY ה regression (was assigned to SA seif 4, should be 5) ─────────────
console.log('── BY ה regression check (by[8] → SA seif 5) ──');
const by8SaIdx = byIndexToSaIndex[8];
if (by8SaIdx === 4) { // 0-based index 4 = seif 5
  console.log('  OK  by[8] correctly assigned to SA seif 5\n');
} else {
  console.log(`  FAIL by[8] assigned to SA seif ${(by8SaIdx ?? -1) + 1}, expected 5\n`);
}

// ── Summary ────────────────────────────────────────────────────────────────────
const totalFail = turFail + byFail + regrFail + (by8SaIdx !== 4 ? 1 : 0);
console.log('─'.repeat(50));
console.log(`Overall: ${totalFail === 0 ? 'ALL CHECKS PASSED' : `${totalFail} FAILURES`}`);

// ── Helpers ────────────────────────────────────────────────────────────────────
function findWordOffset(text, phrase) {
  if (!text || !phrase) return -1;
  const words = text.split(/\s+/);
  const phraseWords = phrase.split(/\s+/);
  for (let i = 0; i < Math.min(words.length, 20); i++) {
    let match = true;
    for (let j = 0; j < phraseWords.length && i + j < words.length; j++) {
      const a = words[i + j].replace(/[\u05B0-\u05C7"'״׳]/g, '');
      const b = phraseWords[j].replace(/[\u05B0-\u05C7"'״׳]/g, '');
      if (a !== b) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}
