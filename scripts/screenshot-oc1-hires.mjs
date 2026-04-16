/**
 * Screenshot Otzar HaChochma pages for Orach Chaim siman 1.
 * Saves high-res crops to cache/otzar/oc1-book/.
 *
 * Usage: node scripts/screenshot-oc1-hires.mjs <bookId> <startPage> <endPage>
 *   e.g. node scripts/screenshot-oc1-hires.mjs 123456 1 15
 *
 * Find the bookId first: node scripts/find-oc-book.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'cache', 'otzar', 'oc1-book');
mkdirSync(CACHE_DIR, { recursive: true });

const [,, bookIdArg, startPageArg, endPageArg] = process.argv;

if (!bookIdArg) {
  console.error('Usage: node scripts/screenshot-oc1-hires.mjs <bookId> <startPage> <endPage>');
  console.error('Find the book ID first: node scripts/find-oc-book.mjs');
  process.exit(1);
}

const BOOK_ID   = bookIdArg;
const startPage = parseInt(startPageArg ?? '1', 10);
const endPage   = parseInt(endPageArg   ?? '20', 10);

// Build URL — using same fragment pattern as YD scripts
// YD example: https://tablet.otzar.org/#/b/149283/p/{PAGE}/t/1775389461114/fs/0/start/0/end/0/c/1775391800407
// For OC we use a simpler URL without the /t/.../c/... part, which still works
const BASE_URL = `https://tablet.otzar.org/#/b/${BOOK_ID}/p/{PAGE}/fs/0/start/0/end/0`;

console.log(`\n📚 ספר OC: book ID ${BOOK_ID}`);
console.log(`📸 מצלם עמודים ${startPage}–${endPage} → cache/otzar/oc1-book/\n`);

const browser = await chromium.launch({ headless: false, slowMo: 20 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });

await page.goto(BASE_URL.replace('{PAGE}', startPage), {
  waitUntil: 'domcontentloaded', timeout: 30000,
});

// ── Wait for login ─────────────────────────────────────────────────────────────
console.log('\n⏳ ממתין שתתחבר...');
for (let i = 0; i < 300; i++) {
  await page.waitForTimeout(1000);
  const text = await page.evaluate(() => document.body.innerText ?? '');
  const hasLoginWall = text.includes('הנך מחובר כאורח') && text.includes('אם הינך מנוי');
  const hebrewWords  = (text.match(/[\u05D0-\u05EA]{4,}/g) ?? []).length;
  if (hebrewWords > 150 && !hasLoginWall) {
    console.log(`✅ מחובר (${hebrewWords} מילים)`);
    break;
  }
  if (i === 299) { await browser.close(); process.exit(1); }
  if (i % 20 === 19) console.log(`   [${i+1}s] hebrewWords=${hebrewWords}`);
}

await page.waitForTimeout(1500);
for (const sel of ['[class*="close-popup"]', '.close-btn', 'text=לא תודה', 'text=סגור', 'text=אחר כך']) {
  try { if (await page.locator(sel).first().isVisible({ timeout: 500 })) { await page.locator(sel).first().click(); await page.waitForTimeout(400); } } catch {}
}

// ── Wait for book image ────────────────────────────────────────────────────────
async function waitForBookImage(timeout = 10000) {
  const selectors = ['img[src*="page"]', 'img[src*="image"]', 'img[src*="img"]', 'canvas', '.page-img', '[class*="page-image"]'];
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      try {
        const els = await page.locator(sel).all();
        for (const el of els) {
          const box = await el.boundingBox().catch(() => null);
          if (box && box.width > 200 && box.height > 300) return { el, box, sel };
        }
      } catch {}
    }
    const found = await page.evaluate(() => {
      for (const el of document.querySelectorAll('img')) {
        const r = el.getBoundingClientRect();
        if (r.width > 200 && r.height > 300 && el.complete && el.naturalWidth > 100) {
          return { x: r.x, y: r.y, width: r.width, height: r.height, src: el.src?.slice(0,80) };
        }
      }
      return null;
    });
    if (found) return found;
    await page.waitForTimeout(300);
  }
  return null;
}

async function screenshotBookArea(outputPath) {
  const bookImg = await waitForBookImage(8000);

  if (bookImg && bookImg.width) {
    const pad = 5;
    const clip = {
      x: Math.max(0, bookImg.x - pad),
      y: Math.max(0, bookImg.y - pad),
      width:  Math.min(bookImg.width  + pad*2, 1600),
      height: Math.min(bookImg.height + pad*2, 1000),
    };
    console.log(`  📐 crop: ${Math.round(clip.width)}×${Math.round(clip.height)} at (${Math.round(clip.x)},${Math.round(clip.y)})`);
    await page.screenshot({ path: outputPath, clip });
    return 'cropped';
  } else if (bookImg && bookImg.el) {
    await bookImg.el.screenshot({ path: outputPath });
    return 'element';
  } else {
    console.log(`  ⚠️  לא נמצאה תמונת ספר — מצלם הכל`);
    await page.screenshot({ path: outputPath });
    return 'full';
  }
}

// ── Main loop ──────────────────────────────────────────────────────────────────
for (let p = startPage; p <= endPage; p++) {
  const filename = `page-${String(p).padStart(4, '0')}.png`;
  const filepath = join(CACHE_DIR, filename);

  if (existsSync(filepath)) {
    console.log(`  ⏭  ${filename} — קיים`);
    continue;
  }

  await page.goto(BASE_URL.replace('{PAGE}', p), {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });

  for (const sel of ['[class*="close-popup"]', '.close-btn', 'text=אחר כך']) {
    try { if (await page.locator(sel).first().isVisible({ timeout: 400 })) { await page.locator(sel).first().click(); await page.waitForTimeout(300); } } catch {}
  }

  const method = await screenshotBookArea(filepath);
  console.log(`  📸 ${filename} (${method})`);
}

console.log(`\n✅ סיום! תמונות ב: cache/otzar/oc1-book/`);
await browser.close();
