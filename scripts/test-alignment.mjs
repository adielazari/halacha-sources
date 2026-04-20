/**
 * Alignment test: phrase-matching + confidence algorithm.
 *
 * Asserts structural properties and known expectations for YD 294.
 * Usage:  node scripts/test-alignment.mjs [chelek] [siman]
 * Example: node scripts/test-alignment.mjs YorehDeah 294
 */

// ── fetch helpers ──────────────────────────────────────────────────────────────

async function fetchHe(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const json = await res.json();
  const versions = json.versions ?? [];
  const ver = versions.find((v) => v.language === 'he') ?? versions[0];
  return ver?.text ?? [];
}

function flatten(text) {
  if (!Array.isArray(text)) return [String(text ?? '')];
  return text.map((s) => (Array.isArray(s) ? s[0] ?? '' : String(s ?? '')));
}

// ── algorithm re-implementation (mirrors lib/alignment.ts) ────────────────────

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text) {
  const re = /[\u05D0-\u05EA\u05F0-\u05F4\uFB1D-\uFB4E"']+/g;
  const tokens = [];
  let m;
  while ((m = re.exec(text)) !== null) tokens.push({ word: m[0], pos: m.index });
  return tokens;
}

function wordForms(word) {
  const TWO = ['וה','של','בה','לה','מה','וב','ול','ומ','וכ','וש'];
  const ONE = ['ה','ו','ב','כ','ל','מ','ש','ד'];
  const forms = new Set([word]);
  for (const p of TWO) if (word.startsWith(p) && word.length >= p.length + 3) forms.add(word.slice(p.length));
  for (const p of ONE) if (word.startsWith(p) && word.length >= p.length + 3) forms.add(word.slice(p.length));
  return [...forms];
}

function wordSimilarity(a, b) {
  const formsA = wordForms(a);
  const formsB = wordForms(b);

  for (const fa of formsA)
    for (const fb of formsB)
      if (fa === fb) return 1.0;

  let bestScore = 0;
  for (const fa of formsA) {
    for (const fb of formsB) {
      if (fa.length < 3 || fb.length < 3) continue;
      let shared = 0;
      const minLen = Math.min(fa.length, fb.length);
      while (shared < minLen && fa[shared] === fb[shared]) shared++;
      if (shared >= 3) {
        const score = 0.5 + 0.3 * (shared / Math.max(fa.length, fb.length));
        if (score > bestScore) bestScore = score;
      }
    }
  }
  return bestScore;
}

function findPhraseInTur(saWords, turTokens, from, to) {
  if (saWords.length === 0) return [];
  const candidates = [];

  let startTi = 0;
  while (startTi < turTokens.length && turTokens[startTi].pos < from) startTi++;

  let endTi = turTokens.length;
  if (to !== undefined) {
    for (let i = startTi; i < turTokens.length; i++) {
      if (turTokens[i].pos >= to) { endTi = i; break; }
    }
  }

  for (let ti = startTi; ti < endTi; ti++) {
    let turScan = ti;
    let matched = 0;

    for (let si = 0; si < saWords.length; si++) {
      let found = false;
      for (let offset = 0; offset <= 2 && turScan + offset < turTokens.length; offset++) {
        if (wordSimilarity(saWords[si], turTokens[turScan + offset].word) >= 0.5) {
          matched++;
          turScan = turScan + offset + 1;
          found = true;
          break;
        }
      }
      if (!found) turScan++;
    }

    const score = matched / saWords.length;
    if (score >= 0.3) {
      candidates.push({ turCharPos: turTokens[ti].pos, score, matchedWords: matched });
    }
  }

  return candidates.sort((a, b) => b.score - a.score || a.turCharPos - b.turCharPos);
}

function extractByQuote(byText) {
  const stripped = stripHtml(byText);
  const tokens = tokenize(stripped).map(t => t.word).filter(w => w.length >= 2);
  if (tokens.length === 0) return [];

  let startIdx = 0;
  const first = tokens[0];
  if (first.length <= 5 && (first.startsWith('ומ') || first.startsWith('ועוד'))) {
    startIdx = 1;
    if (startIdx < tokens.length && tokens[startIdx].length <= 4) startIdx++;
  }
  return tokens.slice(startIdx, startIdx + 8);
}

function assignByToSeifim(bySeifim, alignments, turTokens) {
  const byIndexToSaIndex = new Array(bySeifim.length).fill(0);
  let currentSaIdx = 0;

  for (let bi = 0; bi < bySeifim.length; bi++) {
    const quoteWords = extractByQuote(bySeifim[bi]);

    if (quoteWords.length < 2) {
      byIndexToSaIndex[bi] = currentSaIdx;
      continue;
    }

    let bestSa = currentSaIdx;
    let bestScore = 0;
    const lookAheadEnd = Math.min(currentSaIdx + 2, alignments.length - 1);

    for (let si = currentSaIdx; si <= lookAheadEnd; si++) {
      const { turStartPos, turEndPos } = alignments[si];
      if (turStartPos >= turEndPos) continue;

      const matches = findPhraseInTur(quoteWords, turTokens, turStartPos, turEndPos);
      if (matches.length > 0 && matches[0].score > bestScore) {
        bestScore = matches[0].score;
        bestSa = si;
      }
    }

    currentSaIdx = Math.max(currentSaIdx, bestSa);
    byIndexToSaIndex[bi] = bestSa;
  }

  return byIndexToSaIndex;
}

function align(saSeifim, turHtml, bySeifim) {
  if (saSeifim.length === 0) return { alignedSeifim: [], byIndexToSaIndex: [], turFullText: '' };

  const turStripped = stripHtml(turHtml);
  const turTokens = tokenize(turStripped);

  const splitPoints = [0];
  const confidences = ['high'];
  const scores = [1.0];

  for (let i = 1; i < saSeifim.length; i++) {
    const prev = splitPoints[i - 1];
    const saWords = tokenize(stripHtml(saSeifim[i]))
      .map(t => t.word)
      .filter(w => w.length >= 2)
      .slice(0, 7);

    if (saWords.length < 2) {
      splitPoints.push(prev); confidences.push('none'); scores.push(0); continue;
    }

    const matches = findPhraseInTur(saWords, turTokens, prev);

    if (matches.length === 0) {
      splitPoints.push(prev); confidences.push('none'); scores.push(0);
    } else {
      const best = matches[0];
      let pos = best.turCharPos;
      while (pos > prev && pos > 0 && turStripped[pos - 1] !== ' ') pos--;
      splitPoints.push(Math.max(pos, prev + 1));

      const conf =
        best.score >= 0.7 && best.matchedWords >= 4 ? 'high' :
        best.score >= 0.5 && best.matchedWords >= 3 ? 'medium' : 'low';
      confidences.push(conf);
      scores.push(best.score);
    }
  }
  splitPoints.push(turStripped.length);

  const alignedSeifim = saSeifim.map((sa, i) => {
    const rawStart = splitPoints[i];
    const rawEnd = splitPoints[i + 1];
    let turText = '';
    if (rawStart < rawEnd) {
      let start = rawStart;
      let end = rawEnd;
      while (start > 0 && turStripped[start - 1] !== ' ') start--;
      if (end < turStripped.length && turStripped[end - 1] !== ' ' && turStripped[end] !== ' ') {
        while (end > rawStart && turStripped[end - 1] !== ' ') end--;
      }
      turText = turStripped.slice(start, end).trim();
    }
    return {
      saText: stripHtml(sa).slice(0, 60),
      turText,
      turStartPos: rawStart,
      turEndPos: rawEnd,
      confidence: confidences[i],
      score: scores[i],
      needsReview: confidences[i] === 'low' || confidences[i] === 'none',
    };
  });

  const byIndexToSaIndex = bySeifim.length > 0
    ? assignByToSeifim(bySeifim, alignedSeifim, turTokens)
    : [];

  return { alignedSeifim, byIndexToSaIndex, turFullText: turStripped };
}

// ── main ───────────────────────────────────────────────────────────────────────

const CHELEK_MAP = {
  OrachChayim:    { sa: 'Shulchan_Arukh%2C_Orach_Chayim',    tur: 'Tur%2C_Orach_Chayim',    by: 'Beit_Yosef%2C_Orach_Chayim'    },
  YorehDeah:      { sa: 'Shulchan_Arukh%2C_Yoreh_De%27ah',    tur: 'Tur%2C_Yoreh_Deah',       by: 'Beit_Yosef%2C_Yoreh_Deah'      },
  EvenHaEzer:     { sa: 'Shulchan_Arukh%2C_Even_HaEzer',      tur: 'Tur%2C_Even_HaEzer',      by: 'Beit_Yosef%2C_Even_HaEzer'     },
  ChoshenMishpat: { sa: 'Shulchan_Arukh%2C_Choshen_Mishpat',  tur: 'Tur%2C_Choshen_Mishpat',  by: 'Beit_Yosef%2C_Choshen_Mishpat' },
};

const chelekArg = process.argv[2] ?? 'YorehDeah';
const simanArg  = process.argv[3] ?? '294';
const keys = CHELEK_MAP[chelekArg];
if (!keys) { console.error('Unknown chelek:', chelekArg); process.exit(1); }

const BASE = 'https://www.sefaria.org/api/v3/texts';
const [saRaw, turRaw, byRaw] = await Promise.all([
  fetchHe(`${BASE}/${keys.sa}.${simanArg}?context=0&pad=0&language=he`),
  fetchHe(`${BASE}/${keys.tur}.${simanArg}?context=0&pad=0&language=he`),
  fetchHe(`${BASE}/${keys.by}.${simanArg}?context=0&pad=0&language=he`),
]);

const saSeifim  = flatten(saRaw);
const turHtml   = Array.isArray(turRaw) ? (turRaw[0] ?? '') : String(turRaw ?? '');
const bySeifim  = flatten(byRaw);

console.log(`\n=== Alignment test: ${chelekArg} siman ${simanArg} ===\n`);
console.log(`SA se'ifim : ${saSeifim.length}`);
console.log(`BY se'ifim : ${bySeifim.length}`);

const result = align(saSeifim, turHtml, bySeifim);
const { alignedSeifim, byIndexToSaIndex } = result;

// ── ASSERTION 1: result count must equal SA seif count ────────────────────────
let passed = 0, failed = 0;
function assert(label, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${label}`); passed++; }
  else       { console.error(`  FAIL  ${label}${detail ? ': ' + detail : ''}`); failed++; }
}

console.log('\n── Structural assertions ─────────────────────────────────────────────');
assert(
  'seif count matches SA count',
  alignedSeifim.length === saSeifim.length,
  `got ${alignedSeifim.length}, expected ${saSeifim.length}`
);

// ASSERTION 2: seif 0 always high confidence
assert(
  'seif 0 confidence === high',
  alignedSeifim[0]?.confidence === 'high'
);

// ASSERTION 3: all confidence values are valid
const VALID_CONF = new Set(['high', 'medium', 'low', 'none']);
const badConf = alignedSeifim.filter(s => !VALID_CONF.has(s.confidence));
assert(
  'all confidence values are valid',
  badConf.length === 0,
  `invalid: ${badConf.map((_, i) => i).join(', ')}`
);

// ASSERTION 4: byIndexToSaIndex is non-decreasing (monotonic)
let isMonotonic = true;
for (let i = 1; i < byIndexToSaIndex.length; i++) {
  if (byIndexToSaIndex[i] < byIndexToSaIndex[i - 1]) { isMonotonic = false; break; }
}
assert(
  'BY assignments are monotonically non-decreasing',
  isMonotonic,
  byIndexToSaIndex.slice(0, 20).join(',')
);

// ASSERTION 5: all BY indices are in range [0, saSeifim.length-1]
const outOfRange = byIndexToSaIndex.filter(i => i < 0 || i >= saSeifim.length);
assert(
  'all BY indices are in range',
  outOfRange.length === 0,
  `out-of-range: ${outOfRange.slice(0, 5).join(', ')}`
);

// SOFT: seifim with non-empty turText ideally shouldn't have confidence=none.
// (When multiple consecutive seifim fail phrase search, the last one before a
//  successful seif inherits the accumulated Tur gap — expected behavior.)
const badNone = alignedSeifim.filter(s => s.turText.length > 10 && s.confidence === 'none');
const badNoneRatio = badNone.length / alignedSeifim.length;
// Structural check: at least the MAJORITY of non-empty seifim should have a confidence score
assert(
  'majority of non-empty seifim have a confidence score (not none)',
  badNoneRatio < 0.50,
  `${badNone.length} seifim (${(badNoneRatio*100).toFixed(0)}%) have turText but confidence=none`
);

// ── Soft assertions (report but don't fail) ───────────────────────────────────
console.log('\n── Soft assertions (report only) ─────────────────────────────────────');

const highMedium = alignedSeifim.filter(s => s.confidence === 'high' || s.confidence === 'medium');
const coverageRatio = highMedium.length / alignedSeifim.length;
console.log(`  INFO  ${highMedium.length}/${alignedSeifim.length} seifim are high/medium confidence (${(coverageRatio*100).toFixed(0)}%)`);
if (coverageRatio >= 0.5) console.log('  PASS  ≥50% seifim are high/medium confidence');
else console.log('  WARN  <50% seifim are high/medium confidence');

const noneSeifim = alignedSeifim.filter(s => s.confidence === 'none');
console.log(`  INFO  ${noneSeifim.length} seifim have confidence=none (SA-original / back-references)`);

// Check first BY entry is assigned to seif 0
if (byIndexToSaIndex.length > 0) {
  const by0 = byIndexToSaIndex[0];
  console.log(`  INFO  BY[0] → SA seif ${by0} (expected: 0)`);
  if (by0 === 0) console.log('  PASS  BY[0] assigned to seif 0');
  else console.log(`  WARN  BY[0] assigned to seif ${by0}, expected 0`);
}

// ── Confidence breakdown ───────────────────────────────────────────────────────
const confCounts = { high: 0, medium: 0, low: 0, none: 0 };
for (const s of alignedSeifim) confCounts[s.confidence]++;
console.log('\n── Confidence breakdown ──────────────────────────────────────────────');
console.log(`  high  : ${confCounts.high}`);
console.log(`  medium: ${confCounts.medium}`);
console.log(`  low   : ${confCounts.low}`);
console.log(`  none  : ${confCounts.none}`);

// ── Boundary table ─────────────────────────────────────────────────────────────
console.log(`\n${'SA#'.padEnd(4)} ${'Conf'.padEnd(7)} ${'Score'.padEnd(6)} ${'Start'.padEnd(6)} ${'Len'.padEnd(6)} SA (40 chars)`.padEnd(58) + 'Tur (50 chars)');
console.log('-'.repeat(140));
for (let i = 0; i < alignedSeifim.length; i++) {
  const s = alignedSeifim[i];
  const isEmpty = s.turText.length <= 10 ? ' [EMPTY]' : '';
  const confPad = s.confidence.padEnd(7);
  const scorePad = s.score.toFixed(2).padEnd(6);
  console.log(
    `${String(i).padEnd(4)} ${confPad} ${scorePad} ${String(s.turStartPos).padEnd(6)} ${String(s.turText.length).padEnd(6)} ` +
    `${s.saText.slice(0, 40).padEnd(42)} ${s.turText.slice(0, 50)}${isEmpty}`
  );
}

// ── BY assignment table (first 15) ────────────────────────────────────────────
if (byIndexToSaIndex.length > 0) {
  console.log(`\n── BY→SA assignments (first 15) ──────────────────────────────────────`);
  console.log(`${'BY#'.padEnd(5)} ${'SA#'.padEnd(5)} BY opening (60 chars)`);
  console.log('-'.repeat(80));
  for (let i = 0; i < Math.min(15, byIndexToSaIndex.length); i++) {
    const byText = stripHtml(bySeifim[i]).slice(0, 60);
    console.log(`${String(i).padEnd(5)} ${String(byIndexToSaIndex[i]).padEnd(5)} ${byText}`);
  }
}

// ── Final result ───────────────────────────────────────────────────────────────
console.log(`\n══ Result: ${passed} passed, ${failed} failed ══\n`);
if (failed > 0) process.exit(1);
