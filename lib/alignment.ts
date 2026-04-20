export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export interface AlignedSeif {
  saText: string;
  turText: string;
  turStartPos: number;
  turEndPos: number;
  bySeifim: string[];
  confidence: ConfidenceLevel;
  score: number;
  needsReview: boolean;
}

export interface AlignmentResult {
  alignedSeifim: AlignedSeif[];
  byIndexToSaIndex: number[]; // byIndexToSaIndex[byIdx] = saIdx
  turFullText: string;
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Tokenize Hebrew text into words with their char positions.
function tokenize(text: string): Array<{ word: string; pos: number }> {
  const tokens: Array<{ word: string; pos: number }> = [];
  const re = /[\u05D0-\u05EA\u05F0-\u05F4\uFB1D-\uFB4E"']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ word: m[0], pos: m.index });
  }
  return tokens;
}

// Return all normalized forms of a word by stripping common Hebrew prefixes.
function wordForms(word: string): string[] {
  const TWO = ['וה', 'של', 'בה', 'לה', 'מה', 'וב', 'ול', 'ומ', 'וכ', 'וש'];
  const ONE = ['ה', 'ו', 'ב', 'כ', 'ל', 'מ', 'ש', 'ד'];
  const forms = new Set<string>([word]);
  for (let j = 0; j < TWO.length; j++) {
    const pfx = TWO[j];
    if (word.startsWith(pfx) && word.length >= pfx.length + 3)
      forms.add(word.slice(pfx.length));
  }
  for (let j = 0; j < ONE.length; j++) {
    const pfx = ONE[j];
    if (word.startsWith(pfx) && word.length >= pfx.length + 3)
      forms.add(word.slice(pfx.length));
  }
  return Array.from(forms);
}

// ─── Word similarity ──────────────────────────────────────────────────────────

// Returns 0.0–1.0: 1.0=exact form match, 0.5–0.8=shared prefix>=3, 0=no match.
function wordSimilarity(a: string, b: string): number {
  const formsA = wordForms(a);
  const formsB = wordForms(b);

  // Exact match of any normalized form
  for (let i = 0; i < formsA.length; i++) {
    for (let j = 0; j < formsB.length; j++) {
      if (formsA[i] === formsB[j]) return 1.0;
    }
  }

  // Shared prefix >= 3 chars
  let bestScore = 0;
  for (let i = 0; i < formsA.length; i++) {
    for (let j = 0; j < formsB.length; j++) {
      const fa = formsA[i];
      const fb = formsB[j];
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

// ─── Phrase search ────────────────────────────────────────────────────────────

interface PhraseMatch {
  turCharPos: number;
  score: number;
  matchedWords: number;
}

// Search for saWords (first N words of a SA seif) as a phrase in the Tur,
// starting at char position `from` and ending before `to`.
// Allows up to 2 skip positions between matched words (Tur may have extra words).
// Returns candidates sorted by score desc (best match first).
function findPhraseInTur(
  saWords: string[],
  turTokens: Array<{ word: string; pos: number }>,
  from: number,
  to?: number
): PhraseMatch[] {
  if (saWords.length === 0) return [];

  const candidates: PhraseMatch[] = [];

  // Find first token at or after char position `from`
  let startTi = 0;
  while (startTi < turTokens.length && turTokens[startTi].pos < from) startTi++;

  // Find first token at or after char position `to`
  let endTi = turTokens.length;
  if (to !== undefined) {
    for (let i = startTi; i < turTokens.length; i++) {
      if (turTokens[i].pos >= to) { endTi = i; break; }
    }
  }

  for (let ti = startTi; ti < endTi; ti++) {
    let turScan = ti;
    let matched = 0;
    let firstMatchPos = -1; // char pos of the first matched SA word in Tur

    for (let si = 0; si < saWords.length; si++) {
      let found = false;
      // Look ahead 0–2 positions for a matching Tur word
      for (let offset = 0; offset <= 2 && turScan + offset < turTokens.length; offset++) {
        const sim = wordSimilarity(saWords[si], turTokens[turScan + offset].word);
        if (sim >= 0.5) {
          if (firstMatchPos < 0) firstMatchPos = turTokens[turScan + offset].pos;
          matched++;
          turScan = turScan + offset + 1;
          found = true;
          break;
        }
      }
      if (!found) {
        // If the next SA word would match at the current turScan position,
        // the current SA word is absent from the Tur — skip it without advancing.
        // Otherwise the Tur has an extra word here — advance past it.
        const nextSa = si + 1 < saWords.length ? saWords[si + 1] : null;
        let nextMatches = false;
        if (nextSa) {
          for (let off = 0; off <= 2 && turScan + off < turTokens.length; off++) {
            if (wordSimilarity(nextSa, turTokens[turScan + off].word) >= 0.5) {
              nextMatches = true;
              break;
            }
          }
        }
        if (!nextMatches) turScan++;
      }
    }

    const score = matched / saWords.length;
    if (score >= 0.3) {
      candidates.push({
        // Use the position of the first matched word, not the search window start.
        // This prevents including leading unmatched words in the split point.
        turCharPos: firstMatchPos >= 0 ? firstMatchPos : turTokens[ti].pos,
        score,
        matchedWords: matched,
      });
    }
  }

  // Best match first; ties broken by earliest position
  return candidates.sort((a, b) => b.score - a.score || a.turCharPos - b.turCharPos);
}

// ─── BY assignment via HTML markers ───────────────────────────────────────────

// Extract stripped-text positions of each Beit Yosef data-order marker in the Tur HTML.
// Returns an array indexed by data-order value (1-based), where each entry is the
// stripped-text char position of that marker.
// data-order=N is placed at the START of what BY seif N+1 discusses in the Tur.
// Therefore BY seif M (1-based) discusses Tur starting at markerPositions[M-1]
// (or 0 for M=1).
function extractByMarkerPositions(turHtml: string): number[] {
  const re = /<i data-commentator="Beit Yosef" data-order="(\d+)\.\d+"><\/i>/g;
  const byMarkers: Array<{ orderN: number; htmlPos: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(turHtml)) !== null) {
    byMarkers.push({ orderN: parseInt(m[1], 10), htmlPos: m.index });
  }
  if (byMarkers.length === 0) return [];

  // Sort by orderN to handle out-of-order markup
  byMarkers.sort((a, b) => a.orderN - b.orderN);
  const maxOrder = byMarkers[byMarkers.length - 1].orderN;

  // Convert html positions to stripped-text positions
  const strippedPositions: number[] = new Array(maxOrder + 1).fill(-1);
  let htmlPos = 0;
  let strippedPos = 0;
  let inTag = false;
  let mIdx = 0;

  // Walk the HTML string once, recording stripped positions for each marker
  const targets = byMarkers.map((bm) => ({ ...bm, done: false }));
  for (let i = 0; i < turHtml.length; i++) {
    const c = turHtml[i];
    if (c === '<') { inTag = true; }
    else if (c === '>') { inTag = false; }
    else if (!inTag) { strippedPos++; }

    // Check if any marker starts at this html position
    while (mIdx < targets.length && targets[mIdx].htmlPos === i) {
      strippedPositions[targets[mIdx].orderN] = strippedPos;
      mIdx++;
    }
  }

  return strippedPositions; // index = data-order value (1-based), value = stripped pos
}

// Assign each BY entry (0-based bi) to a SA seif using HTML data-order markers.
// BY seif M (1-based = bi+1) discusses Tur text starting at markerPositions[M-1]
// (or 0 for M=1). We find which SA seif's range contains that position.
function assignByToSeifim(
  bySeifim: string[],
  alignments: Array<{ turStartPos: number; turEndPos: number }>,
  turHtml: string
): number[] {
  const markerPositions = extractByMarkerPositions(turHtml);
  const byIndexToSaIndex: number[] = new Array(bySeifim.length).fill(0);

  for (let bi = 0; bi < bySeifim.length; bi++) {
    const bySeifM = bi + 1; // 1-based
    // Tur position this BY entry discusses starts at markerPositions[M-1] (or 0)
    const turPos = bySeifM > 1 && markerPositions[bySeifM - 1] >= 0
      ? markerPositions[bySeifM - 1]
      : 0;

    // Find SA seif whose [turStartPos, turEndPos) contains turPos.
    // If turPos lands within BOUNDARY_TOLERANCE chars of the END of a seif,
    // the BY marker belongs to the NEXT seif (it was placed just before the boundary).
    const BOUNDARY_TOLERANCE = 25;
    let saIdx = 0;
    for (let si = 0; si < alignments.length; si++) {
      const { turStartPos, turEndPos } = alignments[si];
      if (turEndPos <= turStartPos) continue; // empty (SA-original) — skip
      if (turStartPos <= turPos && turPos < turEndPos) {
        // Check if turPos is within tolerance of the NEXT seif boundary
        const nextStart = si + 1 < alignments.length ? alignments[si + 1].turStartPos : Infinity;
        if (nextStart < Infinity && turPos >= nextStart - BOUNDARY_TOLERANCE) {
          // Belongs to next non-empty seif
          let next = si + 1;
          while (next < alignments.length && alignments[next].turEndPos <= alignments[next].turStartPos) next++;
          saIdx = next < alignments.length ? next : si;
        } else {
          saIdx = si;
        }
        break;
      }
      // turPos is past this seif — keep advancing
      if (turPos >= turStartPos) saIdx = si;
    }

    byIndexToSaIndex[bi] = saIdx;
  }

  return byIndexToSaIndex;
}

// ─── Physical ground-truth alignment ──────────────────────────────────────────

export interface PhysicalMapping {
  siman: number;
  chelek: string;
  turSeifim: Array<{
    seifNumber: number;
    turFirstWords: string | null;
    isSaOriginal?: boolean;
    isCombinedWithPrev?: boolean;
    isCombinedWithNext?: boolean;
  }>;
  bySeifim: Array<{
    byMarker: string;
    saSeifimCovered: number[];
    sefariaByIndices: number[];
  }>;
}

// Align using physical ground-truth first-words extracted from Otzar HaChochma scans.
// All located split points get confidence 'high'. SA-original seifim get confidence 'none'.
// BY assignment uses sefariaByIndices directly — no marker position heuristics.
export function physicalAlign(
  saSeifim: string[],
  turHtml: string,
  bySeifim: string[],
  mapping: PhysicalMapping
): AlignmentResult {
  if (saSeifim.length === 0) {
    return { alignedSeifim: [], byIndexToSaIndex: [], turFullText: '' };
  }

  const turStripped = stripHtml(turHtml);
  const turTokens = tokenize(turStripped);

  // Index mapping data by seifNumber for O(1) lookup
  const seifByNumber = new Map(mapping.turSeifim.map((s) => [s.seifNumber, s]));

  // Compute split points and per-seif confidence/score
  const splitPoints: number[] = [0];
  const confidences: ConfidenceLevel[] = [];
  const scores: number[] = [];

  // Seif 1 (index 0) always starts at position 0
  const firstSeif = seifByNumber.get(1);
  confidences.push(firstSeif?.isSaOriginal ? 'none' : 'high');
  scores.push(firstSeif?.isSaOriginal ? 0 : 1.0);

  for (let i = 1; i < saSeifim.length; i++) {
    const seifNum = i + 1;
    const seifData = seifByNumber.get(seifNum);
    const prev = splitPoints[i - 1];

    // Seif shares Tur passage with previous seif — same split point
    if (seifData?.isCombinedWithPrev) {
      splitPoints.push(prev);
      confidences.push('high');
      scores.push(1.0);
      continue;
    }

    // SA-original or no first-words available — no Tur content
    if (!seifData || seifData.isSaOriginal || seifData.turFirstWords === null) {
      splitPoints.push(prev);
      confidences.push('none');
      scores.push(0);
      continue;
    }

    // Search for the physical first-words in the Tur text
    const phraseWords = tokenize(seifData.turFirstWords)
      .map((t) => t.word)
      .filter((w) => w.length >= 2);

    const matches = findPhraseInTur(phraseWords, turTokens, prev);

    if (matches.length > 0 && matches[0].score >= 0.7) {
      let pos = matches[0].turCharPos;
      // Snap backward to word boundary
      while (pos > prev && pos > 0 && turStripped[pos - 1] !== ' ') pos--;
      splitPoints.push(Math.max(pos, prev + 1));
      confidences.push('high');
      scores.push(matches[0].score);
    } else {
      console.warn(
        `[physicalAlign] seif ${seifNum}: turFirstWords not found` +
        ` (best score: ${matches[0]?.score?.toFixed(2) ?? 'n/a'}).` +
        ` Words: "${seifData.turFirstWords}"`
      );
      splitPoints.push(prev);
      confidences.push('none');
      scores.push(0);
    }
  }
  splitPoints.push(turStripped.length);

  // Build aligned seifim — mirrors alignTexts() building logic
  const alignedSeifim: AlignedSeif[] = saSeifim.map((sa, i) => {
    const rawStart = splitPoints[i];
    let rawEnd = splitPoints[i + 1];

    // Combined-with-prev or SA-immediately-after: advance rawEnd to next distinct split
    if (rawStart >= rawEnd && confidences[i] !== 'none') {
      for (let j = i + 2; j < splitPoints.length; j++) {
        if (splitPoints[j] > rawStart) { rawEnd = splitPoints[j]; break; }
      }
    }

    if (confidences[i] === 'none') {
      return {
        saText: sa,
        turText: '',
        turStartPos: rawStart,
        turEndPos: rawStart,
        bySeifim: [],
        confidence: 'none' as ConfidenceLevel,
        score: 0,
        needsReview: false, // known absent — not an algorithm uncertainty
      };
    }

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
      saText: sa,
      turText,
      turStartPos: rawStart,
      turEndPos: rawEnd,
      bySeifim: [],
      confidence: 'high',
      score: scores[i],
      needsReview: false,
    };
  });

  // Build byIndexToSaIndex directly from sefariaByIndices — no marker heuristics
  const byIndexToSaIndex: number[] = new Array(bySeifim.length).fill(0);
  for (const byEntry of mapping.bySeifim) {
    const saIdx = byEntry.saSeifimCovered[0] - 1; // convert 1-based to 0-based
    for (const byIdx of byEntry.sefariaByIndices) {
      if (byIdx >= 0 && byIdx < bySeifim.length) {
        byIndexToSaIndex[byIdx] = saIdx;
      }
    }
  }

  // Group BY texts per SA seif
  const bySeifsForSa: string[][] = saSeifim.map(() => []);
  for (let bi = 0; bi < bySeifim.length; bi++) {
    const saIdx = byIndexToSaIndex[bi];
    if (saIdx >= 0 && saIdx < bySeifsForSa.length) {
      bySeifsForSa[saIdx].push(bySeifim[bi]);
    }
  }
  for (let i = 0; i < alignedSeifim.length; i++) {
    alignedSeifim[i].bySeifim = bySeifsForSa[i];
  }

  return { alignedSeifim, byIndexToSaIndex, turFullText: turStripped };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function alignTexts(
  saSeifim: string[],
  turHtml: string,
  bySeifim: string[],
  overrides: Record<number, number> = {}
): AlignmentResult {
  if (saSeifim.length === 0) {
    return { alignedSeifim: [], byIndexToSaIndex: [], turFullText: '' };
  }

  const turStripped = stripHtml(turHtml);
  const turTokens = tokenize(turStripped);

  // Compute split points: seif 0 always starts at char 0.
  // For seif i (i ≥ 1): phrase-search the first 7 SA words in the Tur from prev split.
  const splitPoints: number[] = [0];
  const confidences: ConfidenceLevel[] = ['high'];
  const scores: number[] = [1.0];

  for (let i = 1; i < saSeifim.length; i++) {
    const prev = splitPoints[i - 1];

    // User override takes precedence
    if (overrides[i] !== undefined) {
      splitPoints.push(Math.max(overrides[i], prev + 1));
      confidences.push('high');
      scores.push(1.0);
      continue;
    }

    const saWords = tokenize(stripHtml(saSeifim[i]))
      .map((t) => t.word)
      .filter((w) => w.length >= 2)
      .slice(0, 7);

    if (saWords.length < 2) {
      splitPoints.push(prev);
      confidences.push('none');
      scores.push(0);
      continue;
    }

    const matches = findPhraseInTur(saWords, turTokens, prev);

    if (matches.length === 0) {
      // SA-original seif not present in Tur
      splitPoints.push(prev);
      confidences.push('none');
      scores.push(0);
    } else {
      const best = matches[0];
      // Snap backward to word boundary
      let pos = best.turCharPos;
      while (pos > prev && pos > 0 && turStripped[pos - 1] !== ' ') pos--;
      splitPoints.push(Math.max(pos, prev + 1));

      const conf: ConfidenceLevel =
        best.score >= 0.7 && best.matchedWords >= 4 ? 'high' :
        best.score >= 0.5 && best.matchedWords >= 3 ? 'medium' :
        'low';
      confidences.push(conf);
      scores.push(best.score);
    }
  }
  splitPoints.push(turStripped.length);

  // Build aligned seifim (BY populated below)
  const alignedSeifim: AlignedSeif[] = saSeifim.map((sa, i) => {
    const rawStart = splitPoints[i];
    let rawEnd = splitPoints[i + 1];

    // When a non-SA-original seif has a zero-length segment (rawStart === rawEnd),
    // it means the next seif(s) are SA-original (pushed same split point).
    // Advance rawEnd to the first split point that is strictly greater than rawStart,
    // so this seif gets its Tur content rather than ceding it to an SA-original neighbor.
    if (rawStart >= rawEnd && confidences[i] !== 'none') {
      for (let j = i + 2; j < splitPoints.length; j++) {
        if (splitPoints[j] > rawStart) { rawEnd = splitPoints[j]; break; }
      }
    }

    let turText = '';
    // SA-original seifs have no Tur content — skip text extraction entirely.
    if (confidences[i] === 'none') {
      return {
        saText: sa,
        turText: '',
        turStartPos: rawStart,
        turEndPos: rawStart,
        bySeifim: [],
        confidence: 'none' as ConfidenceLevel,
        score: 0,
        needsReview: true,
      };
    }
    if (rawStart < rawEnd) {
      let start = rawStart;
      let end = rawEnd;
      // Snap start backward to word boundary
      while (start > 0 && turStripped[start - 1] !== ' ') start--;
      // Snap end backward if mid-word
      if (end < turStripped.length && turStripped[end - 1] !== ' ' && turStripped[end] !== ' ') {
        while (end > rawStart && turStripped[end - 1] !== ' ') end--;
      }
      turText = turStripped.slice(start, end).trim();
    }

    return {
      saText: sa,
      turText,
      turStartPos: rawStart,
      turEndPos: rawEnd,
      bySeifim: [],
      confidence: confidences[i],
      score: scores[i],
      needsReview: confidences[i] === 'low',
    };
  });

  // Assign BY entries to SA seifim via HTML data-order markers
  const byIndexToSaIndex = assignByToSeifim(bySeifim, alignedSeifim, turHtml);

  // Group BY texts per SA seif
  const bySeifsForSa: string[][] = saSeifim.map(() => []);
  for (let bi = 0; bi < bySeifim.length; bi++) {
    const saIdx = byIndexToSaIndex[bi];
    if (saIdx >= 0 && saIdx < bySeifsForSa.length) {
      bySeifsForSa[saIdx].push(bySeifim[bi]);
    }
  }
  for (let i = 0; i < alignedSeifim.length; i++) {
    alignedSeifim[i].bySeifim = bySeifsForSa[i];
  }

  return { alignedSeifim, byIndexToSaIndex, turFullText: turStripped };
}
