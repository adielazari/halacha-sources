/**
 * Browse the Otzar HaChochma catalog to find the correct book ID
 * for the Tur with Beit Yosef (Shirat Devorah edition), Orach Chaim volume.
 *
 * Opens the browser so you can authenticate, then searches the catalog.
 * Copy the book ID from the URL when you find it.
 *
 * Usage: node scripts/find-oc-book.mjs
 */

import { chromium } from 'playwright';

// ── Known YD book ID for reference ───────────────────────────────────────────
// YD:  https://tablet.otzar.org/#/b/149283/...
// OC:  we need to find this

const SEARCH_URL = 'https://tablet.otzar.org/#/search/results/q/%D7%98%D7%95%D7%A8%20%D7%91%D7%99%D7%AA%20%D7%99%D7%95%D7%A1%D7%A3%20%D7%90%D7%95%D7%A8%D7%97%20%D7%97%D7%99%D7%99%D7%9D/p/1';
// = search for "טור בית יוסף אורח חיים"

console.log('\n🔍 מחפש book ID לאורח חיים...');
console.log('   אחרי שתתחבר, מחפש "טור בית יוסף אורח חיים"');
console.log('   העתק את ה-book ID מה-URL כשתמצא את הספר\n');

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

// Wait for user to authenticate and find the book
console.log('⏳ ממתין... הדפדפן פתוח. התחבר ומצא את הספר.');
console.log('   כשתמצא את ה-book ID, הפסק את הסקריפט (Ctrl+C) ורשום אותו.');

// Keep browser open indefinitely
await new Promise(() => {});
