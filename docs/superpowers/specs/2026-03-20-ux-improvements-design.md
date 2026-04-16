# עיצוב: שיפורי ממשק — בית יוסף אקספלורר
תאריך: 2026-03-20

## סקירה
חמש תיקונים בעדיפות גבוהה: באג כפילות מקורות, עריכת מפרשים במודאל גדול, מיזוג פאנל מקור שפוספס עם טופס ידני מובנה, קלט פרק בעברית, ומחיקת כל טקסט אנגלי מהממשק.

---

## 1. תיקון כפילות מקורות — parser.ts

### הבעיה
כאשר הטקסט מכיל `ירושלמי פ"ק דערלה`, Pattern 6 מייצר `Jerusalem_Talmud_Orlah.1` ו-Pattern 4b מייצר `Mishnah_Orlah.1` על אותו span. שניהם resolved, ולכן שורת `if (r.data.sefariaRef) return true` מעבירה את שניהם.

### הפתרון
בפונקציה `parseText` (`parser.ts:460-472`): הרחבת הפילטר כך שגם match resolved שה-span שלו מוכל ממש בתוך match resolved אחר (ה-span של השני רחב יותר) — יוסר.

```
// לפני:
if (r.data.sefariaRef) return true;

// אחרי:
if (r.data.sefariaRef) {
  return !resolvedRanges.some(
    ([s, e]) => s <= r.start && r.end <= e && !(s === r.start && e === r.end)
  );
}
```

---

## 2. עריכת מפרשים — מודאל נפרד

### הבעיה
לחיצה על "ערוך" פותחת textarea קטנה בתוך הרשימה — צפופה ולא נוחה.

### הפתרון
מודאל overlay בסגנון `AddManualSourceModal`:
- כותרת: שם המפרש (`c.heRef`)
- textarea גדולה (min-height: 300px), dir="rtl"
- כפתורי שמור / ביטול
- פתיחה/סגירה דרך state `editingRef` קיים ב-`ActiveSourcePanel`

---

## 3. מיזוג "מקור שפוספס" עם הטופס המובנה

### הבעיה
`AddMissedSourcePanel` מבקש ref גולמי באנגלית (`Kiddushin.56b`). המשתמש רוצה לבחור מבין לשוניות (גמרא / משנה / ראשונים / רמב"ם) ולמלא שדות מובנים, בדיוק כמו `AddManualSourceModal`.

### הפתרון
- הוסף prop אופציונלי `rawText?: string` ל-`AddManualSourceModal`
- כאשר `rawText` קיים — הצג אותו בתחילת המודאל כציטוט הקשר (בלוק amber-50 עם הכיתוב "טקסט שנבחר:")
- החלף את `AddMissedSourcePanel` בשימוש ב-`AddManualSourceModal` עם `rawText`
- מחק את `AddMissedSourcePanel.tsx`

---

## 4. קלט פרק בעברית

### הבעיה
שדות "פרק", "משנה", "הלכה" הם `<input type="number">`. המשתמש רוצה להקליד אותיות עבריות (א, ב, ג...).

### הפתרון
- החלף `<input type="number">` ב-`<input type="text">` בשדות: פרק (משנה), משנה (אופציונלי), פרק (רמב"ם), הלכה (אופציונלי)
- לשדה דף (גמרא/ראשונים) — נשאר מספר כי דפי גמרא מקובל לציין במספר
- פונקציית parsing: מנסה `fromHebrewNumeral` → אם לא עובד, מנסה `parseInt` → אם לא עובד, מחזיר 0
- תצוגה בתוית: ממיר את הקלט לאות העברית המתאימה (הלוגיקה קיימת כבר: `toHebrewNumeral(Number(chapter))`)

---

## 5. מחיקת טקסט אנגלי מהממשק

### הבעיה
ref ספריא מוצג למשתמש (לדוג': `קישור לספריא: Kiddushin.56b`). כל אנגלית בממשק מפריעה.

### הפתרון
- מחק את בלוק ה-ref preview (`AddManualSourceModal:323-328`) לגמרי — ה-ref נשמר ב-state בלבד
- בדוק placeholder-ים וכיתובים נוספים לאורך כל הממשק
- בפרט: placeholder של שדה ref ב-`AddMissedSourcePanel` — נעלם ממילא עם מחיקת הקובץ

---

## קבצים מושפעים
| קובץ | שינוי |
|------|-------|
| `lib/parser.ts` | תיקון positional dedup |
| `components/ActiveSourcePanel.tsx` | עריכת מפרשים → מודאל |
| `components/AddManualSourceModal.tsx` | הוסף `rawText` prop, קלט עברי לפרק, הסר ref preview |
| `components/AddMissedSourcePanel.tsx` | מחיקה |
| `app/siman/[chelek]/[number]/page.tsx` | החלף שימוש ב-`AddMissedSourcePanel` → `AddManualSourceModal` עם `rawText` |
