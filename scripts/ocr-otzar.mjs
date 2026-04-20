/**
 * OCR Otzar HaChochma scanned pages to extract SA seif boundary markers.
 *
 * Usage:
 *   node scripts/ocr-otzar.mjs <startPage> <endPage> [outputFile]
 *   e.g. node scripts/ocr-otzar.mjs 142 150 cache/otzar/yd294-seifim.json
 *
 * The browser will open. Log in manually if needed, then the script
 * navigates each page, screenshots it, and asks Claude Vision to identify
 * where each SA seif begins in the Tur / Beit Yosef text.
 *
 * Requires: ANTHROPIC_API_KEY env var
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'cache', 'otzar', 'pages');
mkdirSync(CACHE_DIR, { recursive: true });

// ── Args ──────────────────────────────────────────────────────────────────────
const [,, startPageArg, endPageArg, outputFileArg] = process.argv;
const startPage = parseInt(startPageArg ?? '142', 10);
const endPage = parseInt(endPageArg ?? '150', 10);
const outputFile = outputFileArg ?? join(ROOT, 'cache', 'otzar', 'seif-boundaries.json');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY env var not set');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Book URL template — replace page number
const BASE_URL = 'https://tablet.otzar.org/#/b/149283/p/{PAGE}/t/1775389461114/fs/0/start/0/end/0/c/1775391800407';

// ── Open browser ──────────────────────────────────────────────────────────────
console.log('\n🔗 פותח דפדפן...');
const browser = await chromium.launch({ headless: false, slowMo: 30 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// ── Navigate to first page and wait for login ────────────────────────────────
const firstUrl = BASE_URL.replace('{PAGE}', startPage);
await page.goto(firstUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

console.log('\n⏳ ממתין לטעינה...');
console.log('   אם צריך להתחבר — היכנס לאוצר החכמה בדפדפן שנפתח.');
console.log('   הסקריפט ממשיך אוטומטית לאחר ההתחברות.\n');

// Wait for book content to be visible (not guest wall)
for (let i = 0; i < 300; i++) {
  await page.waitForTimeout(1000);
  const text = await page.evaluate(() => document.body.innerText ?? '');
  const hasLoginWall = text.includes('הנך מחובר כאורח') &&
                       text.includes('אם הינך מנוי');
  const hebrewWords = (text.match(/[\u05D0-\u05EA]{4,}/g) ?? []).length;

  if (hebrewWords > 150 && !hasLoginWall) {
    console.log(`✅ מחובר (${hebrewWords} מילים עבריות)`);
    break;
  }
  if (i === 299) {
    console.error('❌ פג זמן ההמתנה.');
    await browser.close(); process.exit(1);
  }
  if (i % 20 === 19) console.log(`   [${i+1}s] מחכה... (hebrewWords=${hebrewWords}, loginWall=${hasLoginWall})`);
}

// Close popups
await page.waitForTimeout(1500);
for (const sel of ['[class*="close-popup"]', '.close-btn', 'text=לא תודה', 'text=סגור']) {
  try {
    if (await page.locator(sel).first().isVisible({ timeout: 600 })) {
      await page.locator(sel).first().click();
      await page.waitForTimeout(400);
    }
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function navigateToPage(pageNum) {
  const url = BASE_URL.replace('{PAGE}', pageNum);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500); // let renderer settle
  // Close any new popups
  for (const sel of ['[class*="close-popup"]', '.close-btn']) {
    try {
      if (await page.locator(sel).first().isVisible({ timeout: 400 })) {
        await page.locator(sel).first().click();
        await page.waitForTimeout(300);
      }
    } catch {}
  }
}

async function screenshotPage(pageNum) {
  const path = join(CACHE_DIR, `page-${String(pageNum).padStart(4,'0')}.png`);
  if (existsSync(path)) {
    console.log(`  📂 משתמש בצילום קיים: page-${pageNum}.png`);
    return path;
  }
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 page-${pageNum}.png`);
  return path;
}

async function analyzePageWithClaude(imagePath, pageNum) {
  const imageData = readFileSync(imagePath).toString('base64');

  const prompt = `זוהי תמונה סרוקה של ספר הטור עם פירוש הבית יוסף, מהדורת מכון שירת דבורה.

המהדורה הזו מחולקת לפי סעיפי השולחן ערוך. אני צריך לדעת אילו מילים מסמנות את תחילת כל סעיף של השולחן ערוך בתוך טקסט הטור ובתוך טקסט הבית יוסף.

אנא זהה:
1. האם בעמוד הזה יש סימנים/מספרים המציינים תחילת סעיף חדש של השולחן ערוך?
2. לכל סעיף שמתחיל בעמוד הזה: ציין את מספר הסעיף (לפי השו"ע) ואת המילים הראשונות של הטור/בית יוסף שבאותו סעיף.

החזר JSON בפורמט הזה בלבד (ללא טקסט נוסף):
{
  "page": ${pageNum},
  "hasSeifMarkers": true/false,
  "seifim": [
    {
      "seifNumber": <מספר הסעיף לפי שו"ע>,
      "turFirstWords": "<5-8 מילות פתיחה של הטור לאותו סעיף>",
      "byFirstWords": "<5-8 מילות פתיחה של הבית יוסף לאותו סעיף, או null>",
      "notes": "<הערות אם יש>"
    }
  ]
}

אם אין סימני סעיף בעמוד, החזר: {"page": ${pageNum}, "hasSeifMarkers": false, "seifim": []}`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: [{
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: imageData },
      }, {
        type: 'text',
        text: prompt,
      }],
    }],
  });

  const raw = response.content[0].text.trim();

  // Extract JSON (might be wrapped in ```json ... ```)
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : raw;

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.warn(`  ⚠️  לא הצלחתי לפענח JSON מעמוד ${pageNum}. Raw:`, raw.slice(0, 200));
    return { page: pageNum, hasSeifMarkers: false, seifim: [], parseError: raw.slice(0, 500) };
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────
const allResults = [];

console.log(`\n📖 מעבד עמודים ${startPage}–${endPage}...\n`);

for (let p = startPage; p <= endPage; p++) {
  console.log(`\nעמוד ${p} / ${endPage}`);

  // Navigate
  if (p !== startPage) {
    await navigateToPage(p);
  }

  // Screenshot
  const imgPath = await screenshotPage(p);

  // Analyze
  console.log(`  🤖 שולח לClaude Vision...`);
  const result = await analyzePageWithClaude(imgPath, p);

  if (result.hasSeifMarkers && result.seifim?.length > 0) {
    console.log(`  ✅ נמצאו ${result.seifim.length} סעיפים:`);
    for (const s of result.seifim) {
      console.log(`     סעיף ${s.seifNumber}: "${s.turFirstWords}"`);
    }
  } else {
    console.log(`  ℹ️  אין סימני סעיף בעמוד זה`);
  }

  allResults.push(result);

  // Slight delay between API calls
  await page.waitForTimeout(500);
}

// ── Save results ──────────────────────────────────────────────────────────────
writeFileSync(outputFile, JSON.stringify({
  startPage, endPage,
  processedAt: new Date().toISOString(),
  pages: allResults,
}, null, 2));

console.log(`\n\n✅ סיום! תוצאות נשמרו ל: ${outputFile}`);
console.log(`   עמודים עם סימני סעיף: ${allResults.filter(r => r.hasSeifMarkers).length} מתוך ${allResults.length}`);

// Summary of seifim found
const allSeifim = allResults.flatMap(r => r.seifim ?? []);
if (allSeifim.length > 0) {
  console.log(`\n📋 סעיפים שנמצאו:`);
  for (const s of allSeifim) {
    console.log(`  סעיף ${s.seifNumber} (עמוד ${s.page ?? '?'}): "${s.turFirstWords}"`);
  }
}

await browser.close();
