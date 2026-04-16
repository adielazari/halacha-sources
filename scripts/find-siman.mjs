/**
 * Find which Otzar page contains a given siman.
 * Scans pages in chunks and checks the header text.
 *
 * Usage: node scripts/find-siman.mjs <simanHebrew> [startPage] [endPage]
 * e.g.:  node scripts/find-siman.mjs רצד 250 430
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'cache', 'otzar', 'scan');
mkdirSync(CACHE_DIR, { recursive: true });

const [,, simanTarget = 'רצד', startArg = '240', endArg = '430'] = process.argv;
const startPage = parseInt(startArg);
const endPage   = parseInt(endArg);

const BASE_URL = 'https://tablet.otzar.org/#/b/149283/p/{PAGE}/t/1775389461114/fs/0/start/0/end/0/c/1775391800407';

console.log(`\n🔍 מחפש סימן ${simanTarget} בעמודים ${startPage}–${endPage}...\n`);

const browser = await chromium.launch({ headless: false, slowMo: 20 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

await page.goto(BASE_URL.replace('{PAGE}', startPage), {
  waitUntil: 'domcontentloaded', timeout: 30000,
});

// Wait for login
console.log('⏳ ממתין להתחברות...');
for (let i = 0; i < 300; i++) {
  await page.waitForTimeout(1000);
  const text = await page.evaluate(() => document.body.innerText ?? '');
  const wall = text.includes('הנך מחובר כאורח') && text.includes('אם הינך מנוי');
  const hw   = (text.match(/[\u05D0-\u05EA]{4,}/g) ?? []).length;
  if (hw > 150 && !wall) { console.log(`✅ מחובר`); break; }
  if (i === 299) { await browser.close(); process.exit(1); }
  if (i % 20 === 19) console.log(`   [${i+1}s]`);
}
await page.waitForTimeout(1000);
for (const sel of ['[class*="close-popup"]', '.close-btn', 'text=לא תודה']) {
  try { if (await page.locator(sel).first().isVisible({ timeout: 400 })) { await page.locator(sel).first().click(); } } catch {}
}

// Scan pages — step by 3 to be faster, then refine
const hits = [];
const STEP = 3;

for (let p = startPage; p <= endPage; p += STEP) {
  await page.goto(BASE_URL.replace('{PAGE}', p), { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  const text = await page.evaluate(() => document.body.innerText ?? '');

  if (text.includes(simanTarget)) {
    console.log(`  🎯 מצאתי "${simanTarget}" בעמוד ${p}!`);
    hits.push(p);

    // Take screenshot
    const shot = join(CACHE_DIR, `found-p${p}.png`);
    await page.screenshot({ path: shot });
    console.log(`     📸 ${shot}`);

    // Refine: scan around this page one-by-one
    for (let pp = Math.max(startPage, p - STEP + 1); pp < p; pp++) {
      await page.goto(BASE_URL.replace('{PAGE}', pp), { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(1200);
      const t2 = await page.evaluate(() => document.body.innerText ?? '');
      if (t2.includes(simanTarget)) {
        console.log(`     ↩️  also at ${pp}`);
        hits.push(pp);
      }
    }

    // Found it — keep scanning to find the full range
  } else {
    const header = text.split('\n').find(l => /[רצ][פשד]/.test(l) || /סימן/.test(l));
    if (header) process.stdout.write(`  p${p}: ${header.trim().slice(0,50)}\n`);
    else process.stdout.write(`  p${p}: (no header found)\n`);
  }
}

hits.sort((a,b)=>a-b);
const result = { simanTarget, hits, firstPage: hits[0] ?? null };
writeFileSync(join(CACHE_DIR, `siman-${simanTarget}.json`), JSON.stringify(result, null, 2));

console.log(`\n✅ תוצאה: סימן ${simanTarget} נמצא בעמודים: ${hits.join(', ') || 'לא נמצא'}`);
console.log(`   עמוד ראשון: ${result.firstPage}`);

await browser.close();
