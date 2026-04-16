/**
 * Scrape Tur + Beit Yosef from Otzar HaChochma (שירת דבורה edition).
 * Usage:  node scripts/scrape-otzar.mjs [numPages]
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'cache', 'otzar');
mkdirSync(CACHE_DIR, { recursive: true });

const BOOK_URL = 'https://tablet.otzar.org/#/b/149283/p/142/t/1775389461114/fs/0/start/0/end/0/c/1775391800407';

function save(name, data) {
  const p = join(CACHE_DIR, name);
  writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return p;
}

async function shot(page, name) {
  await page.screenshot({ path: join(CACHE_DIR, name), fullPage: false });
  console.log(`  📸 ${name}`);
}

// ── Start ──────────────────────────────────────────────────────────────────────
console.log('\n🔗 פותח דפדפן...');
const browser = await chromium.launch({ headless: false, slowMo: 50 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto(BOOK_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

// ── Wait for page to load enough to show login link ────────────────────────────
console.log('⏳ ממתין לטעינת דף...');
await page.waitForTimeout(4000);

// ── Click login link if visible ────────────────────────────────────────────────
console.log('🔐 מחפש לינק התחברות...');
const loginSelectors = [
  'text=לחץ כאן להתחברות',
  'text=לחץ כאן',
  'a:has-text("התחברות")',
  'a:has-text("לחץ כאן")',
];
let clicked = false;
for (const sel of loginSelectors) {
  try {
    const el = page.locator(sel).last(); // last = subscriber login (not register)
    if (await el.isVisible({ timeout: 1500 })) {
      console.log(`  ✅ לוחץ: "${sel}"`);
      await el.click();
      clicked = true;
      break;
    }
  } catch {}
}
if (!clicked) {
  console.log('  ℹ️  לינק לא נמצא — ייתכן שכבר מחובר, ממשיך...');
}

await page.waitForTimeout(2000);
await shot(page, '01-login-screen.png');

// ── Wait for successful login (כאורח disappears AND page has content) ──────────
console.log('\n⏳ ממתין שתכנס למערכת...');
console.log('   הכנס שם משתמש וסיסמה בדפדפן.');
console.log('   הסקריפט ימשיך אוטומטית לאחר ההתחברות.\n');

for (let i = 0; i < 300; i++) {
  await page.waitForTimeout(1000);
  const text = await page.evaluate(() => document.body.innerText ?? '');

  // Logged in when: no login wall AND book pages visible
  const hasLoginWall = text.includes('הנך מחובר כאורח') || text.includes('להתחברות') && text.includes('אם הינך מנוי');
  const hebrewWords = (text.match(/[\u05D0-\u05EA]{4,}/g) ?? []).length;
  const hasBookContent = hebrewWords > 300 && !hasLoginWall;

  if (hasBookContent) {
    console.log(`✅ מחובר! ספר נטען (${hebrewWords} מילים, אין חסימת אורח).`);
    break;
  }

  if (i === 299) {
    console.error('❌ פג זמן ההמתנה.');
    await shot(page, 'timeout.png');
    await browser.close(); process.exit(1);
  }

  if (i % 15 === 14) {
    console.log(`   [${i+1}s] loginWall=${hasLoginWall}, hebrewWords=${hebrewWords}`);
    await shot(page, `progress-${i+1}s.png`);
  }
}

await page.waitForTimeout(2000);

// ── Close any popups ───────────────────────────────────────────────────────────
for (const sel of ['text=לא תודה', '[class*="close-popup"]', '.close-btn']) {
  try {
    if (await page.locator(sel).first().isVisible({ timeout: 800 })) {
      await page.locator(sel).first().click();
      console.log(`  ✅ סגר popup: ${sel}`);
      await page.waitForTimeout(500);
    }
  } catch {}
}

await shot(page, '02-after-login.png');

// ── Extract page text ──────────────────────────────────────────────────────────
console.log('\n📄 מחלץ טקסט מהעמוד...');
const state = await page.evaluate(() => {
  const allText = document.body.innerText.trim();

  // Find the main page/reading area
  const readerSelectors = [
    '.page-content', '.page-text', '.book-page', '.reading-area',
    '[class*="page-content"]', '[class*="book-content"]',
    '[class*="text-layer"]', '[class*="page-layer"]',
  ];
  let readerEl = null;
  let readerSel = null;
  for (const sel of readerSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText?.length > 200) {
      readerEl = el;
      readerSel = sel;
      break;
    }
  }

  // All classes on page
  const allClasses = new Set();
  document.querySelectorAll('*').forEach(el => el.classList.forEach(c => allClasses.add(c)));

  // Elements with lots of Hebrew
  const hebrewEls = [];
  const seen = new Set();
  document.querySelectorAll('div, p, article, section, span').forEach(el => {
    const text = el.innerText?.trim() ?? '';
    const hw = (text.match(/[\u05D0-\u05EA]{4,}/g) ?? []).length;
    if (hw >= 20 && !seen.has(text.slice(0, 50))) {
      seen.add(text.slice(0, 50));
      hebrewEls.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        classes: el.className?.slice(0, 80) || undefined,
        hebrewWords: hw,
        len: text.length,
        sample: text.slice(0, 300),
      });
    }
  });

  // Canvases
  const canvases = Array.from(document.querySelectorAll('canvas')).map(c => ({
    id: c.id, w: c.width, h: c.height, cls: c.className,
  }));

  return {
    url: location.href,
    allTextLen: allText.length,
    allClasses: [...allClasses].slice(0, 100),
    hebrewEls: hebrewEls.slice(0, 20),
    canvases,
    readerSel,
    readerHtml: readerEl?.innerHTML?.slice(0, 3000) ?? null,
    fullText: allText.slice(0, 5000),
  };
});

save('state.json', state);
save('full-text.txt', state.fullText);
if (state.readerHtml) save('reader-html.txt', state.readerHtml);

// ── Report ─────────────────────────────────────────────────────────────────────
console.log(`  URL: ${state.url}`);
console.log(`  Total text: ${state.allTextLen} chars`);
console.log(`  Canvases: ${state.canvases.length}`);
if (state.canvases.length) state.canvases.forEach(c => console.log(`    ${c.id||''}  ${c.w}×${c.h}  .${c.cls}`));
console.log(`  Reader selector: ${state.readerSel ?? 'לא נמצא'}`);

console.log(`\n  Hebrew-heavy elements (${state.hebrewEls.length}):`);
state.hebrewEls.forEach((el, i) => {
  const loc = `<${el.tag}${el.id?'#'+el.id:''}${el.classes?' .'+el.classes.split(' ')[0]:''}>`;
  console.log(`  ${i} ${loc}  ${el.hebrewWords}w ${el.len}c`);
  console.log(`    "${el.sample.replace(/\n/g,' ').slice(0, 120)}"`);
});

console.log('\n  Page classes:');
console.log(' ', state.allClasses.join(', '));

console.log('\n📄 תוכן הדף (1500 תווים):');
console.log('─'.repeat(70));
console.log(state.fullText.slice(0, 1500));

console.log('\n\n✅ סיום! בדוק cache/otzar/');
await page.waitForTimeout(5000);
await browser.close();
