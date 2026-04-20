/**
 * Screenshot Otzar HaChochma pages for offline analysis.
 * Persists login session to cache/otzar/auth.json so re-login is rare.
 *
 * Usage:
 *   node scripts/screenshot-otzar.mjs <startPage> <endPage>
 *   e.g. node scripts/screenshot-otzar.mjs 256 285
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'cache', 'otzar', 'pages');
const AUTH_FILE = join(ROOT, 'cache', 'otzar', 'auth.json');
mkdirSync(CACHE_DIR, { recursive: true });

const [,, startPageArg, endPageArg] = process.argv;
const startPage = parseInt(startPageArg ?? '256', 10);
const endPage   = parseInt(endPageArg   ?? '285', 10);

const BASE_URL = 'https://tablet.otzar.org/#/b/149283/p/{PAGE}/t/1775389461114/fs/0/start/0/end/0/c/1775391800407';

// ── Open browser, optionally restore session ──────────────────────────────────
console.log('\n🔗 פותח דפדפן...');
const browser = await chromium.launch({ headless: false, slowMo: 30 });

const ctxOptions = existsSync(AUTH_FILE)
  ? { storageState: AUTH_FILE }
  : {};
const context = await browser.newContext(ctxOptions);
const page = await context.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

if (existsSync(AUTH_FILE)) {
  console.log('🍪 טוען סשן שמור...');
}

await page.goto(BASE_URL.replace('{PAGE}', startPage), {
  waitUntil: 'domcontentloaded', timeout: 30000,
});

// ── Check if already logged in ───────────────────────────────────────────────
async function isLoggedIn() {
  const text = await page.evaluate(() => document.body.innerText ?? '');
  const hasLoginWall = text.includes('הנך מחובר כאורח') && text.includes('אם הינך מנוי');
  const hebrewWords  = (text.match(/[\u05D0-\u05EA]{4,}/g) ?? []).length;
  return hebrewWords > 150 && !hasLoginWall;
}

// ── Wait for login if needed ──────────────────────────────────────────────────
await page.waitForTimeout(3000);
if (!(await isLoggedIn())) {
  console.log('\n⏳ נדרשת התחברות...');
  console.log('   הכנס שם משתמש וסיסמה בדפדפן שנפתח.');
  console.log('   הסקריפט ממשיך אוטומטית.\n');

  // Click login link if visible
  for (const sel of ['text=לחץ כאן להתחברות', 'a:has-text("התחברות")', 'text=לחץ כאן']) {
    try {
      if (await page.locator(sel).last().isVisible({ timeout: 1500 })) {
        await page.locator(sel).last().click();
        break;
      }
    } catch {}
  }

  for (let i = 0; i < 300; i++) {
    await page.waitForTimeout(1000);
    if (await isLoggedIn()) {
      console.log(`✅ מחובר!`);
      break;
    }
    if (i === 299) { console.error('❌ פג זמן'); await browser.close(); process.exit(1); }
    if (i % 20 === 19) console.log(`   [${i+1}s] ממתין...`);
  }

  // Save session for future runs
  await context.storageState({ path: AUTH_FILE });
  console.log(`💾 סשן נשמר: ${AUTH_FILE}`);
}

await page.waitForTimeout(1500);
// Close popups
for (const sel of ['[class*="close-popup"]', '.close-btn', 'text=לא תודה', 'text=סגור', 'text=אחר כך']) {
  try { if (await page.locator(sel).first().isVisible({ timeout: 600 })) { await page.locator(sel).first().click(); await page.waitForTimeout(400); } } catch {}
}

// ── Screenshot each page ──────────────────────────────────────────────────────
console.log(`\n📸 מצלם עמודים ${startPage}–${endPage}...\n`);

for (let p = startPage; p <= endPage; p++) {
  const filename = `page-0${String(p).padStart(3, '0')}.png`;
  const filepath = join(CACHE_DIR, filename);

  if (existsSync(filepath)) {
    console.log(`  ⏭  ${filename} — קיים`);
    continue;
  }

  await page.goto(BASE_URL.replace('{PAGE}', p), { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  // If login wall appeared mid-session, re-login
  if (!(await isLoggedIn())) {
    console.log(`  ⚠️  חסימת סשן בעמוד ${p} — מנסה שוב...`);
    for (const sel of ['text=לחץ כאן להתחברות', 'text=לחץ כאן']) {
      try { if (await page.locator(sel).last().isVisible({ timeout: 1000 })) { await page.locator(sel).last().click(); break; } } catch {}
    }
    await page.waitForTimeout(8000);
  }

  for (const sel of ['[class*="close-popup"]', '.close-btn']) {
    try { if (await page.locator(sel).first().isVisible({ timeout: 400 })) { await page.locator(sel).first().click(); await page.waitForTimeout(300); } } catch {}
  }

  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 ${filename}`);
  await page.waitForTimeout(300);
}

// Save updated session
await context.storageState({ path: AUTH_FILE });
console.log(`\n💾 סשן עודכן: ${AUTH_FILE}`);
console.log(`✅ נשמרו תמונות ב: cache/otzar/pages/\n`);
await browser.close();
