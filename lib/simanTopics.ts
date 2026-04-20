type TopicRange = { from: number; to: number; topic: string };

export const YOREH_DEAH_TOPICS: TopicRange[] = [
  { from: 1,   to: 28,  topic: "הלכות שחיטה" },
  { from: 29,  to: 30,  topic: "הלכות טריפות" },
  { from: 31,  to: 60,  topic: "הלכות בדיקה ודרסה" },
  { from: 61,  to: 78,  topic: "הלכות כיסוי הדם" },
  { from: 79,  to: 93,  topic: "הלכות אבר מן החי" },
  { from: 94,  to: 97,  topic: "הלכות בשר בחלב" },
  { from: 98,  to: 111, topic: "הלכות בישול" },
  { from: 112, to: 119, topic: "הלכות שתיית גוי" },
  { from: 120, to: 138, topic: "הלכות יין נסך" },
  { from: 139, to: 148, topic: "הלכות עבודה זרה" },
  { from: 149, to: 169, topic: "הלכות ספר תורה" },
  { from: 170, to: 185, topic: "הלכות מזוזה" },
  { from: 186, to: 199, topic: "הלכות תפילין" },
  { from: 200, to: 214, topic: "הלכות ציצית" },
  { from: 215, to: 220, topic: "הלכות ברכות" },
  { from: 221, to: 225, topic: "הלכות כלאים" },
  { from: 226, to: 228, topic: "הלכות ערלה" },
  { from: 229, to: 234, topic: "הלכות ביכורים" },
  { from: 235, to: 236, topic: "הלכות תרומות ומעשרות" },
  { from: 237, to: 239, topic: "הלכות שביעית" },
  { from: 240, to: 241, topic: "הלכות לקט שכחה ופאה" },
  { from: 242, to: 243, topic: "הלכות צדקה" },
  { from: 244, to: 259, topic: "הלכות שבת" },
  { from: 260, to: 264, topic: "הלכות יום טוב" },
  { from: 265, to: 266, topic: "הלכות חנוכה" },
  { from: 267, to: 271, topic: "הלכות פורים" },
  { from: 272, to: 275, topic: "הלכות פסח" },
  { from: 276, to: 285, topic: "הלכות ראש השנה ויום הכיפורים" },
  { from: 286, to: 294, topic: "הלכות סוכה" },
  { from: 295, to: 299, topic: "הלכות לולב" },
  { from: 300, to: 305, topic: "הלכות בכור" },
  { from: 306, to: 310, topic: "הלכות פדיון הבן" },
  { from: 311, to: 313, topic: "הלכות יבום וחליצה" },
  { from: 314, to: 317, topic: "הלכות ממזרות" },
  { from: 318, to: 321, topic: "הלכות נדה" },
  { from: 322, to: 330, topic: "הלכות חלה" },
  { from: 331, to: 340, topic: "הלכות מקוואות" },
  { from: 341, to: 347, topic: "הלכות טבילה" },
  { from: 348, to: 365, topic: "הלכות אבלות" },
  { from: 366, to: 375, topic: "הלכות כבוד אב ואם" },
  { from: 376, to: 392, topic: "הלכות כבוד הרב" },
  { from: 393, to: 403, topic: "הלכות תלמוד תורה" },
];

const CHELEK_TOPICS: Record<string, TopicRange[]> = {
  YorehDeah: YOREH_DEAH_TOPICS,
};

export function getSimanTopic(chelek: string, siman: number): string | null {
  const ranges = CHELEK_TOPICS[chelek];
  if (!ranges) return null;
  const range = ranges.find((r) => siman >= r.from && siman <= r.to);
  return range ? range.topic : null;
}
