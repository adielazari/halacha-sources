const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

// Special cases to avoid divine names
const SPECIALS: Record<number, string> = { 15: 'טו', 16: 'טז' };

export function toHebrewNumeral(n: number): string {
  if (n <= 0 || !Number.isInteger(n)) return String(n);

  let letters = '';
  let rem = n;

  if (rem >= 1000) {
    letters += ONES[Math.floor(rem / 1000)];
    rem %= 1000;
  }
  if (rem >= 100) {
    letters += HUNDREDS[Math.floor(rem / 100)];
    rem %= 100;
  }
  if (rem in SPECIALS) {
    letters += SPECIALS[rem];
    rem = 0;
  }
  if (rem >= 10) {
    letters += TENS[Math.floor(rem / 10)];
    rem %= 10;
  }
  if (rem > 0) {
    letters += ONES[rem];
  }

  // Add geresh at the end (as user showed: א׳, י׳, ש׳, שא׳)
  return letters + '׳';
}

const LETTER_VALUES: Record<string, number> = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
  'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
};

// Parses Hebrew numeral string (e.g. "שא׳", "י׳", "א") → number, or null if invalid
export function fromHebrewNumeral(s: string): number | null {
  // Strip geresh/gershayim and whitespace
  const clean = s.replace(/[׳״'\s]/g, '');
  if (!clean) return null;

  let total = 0;
  for (const ch of clean) {
    const val = LETTER_VALUES[ch];
    if (val === undefined) return null;
    total += val;
  }
  return total > 0 ? total : null;
}
