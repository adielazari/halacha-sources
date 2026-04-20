// lib/rambamMap.ts
// Hebrew Hilchot name → Sefaria ref base (without chapter/halacha suffix)
export const RAMBAM_MAP: Record<string, string> = {
  // Sefer HaMada
  "הלכות יסודי התורה": "Mishneh_Torah,_Foundations_of_the_Torah",
  "הלכות דעות": "Mishneh_Torah,_Human_Dispositions",
  "הלכות תלמוד תורה": "Mishneh_Torah,_Torah_Study",
  "הלכות עבודה זרה": "Mishneh_Torah,_Foreign_Worship_and_Customs_of_the_Nations",
  "הלכות תשובה": "Mishneh_Torah,_Repentance",
  // Sefer Ahavah
  "הלכות קריאת שמע": "Mishneh_Torah,_Reading_the_Shema",
  "הלכות תפילה": "Mishneh_Torah,_Prayer_and_the_Priestly_Blessing",
  "הלכות תפילין מזוזה וספר תורה": "Mishneh_Torah,_Tefillin,_Mezuzah_and_the_Torah_Scroll",
  "הלכות ציצית": "Mishneh_Torah,_Fringes",
  "הלכות ברכות": "Mishneh_Torah,_Blessings",
  "הלכות מילה": "Mishneh_Torah,_Circumcision",
  // Sefer Zmanim
  "הלכות שבת": "Mishneh_Torah,_Sabbath",
  "הלכות עירובין": "Mishneh_Torah,_Eruvin",
  "הלכות שביתת עשור": "Mishneh_Torah,_Rest_on_the_Tenth_of_Tishrei",
  "הלכות שביתת יום טוב": "Mishneh_Torah,_Rest_on_a_Holiday",
  "הלכות חמץ ומצה": "Mishneh_Torah,_Leavened_and_Unleavened_Bread",
  "הלכות שופר וסוכה ולולב": "Mishneh_Torah,_Shofar,_Sukkah_and_Lulav",
  "הלכות שקלים": "Mishneh_Torah,_Sheqel_Dues",
  "הלכות קידוש החודש": "Mishneh_Torah,_Sanctification_of_the_New_Month",
  "הלכות תעניות": "Mishneh_Torah,_Fasts",
  "הלכות מגילה וחנוכה": "Mishneh_Torah,_Scroll_of_Esther_and_Hanukkah",
  // Sefer Nashim
  "הלכות אישות": "Mishneh_Torah,_Marriage",
  "הלכות גירושין": "Mishneh_Torah,_Divorce",
  "הלכות יבום וחליצה": "Mishneh_Torah,_Levirate_Marriage_and_Release",
  "הלכות נערה בתולה": "Mishneh_Torah,_Virgin_Maiden",
  "הלכות סוטה": "Mishneh_Torah,_Woman_Suspected_of_Infidelity",
  // Sefer Kedushah
  "הלכות איסורי ביאה": "Mishneh_Torah,_Forbidden_Intercourse",
  "הלכות מאכלות אסורות": "Mishneh_Torah,_Forbidden_Foods",
  "הלכות שחיטה": "Mishneh_Torah,_Ritual_Slaughter",
  // Sefer Haflaah
  "הלכות שבועות": "Mishneh_Torah,_Oaths",
  "הלכות נדרים": "Mishneh_Torah,_Vows",
  "הלכות נזירות": "Mishneh_Torah,_Nazariteship",
  "הלכות ערכין וחרמין": "Mishneh_Torah,_Appraisals_and_Devoted_Property",
  // Sefer Zeraim
  "הלכות כלאים": "Mishneh_Torah,_Diverse_Species",
  "הלכות מתנות עניים": "Mishneh_Torah,_Gifts_to_the_Poor",
  "הלכות תרומות": "Mishneh_Torah,_Heave_Offerings",
  "הלכות מעשרות": "Mishneh_Torah,_Tithes",
  "הלכות מעשר שני ונטע רבעי": "Mishneh_Torah,_Second_Tithes_and_Fourth_Year's_Fruit",
  "הלכות בכורים": "Mishneh_Torah,_First_Fruits_and_other_Gifts_to_Priests_Outside_the_Sanctuary",
  "הלכות שמיטה ויובל": "Mishneh_Torah,_Sabbatical_Year_and_the_Jubilee",
  // Sefer Avodah
  "הלכות בית הבחירה": "Mishneh_Torah,_The_Chosen_Temple",
  "הלכות כלי המקדש": "Mishneh_Torah,_Vessels_of_the_Sanctuary_and_Those_Who_Serve_Therein",
  "הלכות ביאת מקדש": "Mishneh_Torah,_Admission_into_the_Sanctuary",
  "הלכות איסורי מזבח": "Mishneh_Torah,_Things_Forbidden_on_the_Altar",
  "הלכות מעשה הקרבנות": "Mishneh_Torah,_Sacrificial_Procedure",
  "הלכות תמידין ומוספין": "Mishneh_Torah,_Daily_Offerings_and_Additional_Offerings",
  "הלכות פסולי המוקדשין": "Mishneh_Torah,_Sacrifices_Rendered_Unfit",
  "הלכות עבודת יום הכיפורים": "Mishneh_Torah,_Service_on_the_Day_of_Atonement",
  "הלכות תמורה": "Mishneh_Torah,_Substitution",
  // Sefer Korbanot
  "הלכות קרבן פסח": "Mishneh_Torah,_Paschal_Offering",
  "הלכות חגיגה": "Mishneh_Torah,_Festival_Offering",
  "הלכות בכורות": "Mishneh_Torah,_Firstlings",
  "הלכות שגגות": "Mishneh_Torah,_Offerings_for_Unintentional_Transgressions",
  "הלכות מחוסרי כפרה": "Mishneh_Torah,_Offerings_for_Those_with_Incomplete_Atonement",
  "הלכות מעילה": "Mishneh_Torah,_Trespass",
  // Sefer Taharah
  "הלכות טומאת מת": "Mishneh_Torah,_Defilement_by_a_Corpse",
  "הלכות פרה אדומה": "Mishneh_Torah,_Red_Heifer",
  "הלכות טומאת צרעת": "Mishneh_Torah,_Defilement_by_Leprosy",
  "הלכות מטמאי משכב ומושב": "Mishneh_Torah,_Those_Who_Defile_Bed_or_Seat",
  "הלכות שאר אבות הטומאות": "Mishneh_Torah,_Other_Sources_of_Defilement",
  "הלכות טומאת אוכלין": "Mishneh_Torah,_Defilement_of_Foods",
  "הלכות כלים": "Mishneh_Torah,_Vessels",
  "הלכות מקוואות": "Mishneh_Torah,_Immersion_Pools",
  // Sefer Nezikin
  "הלכות נזקי ממון": "Mishneh_Torah,_Damages_to_Property",
  "הלכות גנבה": "Mishneh_Torah,_Theft",
  "הלכות גזלה ואבידה": "Mishneh_Torah,_Robbery_and_Lost_Property",
  "הלכות חובל ומזיק": "Mishneh_Torah,_One_Who_Injures_a_Person_or_Property",
  "הלכות רוצח ושמירת הנפש": "Mishneh_Torah,_Murderer_and_the_Preservation_of_Life",
  // Sefer Kinyan
  "הלכות מכירה": "Mishneh_Torah,_Sales",
  "הלכות זכיה ומתנה": "Mishneh_Torah,_Ownerless_Property_and_Gifts",
  "הלכות שכנים": "Mishneh_Torah,_Neighbors",
  "הלכות שלוחין ושותפין": "Mishneh_Torah,_Agents_and_Partners",
  "הלכות עבדים": "Mishneh_Torah,_Slaves",
  // Sefer Mishpatim
  "הלכות שכירות": "Mishneh_Torah,_Hiring",
  "הלכות שאלה ופקדון": "Mishneh_Torah,_Borrowing_and_Deposit",
  "הלכות מלוה ולוה": "Mishneh_Torah,_Creditor_and_Debtor",
  "הלכות טוען ונטען": "Mishneh_Torah,_Plaintiff_and_Defendant",
  "הלכות נחלות": "Mishneh_Torah,_Inheritances",
  // Sefer Shoftim
  "הלכות סנהדרין": "Mishneh_Torah,_The_Sanhedrin_and_the_Penalties_within_Their_Jurisdiction",
  "הלכות עדות": "Mishneh_Torah,_Testimony",
  "הלכות ממרים": "Mishneh_Torah,_Rebels",
  "הלכות אבל": "Mishneh_Torah,_Mourning",
  "הלכות מלכים ומלחמות": "Mishneh_Torah,_Kings_and_Wars",
};

export const RAMBAM_ENTRIES = Object.keys(RAMBAM_MAP).sort((a, b) =>
  a.localeCompare(b, "he")
);
