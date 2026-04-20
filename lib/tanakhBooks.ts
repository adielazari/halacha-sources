export type TanakhBook = { he: string; en: string };

export const TORAH_BOOKS: TanakhBook[] = [
  { he: "בראשית", en: "Genesis" },
  { he: "שמות", en: "Exodus" },
  { he: "ויקרא", en: "Leviticus" },
  { he: "במדבר", en: "Numbers" },
  { he: "דברים", en: "Deuteronomy" },
];

export const NEVIIM_BOOKS: TanakhBook[] = [
  { he: "יהושע", en: "Joshua" },
  { he: "שופטים", en: "Judges" },
  { he: "שמואל א", en: "I_Samuel" },
  { he: "שמואל ב", en: "II_Samuel" },
  { he: "מלכים א", en: "I_Kings" },
  { he: "מלכים ב", en: "II_Kings" },
  { he: "ישעיהו", en: "Isaiah" },
  { he: "ירמיהו", en: "Jeremiah" },
  { he: "יחזקאל", en: "Ezekiel" },
  { he: "הושע", en: "Hosea" },
  { he: "יואל", en: "Joel" },
  { he: "עמוס", en: "Amos" },
  { he: "עובדיה", en: "Obadiah" },
  { he: "יונה", en: "Jonah" },
  { he: "מיכה", en: "Micah" },
  { he: "נחום", en: "Nahum" },
  { he: "חבקוק", en: "Habakkuk" },
  { he: "צפניה", en: "Zephaniah" },
  { he: "חגי", en: "Haggai" },
  { he: "זכריה", en: "Zechariah" },
  { he: "מלאכי", en: "Malachi" },
];

export const KETUVIM_BOOKS: TanakhBook[] = [
  { he: "תהלים", en: "Psalms" },
  { he: "משלי", en: "Proverbs" },
  { he: "איוב", en: "Job" },
  { he: "שיר השירים", en: "Song_of_Songs" },
  { he: "רות", en: "Ruth" },
  { he: "איכה", en: "Lamentations" },
  { he: "קהלת", en: "Ecclesiastes" },
  { he: "אסתר", en: "Esther" },
  { he: "דניאל", en: "Daniel" },
  { he: "עזרא", en: "Ezra" },
  { he: "נחמיה", en: "Nehemiah" },
  { he: "דברי הימים א", en: "I_Chronicles" },
  { he: "דברי הימים ב", en: "II_Chronicles" },
];

export const ALL_TANAKH_BOOKS: TanakhBook[] = [
  ...TORAH_BOOKS,
  ...NEVIIM_BOOKS,
  ...KETUVIM_BOOKS,
];
