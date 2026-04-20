"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { SourcePullContext } from "@/app/siman/[chelek]/[number]/page";
import type { CommentaryEntry } from "@/lib/types";
import { TRACTATE_MAP } from "@/lib/authorMap";
import { RAMBAM_MAP, RAMBAM_ENTRIES } from "@/lib/rambamMap";
import { TORAH_BOOKS, NEVIIM_BOOKS, KETUVIM_BOOKS } from "@/lib/tanakhBooks";
import type { TanakhBook } from "@/lib/tanakhBooks";
import { buildMishnaRef } from "@/lib/refBuilder";
import { SOURCE_LABELS } from "@/lib/sourceLabels";
import { stripHtml, findSegmentRefs, parseTalmudRef, TRACTATE_HE } from "@/lib/refUtils";
import { parseSourcesFromSeifim } from "@/lib/parser";
import { detectSourceFromText } from "@/lib/detectSourceRef";
import { toHebrewNumeral, fromHebrewNumeral } from "@/lib/hebrewNumerals";
import CommentatorSuggestions from "./CommentatorSuggestions";

type Props = {
  context: SourcePullContext;
  onBack: () => void;
  onAddToDoc: (params: {
    sourceKey: string;
    sourceLabel: string;
    text: string;
    sourceRef?: string;
    commentaries?: CommentaryEntry[];
  }) => void;
};

type SourceType = "gemara" | "mishna" | "rambam" | "sifri" | "tanakh";
type Amud = "א" | "ב" | "both";
type NavMode = "" | "bavli_daf" | "yerushalmi" | "yerushalmi_daf" | "mishna" | "rambam" | "sifri" | "tanakh";
type TanakhCategory = "torah" | "neviim" | "ketuvim";
type Phase = "form" | "selecting" | "confirming" | "commenting" | "editing-commentary";
type Segment = { ref: string; text: string };
type SearchResult = { ref: string; heRef: string; snippet: string };

const TRACTATE_ENTRIES = Object.keys(TRACTATE_MAP).sort((a, b) => a.localeCompare(b, "he"));

// ── Sifri parasha maps ──

type SifriParasha = { name: string; firstPiska: number; lastPiska: number };

const SIFRI_BAMIDBAR_PARSHIYOT: SifriParasha[] = [
  { name: "נשא",       firstPiska: 1,   lastPiska: 58  },
  { name: "בהעלתך",    firstPiska: 59,  lastPiska: 106 },
  { name: "שלח",       firstPiska: 107, lastPiska: 115 },
  { name: "קרח",       firstPiska: 116, lastPiska: 122 },
  { name: "חוקת",      firstPiska: 123, lastPiska: 130 },
  { name: "בלק",       firstPiska: 131, lastPiska: 131 },
  { name: "פנחס",      firstPiska: 132, lastPiska: 152 },
  { name: "מטות",      firstPiska: 153, lastPiska: 158 },
  { name: "מסעי",      firstPiska: 159, lastPiska: 161 },
];

const SIFRI_DEVARIM_PARSHIYOT: SifriParasha[] = [
  { name: "דברים",        firstPiska: 1,   lastPiska: 25  },
  { name: "ואתחנן",       firstPiska: 26,  lastPiska: 36  },
  { name: "עקב",          firstPiska: 37,  lastPiska: 52  },
  { name: "ראה",          firstPiska: 53,  lastPiska: 143 },
  { name: "שופטים",       firstPiska: 144, lastPiska: 210 },
  { name: "כי תצא",      firstPiska: 211, lastPiska: 296 },
  { name: "כי תבוא",     firstPiska: 297, lastPiska: 303 },
  { name: "נצבים",        firstPiska: 304, lastPiska: 305 },
  { name: "האזינו",       firstPiska: 306, lastPiska: 341 },
  { name: "וזאת הברכה",  firstPiska: 342, lastPiska: 357 },
];

function getSifriParasha(book: "Bamidbar" | "Devarim", piska: number): string {
  const list = book === "Bamidbar" ? SIFRI_BAMIDBAR_PARSHIYOT : SIFRI_DEVARIM_PARSHIYOT;
  return list.find((p) => piska >= p.firstPiska && piska <= p.lastPiska)?.name ?? "";
}

// ── Label helpers ──

function heNum(n: number) {
  return toHebrewNumeral(n).replace(/[׳״]/g, "");
}

function tractateHeName(tractateEn: string): string {
  const clean = tractateEn.replace(/^Jerusalem_Talmud_/, "");
  return TRACTATE_HE[clean] ?? clean;
}

function dafLabel(tractateEn: string, daf: number): string {
  if (!tractateEn || daf <= 0) return "";
  return `${tractateHeName(tractateEn)} דף ${heNum(daf)}`;
}

function chapterLabel(tractateEn: string, ch: number): string {
  if (!tractateEn || ch <= 0) return "";
  return `${tractateHeName(tractateEn)} פ"${heNum(ch)}`;
}

function mishnaLabel(tractateEn: string, ch: number, mn?: number): string {
  if (!tractateEn || ch <= 0) return "";
  const base = `משנה ${tractateHeName(tractateEn)} פ"${heNum(ch)}`;
  return mn && mn > 0 ? `${base} מ"${heNum(mn)}` : base;
}

function yerushalmiLabel(tractateEn: string, ch: number, hal?: number): string {
  if (!tractateEn || ch <= 0) return "";
  const base = `ירוש' ${tractateHeName(tractateEn)} פ"${heNum(ch)}`;
  return hal && hal > 0 ? `${base} ה"${heNum(hal)}` : base;
}

function rambamLabel(section: string, ch: number, hal?: number): string {
  if (!section || ch <= 0) return "";
  const base = `${section} פ"${heNum(ch)}`;
  return hal && hal > 0 ? `${base} ה"${heNum(hal)}` : base;
}

function sifriLabel(book: "Bamidbar" | "Devarim", piska: number): string {
  if (piska <= 0) return "";
  const bookHe = book === "Bamidbar" ? "במדבר" : "דברים";
  const parasha = getSifriParasha(book, piska);
  return parasha
    ? `ספרי ${bookHe} ${parasha} פסקא ${heNum(piska)}`
    : `ספרי ${bookHe} פסקא ${heNum(piska)}`;
}

function tanakhLabel(bookHe: string, ch: number, verse?: number): string {
  if (!bookHe || ch <= 0) return "";
  const chHe = heNum(ch);
  if (verse && verse > 0) return `${bookHe} ${chHe}:${heNum(verse)}`;
  return `${bookHe} פרק ${chHe}`;
}

function amudSuffix(a: Amud): string {
  return a === "א" ? "." : a === "ב" ? ":" : "";
}

function bavliDafLabel(tractateEn: string, daf: number, a: Amud): string {
  if (!tractateEn || daf <= 0) return "";
  return `${tractateHeName(tractateEn)} דף ${heNum(daf)}${amudSuffix(a)}`;
}

function yerushalmiDafLabel(tractateEn: string, daf: number, a: Amud): string {
  if (!tractateEn || daf <= 0) return "";
  return `ירוש' ${tractateHeName(tractateEn)} דף ${heNum(daf)}${amudSuffix(a)}`;
}

// ── Component ──

export default function SourcePullView({ context, onBack, onAddToDoc }: Props) {
  const [sectionCollapsed, setSectionCollapsed] = useState(false);
  const [annotationDismissed, setAnnotationDismissed] = useState(false);

  // ── Form ──
  const [sourceType, setSourceType] = useState<SourceType>("gemara");
  const [yerushalmi, setYerushalmi] = useState(false);
  const [tractate, setTractate] = useState("");
  // Bavli daf fields
  const [dafHe, setDafHe] = useState("");
  const [amud, setAmud] = useState<Amud>("both");
  // Yerushalmi input mode
  const [yerushalmiInputMode, setYerushalmiInputMode] = useState<"perek" | "daf">("perek");
  // Gemara chapter / Yerushalmi fields
  const [gemaraChapterHe, setGemaraChapterHe] = useState("");
  const [yerushalmiHalachaHe, setYerushalmiHalachaHe] = useState("");
  // Mishna fields
  const [mishnaChapterHe, setMishnaChapterHe] = useState("");
  const [mishnaHe, setMishnaHe] = useState("");
  // Rambam fields
  const [rambamSection, setRambamSection] = useState("");
  const [rambamChapterHe, setRambamChapterHe] = useState("");
  const [rambamHalachaHe, setRambamHalachaHe] = useState("");
  // Sifri fields
  const [sifriBook, setSifriBook] = useState<"Bamidbar" | "Devarim">("Bamidbar");
  const [sifriParasha, setSifriParasha] = useState("");
  const [sifriPiskaHe, setSifriPiskaHe] = useState("");
  // Tanakh fields
  const [tanakhCategory, setTanakhCategory] = useState<TanakhCategory>("torah");
  const [tanakhBook, setTanakhBook] = useState<TanakhBook | null>(null);
  const [tanakhChapterHe, setTanakhChapterHe] = useState("");
  const [tanakhVerseHe, setTanakhVerseHe] = useState("");
  // Current nav context extras
  const [currentRambamSection, setCurrentRambamSection] = useState("");
  const [currentTanakhBook, setCurrentTanakhBook] = useState<TanakhBook | null>(null);
  const [currentSifriBook, setCurrentSifriBook] = useState<"Bamidbar" | "Devarim">("Bamidbar");
  const [formError, setFormError] = useState("");

  // ── Search ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // ── Navigation state ──
  const [phase, setPhase] = useState<Phase>("form");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loadingPull, setLoadingPull] = useState(false);
  const [loadingDir, setLoadingDir] = useState<"next" | "prev" | null>(null);
  const [currentMode, setCurrentMode] = useState<NavMode>("");
  const [currentTractateEn, setCurrentTractateEn] = useState("");
  const [currentDafNum, setCurrentDafNum] = useState(0);
  const [currentAmud, setCurrentAmud] = useState<Amud>("both");
  const [currentChapterNum, setCurrentChapterNum] = useState(0);
  const [currentHalachaNum, setCurrentHalachaNum] = useState(0);
  const [currentRef, setCurrentRef] = useState("");

  // ── Text selection (source) ──
  const [pendingSelection, setPendingSelection] = useState("");
  const [chunks, setChunks] = useState<string[]>([]);
  // Accumulated chunks from previous navigation steps (adjacent pages).
  // Each group's text is joined without "..." since the pages are sequential.
  const [chunkGroups, setChunkGroups] = useState<string[][]>([]);
  const [confirmedSegmentRefs, setConfirmedSegmentRefs] = useState<string[]>([]);
  const textRef = useRef<HTMLDivElement>(null);

  // ── Commentaries ──
  const [commentaries, setCommentaries] = useState<CommentaryEntry[]>([]);

  // ── Commentary editing ──
  const [editingCommentary, setEditingCommentary] = useState<CommentaryEntry | null>(null);
  const [editingComChunks, setEditingComChunks] = useState<string[]>([]);
  const [editingComPending, setEditingComPending] = useState("");
  const editingComTextRef = useRef<HTMLDivElement>(null);

  // Auto-detect source reference from the selected panel text
  useEffect(() => {
    if (!context.text) return;

    // Try the focused detector first (handles chapter forms, מ"X, ה"X, etc.)
    const detected = detectSourceFromText(context.text);
    if (detected) {
      if (detected.type === "sifri") {
        setSourceType("sifri");
        setSifriBook(detected.sifriBook);
        if (detected.piska) setSifriPiskaHe(heNum(detected.piska));

      } else if (detected.type === "tanakh") {
        setSourceType("tanakh");
        const isTorah = TORAH_BOOKS.some((b) => b.en === detected.book.en);
        const isNeviim = NEVIIM_BOOKS.some((b) => b.en === detected.book.en);
        setTanakhCategory(isTorah ? "torah" : isNeviim ? "neviim" : "ketuvim");
        setTanakhBook(detected.book);
        setCurrentTanakhBook(detected.book);
        if (detected.chapter) setTanakhChapterHe(heNum(detected.chapter));
        if (detected.verse)   setTanakhVerseHe(heNum(detected.verse));

      } else if (detected.type === "rambam") {
        setSourceType("rambam");
        setRambamSection(detected.hilkhotHe);
        setCurrentRambamSection(detected.hilkhotHe);
        if (detected.chapter) setRambamChapterHe(heNum(detected.chapter));
        if (detected.halacha) setRambamHalachaHe(heNum(detected.halacha));

      } else if (detected.type === "mishna") {
        setSourceType("mishna");
        setTractate(detected.tractateHe);
        if (detected.chapter) setMishnaChapterHe(heNum(detected.chapter));
        if (detected.mishna)  setMishnaHe(heNum(detected.mishna));

      } else if (detected.type === "yerushalmi") {
        setSourceType("gemara");
        setYerushalmi(true);
        setYerushalmiInputMode("perek");
        setTractate(detected.tractateHe);
        if (detected.chapter)  setGemaraChapterHe(heNum(detected.chapter));
        if (detected.halacha)  setYerushalmiHalachaHe(heNum(detected.halacha));

      } else {
        // Bavli gemara
        setSourceType("gemara");
        setYerushalmi(false);
        setTractate(detected.tractateHe);
        if (detected.daf) {
          setDafHe(heNum(detected.daf));
          if (detected.amud) setAmud(detected.amud === "a" ? "א" : "ב");
        } else if (detected.chapter) {
          setGemaraChapterHe(heNum(detected.chapter));
        }
      }
      return;
    }

    // Fall back: use the full Beit Yosef parser for any remaining daf-form citations
    const parsed = parseSourcesFromSeifim([context.text]);
    if (!parsed.length) return;
    const first = parsed[0];
    if (first.sefariaRef) {
      const p = parseTalmudRef(first.sefariaRef);
      if (p) {
        const entry = Object.entries(TRACTATE_MAP).find(([, v]) => v === p.tractate);
        if (entry) setTractate(entry[0]);
        setDafHe(heNum(p.daf));
        setAmud(p.amud === "a" ? "א" : "ב");
        setSourceType("gemara");
      }
    }
  }, [context.text]);

  // Pre-load from annotation.sourceRef or context.preloadRef if available
  useEffect(() => {
    const ref = context.annotation?.sourceRef ?? context.preloadRef;
    if (!ref || phase !== "form") return;
    (async () => {
      setLoadingPull(true);
      try {
        const data = await fetch(`/api/source?ref=${encodeURIComponent(ref)}`).then(r => r.json());
        const segs: Segment[] = data.segments?.length ? data.segments : [{ ref, text: data.text ?? "" }];

        // Infer nav state from ref so navigation arrows work on re-edit
        let mode: NavMode = "";
        let tractateEnStr = "";
        let ch = 0, hal = 0, dafNum = 0;
        let amudVal: Amud = "both";
        let rambamSec = "";
        let sifriBookVal: "Bamidbar" | "Devarim" = "Bamidbar";
        let tanakhBookVal: TanakhBook | null = null;

        const bavli = parseTalmudRef(ref);
        if (bavli) {
          mode = "bavli_daf";
          tractateEnStr = bavli.tractate;
          dafNum = bavli.daf;
          amudVal = bavli.amud === "a" ? "א" : "ב";
        } else if (ref.startsWith("Jerusalem_Talmud_")) {
          const rest = ref.replace(/^Jerusalem_Talmud_/, "");
          const parts = rest.split(".");
          tractateEnStr = `Jerusalem_Talmud_${parts[0]}`;
          ch = parts[1] ? parseInt(parts[1]) : 0;
          hal = parts[2] ? parseInt(parts[2]) : 0;
          mode = "yerushalmi";
        } else if (ref.startsWith("Mishnah_")) {
          const rest = ref.replace(/^Mishnah_/, "");
          const parts = rest.split(".");
          tractateEnStr = TRACTATE_MAP[Object.keys(TRACTATE_MAP).find(k => TRACTATE_MAP[k] === parts[0]) ?? ""] ?? parts[0];
          ch = parts[1] ? parseInt(parts[1]) : 0;
          hal = parts[2] ? parseInt(parts[2]) : 0;
          mode = "mishna";
        } else if (ref.startsWith("Sifrei_")) {
          const rest = ref.replace(/^Sifrei_/, "");
          const parts = rest.split(".");
          sifriBookVal = parts[0] === "Devarim" ? "Devarim" : "Bamidbar";
          ch = parts[1] ? parseInt(parts[1]) : 0;
          tractateEnStr = `Sifrei_${parts[0]}`;
          mode = "sifri";
          setCurrentSifriBook(sifriBookVal);
        } else {
          // Try Tanakh: BookEn.ch or BookEn.ch.verse
          const ALL_TANAKH_BOOKS: TanakhBook[] = [...TORAH_BOOKS, ...NEVIIM_BOOKS, ...KETUVIM_BOOKS];
          const parts = ref.split(".");
          const matchedBook = ALL_TANAKH_BOOKS.find((b) => b.en === parts[0]);
          if (matchedBook) {
            tanakhBookVal = matchedBook;
            ch = parts[1] ? parseInt(parts[1]) : 0;
            hal = parts[2] ? parseInt(parts[2]) : 0;
            mode = "tanakh";
            setCurrentTanakhBook(matchedBook);
          } else {
            // Try Rambam: match ref base against RAMBAM_MAP values
            const rambamEntry = Object.entries(RAMBAM_MAP).find(([, base]) => ref.startsWith(base));
            if (rambamEntry) {
              rambamSec = rambamEntry[0];
              const rest2 = ref.slice(rambamEntry[1].length + 1);
              const rparts = rest2.split(".");
              ch = rparts[0] ? parseInt(rparts[0]) : 0;
              hal = rparts[1] ? parseInt(rparts[1]) : 0;
              mode = "rambam";
              tractateEnStr = rambamEntry[1];
              setCurrentRambamSection(rambamSec);
            }
          }
        }

        setSegments(segs);
        setCurrentRef(ref);
        setCurrentMode(mode);
        setCurrentTractateEn(tractateEnStr);
        setCurrentChapterNum(ch);
        setCurrentHalachaNum(hal);
        setCurrentDafNum(dafNum);
        setCurrentAmud(amudVal);
        void rambamSec; void sifriBookVal; void tanakhBookVal;
        setPhase("selecting");
      } catch { /* silent — user can fill form manually */ }
      finally { setLoadingPull(false); }
    })();
  }, [context.annotation?.sourceRef, context.preloadRef]); // re-run when ref changes

  // Track text selection in source area and commentary editing area
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const text = sel.toString().trim();
      if (!text) return;
      if (textRef.current?.contains(sel.anchorNode)) setPendingSelection(text);
      else if (editingComTextRef.current?.contains(sel.anchorNode)) setEditingComPending(text);
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  // ── Helpers ──

  function parseNum(s: string): number {
    return /^\d+$/.test(s) ? parseInt(s, 10) : (fromHebrewNumeral(s) ?? 0);
  }

  async function fetchRef(ref: string): Promise<{ segs: Segment[]; primary: string }> {
    const d = await fetch(`/api/source?ref=${encodeURIComponent(ref)}`).then((r) => r.json());
    const segs: Segment[] = d.segments?.length ? d.segments : [{ ref, text: d.text ?? "" }];
    return { segs, primary: ref };
  }

  async function fetchDaf(
    tractateEn: string,
    dafNum: number,
    a: Amud
  ): Promise<{ segs: Segment[]; primary: string }> {
    if (a === "both") {
      const [dA, dB] = await Promise.all([
        fetchRef(`${tractateEn}.${dafNum}a`),
        fetchRef(`${tractateEn}.${dafNum}b`),
      ]);
      return { segs: [...dA.segs, ...dB.segs], primary: dA.primary };
    }
    return fetchRef(`${tractateEn}.${dafNum}${a === "א" ? "a" : "b"}`);
  }

  // ── Current label ──

  function getCurrentLabel(): string {
    switch (currentMode) {
      case "bavli_daf": return bavliDafLabel(currentTractateEn, currentDafNum, currentAmud);
      case "yerushalmi_daf": return yerushalmiDafLabel(currentTractateEn, currentDafNum, currentAmud);
      case "yerushalmi": return yerushalmiLabel(currentTractateEn, currentChapterNum, currentHalachaNum || undefined);
      case "mishna": return mishnaLabel(currentTractateEn, currentChapterNum, currentHalachaNum || undefined);
      case "rambam": return rambamLabel(currentRambamSection, currentChapterNum, currentHalachaNum || undefined);
      case "sifri": return sifriLabel(currentSifriBook, currentChapterNum);
      case "tanakh": return tanakhLabel(currentTanakhBook?.he ?? "", currentChapterNum, currentHalachaNum || undefined);
      default: return currentRef;
    }
  }

  // For amud-level daf navigation: compute the prev/next amud+daf
  function prevAmudDaf(): { daf: number; a: Amud } {
    if (currentAmud === "both") return { daf: currentDafNum - 1, a: "both" };
    if (currentAmud === "ב") return { daf: currentDafNum, a: "א" };
    return { daf: currentDafNum - 1, a: "ב" };
  }
  function nextAmudDaf(): { daf: number; a: Amud } {
    if (currentAmud === "both") return { daf: currentDafNum + 1, a: "both" };
    if (currentAmud === "א") return { daf: currentDafNum, a: "ב" };
    return { daf: currentDafNum + 1, a: "א" };
  }

  function getPrevLabel(): string {
    switch (currentMode) {
      case "bavli_daf": {
        const { daf, a } = prevAmudDaf();
        return bavliDafLabel(currentTractateEn, daf, a);
      }
      case "yerushalmi_daf": {
        const { daf, a } = prevAmudDaf();
        return yerushalmiDafLabel(currentTractateEn, daf, a);
      }
      case "yerushalmi":
        if (currentHalachaNum > 1) return yerushalmiLabel(currentTractateEn, currentChapterNum, currentHalachaNum - 1);
        return yerushalmiLabel(currentTractateEn, currentChapterNum - 1);
      case "rambam":
        if (currentHalachaNum > 1) return rambamLabel(currentRambamSection, currentChapterNum, currentHalachaNum - 1);
        return rambamLabel(currentRambamSection, currentChapterNum - 1);
      case "mishna":
        if (currentHalachaNum > 1) return mishnaLabel(currentTractateEn, currentChapterNum, currentHalachaNum - 1);
        return mishnaLabel(currentTractateEn, currentChapterNum - 1);
      case "sifri": return sifriLabel(currentSifriBook, currentChapterNum - 1);
      case "tanakh":
        if (currentHalachaNum > 1) return tanakhLabel(currentTanakhBook?.he ?? "", currentChapterNum, currentHalachaNum - 1);
        return tanakhLabel(currentTanakhBook?.he ?? "", currentChapterNum - 1);
      default: return chapterLabel(currentTractateEn, currentChapterNum - 1);
    }
  }

  function getNextLabel(): string {
    switch (currentMode) {
      case "bavli_daf": {
        const { daf, a } = nextAmudDaf();
        return bavliDafLabel(currentTractateEn, daf, a);
      }
      case "yerushalmi_daf": {
        const { daf, a } = nextAmudDaf();
        return yerushalmiDafLabel(currentTractateEn, daf, a);
      }
      case "yerushalmi":
        if (currentHalachaNum > 0) return yerushalmiLabel(currentTractateEn, currentChapterNum, currentHalachaNum + 1);
        return yerushalmiLabel(currentTractateEn, currentChapterNum + 1);
      case "rambam":
        if (currentHalachaNum > 0) return rambamLabel(currentRambamSection, currentChapterNum, currentHalachaNum + 1);
        return rambamLabel(currentRambamSection, currentChapterNum + 1);
      case "mishna":
        if (currentHalachaNum > 0) return mishnaLabel(currentTractateEn, currentChapterNum, currentHalachaNum + 1);
        return mishnaLabel(currentTractateEn, currentChapterNum + 1);
      case "sifri": return sifriLabel(currentSifriBook, currentChapterNum + 1);
      case "tanakh":
        if (currentHalachaNum > 0) return tanakhLabel(currentTanakhBook?.he ?? "", currentChapterNum, currentHalachaNum + 1);
        return tanakhLabel(currentTanakhBook?.he ?? "", currentChapterNum + 1);
      default: return chapterLabel(currentTractateEn, currentChapterNum + 1);
    }
  }

  function isPrevDisabled(): boolean {
    switch (currentMode) {
      case "bavli_daf":
      case "yerushalmi_daf":
        if (currentAmud === "ב") return false; // can always go to same daf amud א
        if (currentAmud === "both") return currentDafNum <= 2;
        return currentDafNum <= 2; // amud א, can't go before daf 2a
      case "yerushalmi": return currentHalachaNum > 0 ? currentHalachaNum <= 1 : currentChapterNum <= 1;
      case "rambam": return currentHalachaNum > 0 ? currentHalachaNum <= 1 : currentChapterNum <= 1;
      case "mishna": return currentHalachaNum > 0 ? currentHalachaNum <= 1 : currentChapterNum <= 1;
      case "sifri": return currentChapterNum <= 1;
      case "tanakh": return currentHalachaNum > 0 ? currentHalachaNum <= 1 : currentChapterNum <= 1;
      default: return currentChapterNum <= 1;
    }
  }

  // ── Navigation ──

  const loadAdjacent = useCallback(async (dir: "next" | "prev") => {
    setLoadingDir(dir);
    try {
      if (currentMode === "bavli_daf" || currentMode === "yerushalmi_daf") {
        // Amud-level navigation when a specific amud is selected
        if (currentAmud === "both") {
          const newDaf = dir === "next" ? currentDafNum + 1 : currentDafNum - 1;
          if (newDaf < 2) return;
          const { segs, primary } = await fetchDaf(currentTractateEn, newDaf, "both");
          setSegments(segs);
          setCurrentDafNum(newDaf);
          setCurrentRef(primary);
        } else {
          const { daf, a } = dir === "next" ? nextAmudDaf() : prevAmudDaf();
          if (daf < 2) return;
          const { segs, primary } = await fetchDaf(currentTractateEn, daf, a);
          setSegments(segs);
          setCurrentDafNum(daf);
          setCurrentAmud(a);
          setCurrentRef(primary);
        }
      } else if (currentMode === "yerushalmi") {
        let newCh = currentChapterNum;
        let newHal = currentHalachaNum;
        if (currentHalachaNum > 0) {
          newHal = dir === "next" ? currentHalachaNum + 1 : currentHalachaNum - 1;
          if (newHal < 1) return;
        } else {
          newCh = dir === "next" ? currentChapterNum + 1 : currentChapterNum - 1;
          if (newCh < 1) return;
        }
        const ref = newHal > 0
          ? `${currentTractateEn}.${newCh}.${newHal}`
          : `${currentTractateEn}.${newCh}`;
        const { segs, primary } = await fetchRef(ref);
        setSegments(segs);
        setCurrentChapterNum(newCh);
        setCurrentHalachaNum(newHal);
        setCurrentRef(primary);
      } else if (currentMode === "mishna") {
        const tractateHe = Object.entries(TRACTATE_MAP).find(([, v]) => v === currentTractateEn)?.[0] ?? "";
        if (currentHalachaNum > 0) {
          const newMn = dir === "next" ? currentHalachaNum + 1 : currentHalachaNum - 1;
          if (newMn < 1) return;
          const ref = buildMishnaRef(tractateHe, heNum(currentChapterNum), heNum(newMn));
          if (!ref) return;
          const { segs, primary } = await fetchRef(ref);
          setSegments(segs);
          setCurrentHalachaNum(newMn);
          setCurrentRef(primary);
        } else {
          const newCh = dir === "next" ? currentChapterNum + 1 : currentChapterNum - 1;
          if (newCh < 1) return;
          const ref = buildMishnaRef(tractateHe, heNum(newCh));
          if (!ref) return;
          const { segs, primary } = await fetchRef(ref);
          setSegments(segs);
          setCurrentChapterNum(newCh);
          setCurrentRef(primary);
        }
      } else if (currentMode === "rambam") {
        const refBase = RAMBAM_MAP[currentRambamSection];
        if (!refBase) return;
        if (currentHalachaNum > 0) {
          const newHal = dir === "next" ? currentHalachaNum + 1 : currentHalachaNum - 1;
          if (newHal < 1) return;
          const { segs, primary } = await fetchRef(`${refBase}.${currentChapterNum}.${newHal}`);
          setSegments(segs);
          setCurrentHalachaNum(newHal);
          setCurrentRef(primary);
        } else {
          const newCh = dir === "next" ? currentChapterNum + 1 : currentChapterNum - 1;
          if (newCh < 1) return;
          const { segs, primary } = await fetchRef(`${refBase}.${newCh}`);
          setSegments(segs);
          setCurrentChapterNum(newCh);
          setCurrentRef(primary);
        }
      } else if (currentMode === "sifri") {
        const newCh = dir === "next" ? currentChapterNum + 1 : currentChapterNum - 1;
        if (newCh < 1) return;
        const { segs, primary } = await fetchRef(`Sifrei_${currentSifriBook}.${newCh}`);
        setSegments(segs);
        setCurrentChapterNum(newCh);
        setCurrentRef(primary);
      } else if (currentMode === "tanakh" && currentTanakhBook) {
        if (currentHalachaNum > 0) {
          const newVerse = dir === "next" ? currentHalachaNum + 1 : currentHalachaNum - 1;
          if (newVerse < 1) return;
          const { segs, primary } = await fetchRef(`${currentTanakhBook.en}.${currentChapterNum}.${newVerse}`);
          setSegments(segs);
          setCurrentHalachaNum(newVerse);
          setCurrentRef(primary);
        } else {
          const newCh = dir === "next" ? currentChapterNum + 1 : currentChapterNum - 1;
          if (newCh < 1) return;
          const { segs, primary } = await fetchRef(`${currentTanakhBook.en}.${newCh}`);
          setSegments(segs);
          setCurrentChapterNum(newCh);
          setCurrentRef(primary);
        }
      }
      // Carry over any selections from this page as a new group (adjacent → no "..." separator)
      if (chunks.length > 0) {
        setChunkGroups((prev) => [...prev, [...chunks]]);
      }
      setChunks([]);
      setPendingSelection("");
    } catch {/* silent */}
    finally { setLoadingDir(null); }
  }, [chunks, currentMode, currentTractateEn, currentDafNum, currentAmud, currentChapterNum, currentHalachaNum, currentRambamSection, currentSifriBook, currentTanakhBook]);

  // ── Pull helpers ──

  async function applyPull(
    segsData: { segs: Segment[]; primary: string },
    mode: NavMode,
    tractateEnStr: string,
    ch: number,
    hal: number,
    dafNum: number,
    amudVal: Amud,
  ) {
    setSegments(segsData.segs);
    setCurrentMode(mode);
    setCurrentTractateEn(tractateEnStr);
    setCurrentChapterNum(ch);
    setCurrentHalachaNum(hal);
    setCurrentDafNum(dafNum);
    setCurrentAmud(amudVal);
    setCurrentRef(segsData.primary);
    setChunks([]);
    setChunkGroups([]);
    setPendingSelection("");
    setSearchResults([]);
    setSearchQuery("");
    setSearchError("");
    setPhase("selecting");
  }

  async function handlePull() {
    setFormError("");
    const tractateEn = TRACTATE_MAP[tractate] ?? "";
    if (sourceType !== "rambam" && sourceType !== "sifri" && sourceType !== "tanakh" && (!tractate || !tractateEn)) {
      setFormError("יש לבחור מסכת");
      return;
    }

    setLoadingPull(true);
    try {
      if (sourceType === "gemara") {
        if (yerushalmi) {
          const yeruTractate = `Jerusalem_Talmud_${tractateEn}`;
          if (yerushalmiInputMode === "daf") {
            const dafNum = parseNum(dafHe);
            if (!dafNum) { setFormError("יש למלא דף תקין"); return; }
            const d = await fetchDaf(yeruTractate, dafNum, amud);
            await applyPull(d, "yerushalmi_daf", yeruTractate, 0, 0, dafNum, amud);
          } else {
            const ch = parseNum(gemaraChapterHe);
            if (!ch) { setFormError("יש למלא פרק"); return; }
            const hal = yerushalmiHalachaHe.trim() ? parseNum(yerushalmiHalachaHe) : 0;
            if (yerushalmiHalachaHe.trim() && !hal) { setFormError("הלכה לא תקינה"); return; }
            const ref = hal
              ? `${yeruTractate}.${ch}.${hal}`
              : `${yeruTractate}.${ch}`;
            const d = await fetchRef(ref);
            await applyPull(d, "yerushalmi", yeruTractate, ch, hal, 0, "both");
          }
        } else {
          // Bavli daf mode
          const dafNum = parseNum(dafHe);
          if (!dafNum) { setFormError("יש למלא דף תקין"); return; }
          const d = await fetchDaf(tractateEn, dafNum, amud);
          await applyPull(d, "bavli_daf", tractateEn, 0, 0, dafNum, amud);
        }
      } else if (sourceType === "mishna") {
        const ch = parseNum(mishnaChapterHe);
        if (!ch) { setFormError("יש למלא פרק"); return; }
        const ref = buildMishnaRef(tractate, mishnaChapterHe, mishnaHe || undefined);
        if (!ref) { setFormError("מקור לא תקין"); return; }
        const d = await fetchRef(ref);
        await applyPull(d, "mishna", tractateEn, ch, parseNum(mishnaHe) || 0, 0, "both");
      } else if (sourceType === "rambam") {
        const refBase = RAMBAM_MAP[rambamSection];
        if (!refBase) { setFormError("יש לבחור הלכות"); return; }
        const ch = parseNum(rambamChapterHe);
        if (!ch) { setFormError("יש למלא פרק"); return; }
        const hal = rambamHalachaHe.trim() ? parseNum(rambamHalachaHe) : 0;
        const ref = hal ? `${refBase}.${ch}.${hal}` : `${refBase}.${ch}`;
        const d = await fetchRef(ref);
        setCurrentRambamSection(rambamSection);
        await applyPull(d, "rambam", refBase, ch, hal, 0, "both");
      } else if (sourceType === "sifri") {
        const piska = parseNum(sifriPiskaHe);
        if (!piska) { setFormError("יש למלא פסקא"); return; }
        const ref = `Sifrei_${sifriBook}.${piska}`;
        const d = await fetchRef(ref);
        setCurrentSifriBook(sifriBook);
        await applyPull(d, "sifri", `Sifrei_${sifriBook}`, piska, 0, 0, "both");
      } else if (sourceType === "tanakh") {
        if (!tanakhBook) { setFormError("יש לבחור ספר"); return; }
        const ch = parseNum(tanakhChapterHe);
        if (!ch) { setFormError("יש למלא פרק"); return; }
        const verse = tanakhVerseHe.trim() ? parseNum(tanakhVerseHe) : 0;
        if (tanakhVerseHe.trim() && !verse) { setFormError("פסוק לא תקין"); return; }
        const ref = verse ? `${tanakhBook.en}.${ch}.${verse}` : `${tanakhBook.en}.${ch}`;
        const d = await fetchRef(ref);
        setCurrentTanakhBook(tanakhBook);
        await applyPull(d, "tanakh", tanakhBook.en, ch, verse, 0, "both");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "שגיאה בטעינה");
    } finally {
      setLoadingPull(false);
    }
  }

  // ── Search ──

  async function handleSearch() {
    if (!searchQuery.trim() || !tractate) return;
    const tractateEn = TRACTATE_MAP[tractate] ?? "";
    if (!tractateEn) return;
    // For Yerushalmi, prefix the tractate name
    const filterTractate = (sourceType === "gemara" && yerushalmi)
      ? `Jerusalem Talmud ${tractateEn}`
      : tractateEn;

    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const res = await fetch(
        `/api/search-text?query=${encodeURIComponent(searchQuery)}&tractate=${encodeURIComponent(filterTractate)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const results: SearchResult[] = data.results ?? [];
      setSearchResults(results);
      if (!results.length) setSearchError("לא נמצאו תוצאות");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "שגיאת חיפוש");
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectSearchResult(r: SearchResult) {
    const tractateEn = TRACTATE_MAP[tractate] ?? "";
    if (!tractateEn) return;
    setLoadingPull(true);
    setFormError("");
    try {
      if (sourceType === "gemara") {
        if (yerushalmi) {
          if (yerushalmiInputMode === "daf") {
            // Vilna daf: "Jerusalem Talmud Shekalim 4b" → daf=4, amud=ב
            const m = r.ref.match(/\s(\d+)([ab])$/i);
            if (!m) {
              // fallback: try chapter:halacha format
              const m2 = r.ref.match(/(\d+):(\d+)/);
              if (!m2) return;
              const ch = parseInt(m2[1]);
              const hal = parseInt(m2[2]);
              setGemaraChapterHe(heNum(ch));
              setYerushalmiHalachaHe(heNum(hal));
              const ref = `Jerusalem_Talmud_${tractateEn}.${ch}.${hal}`;
              const d = await fetchRef(ref);
              await applyPull(d, "yerushalmi", `Jerusalem_Talmud_${tractateEn}`, ch, hal, 0, "both");
            } else {
              const dafNum = parseInt(m[1]);
              const parsedAmud: Amud = m[2].toLowerCase() === "a" ? "א" : "ב";
              setDafHe(heNum(dafNum));
              setAmud(parsedAmud);
              const d = await fetchDaf(`Jerusalem_Talmud_${tractateEn}`, dafNum, parsedAmud);
              await applyPull(d, "yerushalmi_daf", `Jerusalem_Talmud_${tractateEn}`, 0, 0, dafNum, parsedAmud);
            }
          } else {
            // perek mode: "Jerusalem Talmud Orlah 1:2:8" → ch=1, hal=2
            const m = r.ref.match(/(\d+):(\d+)/);
            if (!m) return;
            const ch = parseInt(m[1]);
            const hal = parseInt(m[2]);
            setGemaraChapterHe(heNum(ch));
            setYerushalmiHalachaHe(heNum(hal));
            const ref = `Jerusalem_Talmud_${tractateEn}.${ch}.${hal}`;
            const d = await fetchRef(ref);
            await applyPull(d, "yerushalmi", `Jerusalem_Talmud_${tractateEn}`, ch, hal, 0, "both");
          }
        } else {
          // Bavli: "Shabbat 56a" → daf=56, amud=a
          const m = r.ref.match(/\s(\d+)([ab])$/i);
          if (!m) return;
          const dafNum = parseInt(m[1]);
          const parsedAmud: Amud = m[2].toLowerCase() === "a" ? "א" : "ב";
          setDafHe(heNum(dafNum));
          setAmud(parsedAmud);
          const d = await fetchDaf(tractateEn, dafNum, parsedAmud);
          await applyPull(d, "bavli_daf", tractateEn, 0, 0, dafNum, parsedAmud);
        }
      } else {
        // Mishna: "Mishnah Tractate 2:3"
        const m = r.ref.match(/[.: ](\d+)(?:[.:](\d+))?/);
        if (!m) return;
        const ch = parseInt(m[1]);
        const mn = m[2] ? parseInt(m[2]) : 0;
        setMishnaChapterHe(heNum(ch));
        if (mn) setMishnaHe(heNum(mn));
        const ref = buildMishnaRef(tractate, heNum(ch), mn ? heNum(mn) : undefined);
        if (!ref) return;
        const d = await fetchRef(ref);
        await applyPull(d, "mishna", tractateEn, ch, mn, 0, "both");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "שגיאה בטעינה");
    } finally {
      setLoadingPull(false);
    }
  }

  // ── Selection ──

  function addChunk() {
    if (!pendingSelection) return;
    setChunks((prev) => [...prev, pendingSelection]);
    setPendingSelection("");
    window.getSelection()?.removeAllRanges();
  }

  function handleConfirm() {
    const matched = findSegmentRefs(chunks, segments);
    setConfirmedSegmentRefs(matched.length > 0 ? matched : segments.map((s) => s.ref));
    setPhase("commenting");
  }

  function handleEditCommentary(c: CommentaryEntry) {
    setEditingCommentary(c);
    setEditingComChunks([]);
    setEditingComPending("");
    setPhase("editing-commentary");
  }

  function addComChunk() {
    if (!editingComPending) return;
    setEditingComChunks((prev) => [...prev, editingComPending]);
    setEditingComPending("");
    window.getSelection()?.removeAllRanges();
  }

  function saveCommentaryEdit() {
    if (!editingCommentary) return;
    const newText = editingComChunks.length > 0
      ? editingComChunks.join(" ... ")
      : editingCommentary.text;
    setCommentaries((prev) =>
      prev.map((c) => c.ref === editingCommentary.ref ? { ...c, text: newText } : c)
    );
    setEditingCommentary(null);
    setEditingComChunks([]);
    setPhase("commenting");
  }

  const displayText = segments.map((s) => stripHtml(s.text)).join(" ");
  // Groups from previous navigation steps joined without "..." (adjacent pages = sequential text).
  // Current page: selected chunks joined with "..." (non-contiguous within same page).
  const currentPageText = chunks.length > 0 ? chunks.join(" ... ") : displayText;
  const confirmedText = chunkGroups.length > 0
    ? [...chunkGroups.map((g) => g.join(" ... ")), currentPageText].join(" ")
    : currentPageText;
  const totalChunks = chunkGroups.reduce((acc, g) => acc + g.length, 0) + chunks.length;

  function handleAddToDoc(commentaryOnly = false) {
    const baseLabel = getCurrentLabel();
    const sourceLabel = commentaryOnly && commentaries.length > 0
      ? `${baseLabel} ${commentaries.map(c => c.heRef).join(" ")}`
      : baseLabel;
    onAddToDoc({
      sourceKey: context.sourceKey,
      sourceLabel,
      text: commentaryOnly ? "" : confirmedText,
      sourceRef: currentRef || undefined,
      commentaries: commentaries.length > 0 ? commentaries : undefined,
    });
  }

  // ── Render ──

  const showNav = phase === "selecting" && currentMode !== "";
  const ann = context.annotation;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800">
          ← חזרה לפאנלים
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-500">{context.sectionLabel ?? SOURCE_LABELS[context.sourceKey] ?? context.sourceKey}</span>
      </div>

      {/* Collapsible commentator section */}
      {context.sectionHtml && (
        <div className="border border-amber-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setSectionCollapsed((c) => !c)}
            className="w-full text-right px-4 py-2 bg-amber-50 hover:bg-amber-100 text-sm font-medium text-amber-800 flex items-center gap-2 transition"
            dir="rtl"
          >
            <span>{sectionCollapsed ? "▶" : "▼"}</span>
            <span>{context.sectionLabel ?? "טקסט המפרש"}</span>
          </button>
          {!sectionCollapsed && (
            <div
              className="p-4 text-sm leading-loose text-gray-700 bg-white max-h-40 overflow-y-auto"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: context.sectionHtml }}
            />
          )}
        </div>
      )}

      {/* Annotation banner — only for approved / rejected */}
      {ann && !annotationDismissed && ann.status !== "pending" && (
        <div
          className={`border rounded-lg p-3 flex items-center justify-between ${
            ann.status === "approved"
              ? "bg-green-50 border-green-300"
              : "bg-red-50 border-red-300"
          }`}
          dir="rtl"
        >
          <span className={`text-sm font-medium ${ann.status === "approved" ? "text-green-800" : "text-red-800"}`}>
            {ann.status === "approved" ? "מקור מאושר" : "מקור שנדחה"} — עריכה ושמירה יעדכנו את הרשומה
          </span>
          <button
            type="button"
            onClick={() => setAnnotationDismissed(true)}
            className={`text-lg font-bold leading-none mr-3 ${
              ann.status === "approved" ? "text-green-700 hover:text-green-900" : "text-red-700 hover:text-red-900"
            }`}
            title="סגור"
          >
            ✕
          </button>
        </div>
      )}

      {/* Selected snippet */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm" dir="rtl">
        <span className="text-xs text-yellow-700 font-medium block mb-1">הטקסט שנבחר:</span>
        {context.text.slice(0, 200)}{context.text.length > 200 ? "…" : ""}
      </div>

      {/* ── PHASE: form ── */}
      {phase === "form" && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4" dir="rtl">
          {/* Source type */}
          <div className="flex gap-3 items-center flex-wrap">
            {(["gemara", "mishna", "rambam", "sifri", "tanakh"] as SourceType[]).map((t) => (
              <button
                key={t}
                onClick={() => setSourceType(t)}
                className={`text-sm px-3 py-1 rounded-full border transition ${
                  sourceType === t ? "bg-amber-600 text-white border-amber-600" : "border-gray-300 text-gray-600 hover:border-amber-400"
                }`}
              >
                {t === "gemara" ? "גמרא" : t === "mishna" ? "משנה" : t === "rambam" ? 'רמב"ם' : t === "sifri" ? "ספרי" : 'תנ"ך'}
              </button>
            ))}
          </div>

          {/* Bavli/Yerushalmi sub-type — only when gemara, on its own row */}
          {sourceType === "gemara" && (
            <div className="flex gap-2 items-center">
              {(["בבלי", "ירושלמי"] as const).map((lbl, i) => (
                <button
                  key={lbl}
                  onClick={() => setYerushalmi(i === 1)}
                  className={`text-xs px-3 py-1 rounded-full border transition ${
                    yerushalmi === (i === 1) ? "bg-amber-600 text-white border-amber-600" : "border-gray-300 text-gray-500 hover:border-amber-400"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {/* Tractate — only for gemara/mishna */}
          {(sourceType === "gemara" || sourceType === "mishna") && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">מסכת</label>
              <select
                value={tractate}
                onChange={(e) => { setTractate(e.target.value); setSearchResults([]); setSearchQuery(""); }}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-[180px]"
              >
                <option value="">בחר...</option>
                {TRACTATE_ENTRIES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* Bavli daf fields */}
          {sourceType === "gemara" && !yerushalmi && (
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">דף</label>
                <input
                  type="text"
                  value={dafHe}
                  onChange={(e) => setDafHe(e.target.value)}
                  placeholder="נו"
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  dir="rtl"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">עמוד</label>
                <div className="flex border border-gray-300 rounded overflow-hidden text-sm">
                  {(["עמ' א", "עמ' ב", "כל הדף"] as const).map((lbl, i) => {
                    const val: Amud = i === 0 ? "א" : i === 1 ? "ב" : "both";
                    return (
                      <button
                        key={lbl}
                        onClick={() => setAmud(val)}
                        className={`px-2 py-1 transition ${amud === val ? "bg-amber-600 text-white" : "bg-white text-gray-600 hover:bg-amber-50"}`}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Yerushalmi: לפי פרק / לפי דף toggle + fields */}
          {sourceType === "gemara" && yerushalmi && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["perek", "daf"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setYerushalmiInputMode(m)}
                    className={`text-xs px-3 py-1 rounded-full border transition ${
                      yerushalmiInputMode === m ? "bg-gray-700 text-white border-gray-700" : "border-gray-300 text-gray-500 hover:border-gray-500"
                    }`}
                  >
                    {m === "perek" ? "לפי פרק" : "לפי דף"}
                  </button>
                ))}
              </div>

              {yerushalmiInputMode === "perek" && (
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">פרק</label>
                    <input
                      type="text"
                      value={gemaraChapterHe}
                      onChange={(e) => setGemaraChapterHe(e.target.value)}
                      placeholder="א"
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      dir="rtl"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">הלכה (רשות)</label>
                    <input
                      type="text"
                      value={yerushalmiHalachaHe}
                      onChange={(e) => setYerushalmiHalachaHe(e.target.value)}
                      placeholder="ב"
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      dir="rtl"
                    />
                  </div>
                </div>
              )}

              {yerushalmiInputMode === "daf" && (
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">דף (וילנא)</label>
                    <input
                      type="text"
                      value={dafHe}
                      onChange={(e) => setDafHe(e.target.value)}
                      placeholder="ד"
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      dir="rtl"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">עמוד</label>
                    <div className="flex border border-gray-300 rounded overflow-hidden text-sm">
                      {(["עמ' א", "עמ' ב", "כל הדף"] as const).map((lbl, i) => {
                        const val: Amud = i === 0 ? "א" : i === 1 ? "ב" : "both";
                        return (
                          <button
                            key={lbl}
                            onClick={() => setAmud(val)}
                            className={`px-2 py-1 transition ${amud === val ? "bg-amber-600 text-white" : "bg-white text-gray-600 hover:bg-amber-50"}`}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mishna: chapter + mishna */}
          {sourceType === "mishna" && (
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">פרק</label>
                <input
                  type="text"
                  value={mishnaChapterHe}
                  onChange={(e) => setMishnaChapterHe(e.target.value)}
                  placeholder="ג"
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  dir="rtl"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">משנה (רשות)</label>
                <input
                  type="text"
                  value={mishnaHe}
                  onChange={(e) => setMishnaHe(e.target.value)}
                  placeholder="ב"
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  dir="rtl"
                />
              </div>
            </div>
          )}

          {/* Rambam: section + chapter + halacha */}
          {sourceType === "rambam" && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">הלכות</label>
                <select
                  value={rambamSection}
                  onChange={(e) => setRambamSection(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-[260px]"
                >
                  <option value="">בחר הלכות...</option>
                  {RAMBAM_ENTRIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">פרק</label>
                  <input type="text" value={rambamChapterHe} onChange={(e) => setRambamChapterHe(e.target.value)}
                    placeholder="א" className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400" dir="rtl" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">הלכה (רשות)</label>
                  <input type="text" value={rambamHalachaHe} onChange={(e) => setRambamHalachaHe(e.target.value)}
                    placeholder="ב" className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400" dir="rtl" />
                </div>
              </div>
            </div>
          )}

          {/* Sifri: book toggle + parasha dropdown + piska */}
          {sourceType === "sifri" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["Bamidbar", "Devarim"] as const).map((b) => (
                  <button key={b} onClick={() => { setSifriBook(b); setSifriParasha(""); setSifriPiskaHe(""); }}
                    className={`text-xs px-3 py-1 rounded-full border transition ${sifriBook === b ? "bg-amber-600 text-white border-amber-600" : "border-gray-300 text-gray-600 hover:border-amber-400"}`}>
                    {b === "Bamidbar" ? "במדבר" : "דברים"}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">פרשה (רשות)</label>
                  <select
                    value={sifriParasha}
                    onChange={(e) => {
                      const name = e.target.value;
                      setSifriParasha(name);
                      if (name) {
                        const list = sifriBook === "Bamidbar" ? SIFRI_BAMIDBAR_PARSHIYOT : SIFRI_DEVARIM_PARSHIYOT;
                        const p = list.find((x) => x.name === name);
                        if (p) setSifriPiskaHe(heNum(p.firstPiska));
                      }
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-[140px]"
                  >
                    <option value="">בחר...</option>
                    {(sifriBook === "Bamidbar" ? SIFRI_BAMIDBAR_PARSHIYOT : SIFRI_DEVARIM_PARSHIYOT).map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">פסקא</label>
                  <input type="text" value={sifriPiskaHe} onChange={(e) => setSifriPiskaHe(e.target.value)}
                    placeholder="א" className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400" dir="rtl" />
                </div>
              </div>
            </div>
          )}

          {/* Tanakh: category tabs + book dropdown + chapter + verse */}
          {sourceType === "tanakh" && (
            <div className="space-y-3">
              {/* Category tabs */}
              <div className="flex gap-2">
                {(["torah", "neviim", "ketuvim"] as TanakhCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setTanakhCategory(cat); setTanakhBook(null); }}
                    className={`text-xs px-3 py-1 rounded-full border transition ${
                      tanakhCategory === cat ? "bg-amber-600 text-white border-amber-600" : "border-gray-300 text-gray-600 hover:border-amber-400"
                    }`}
                  >
                    {cat === "torah" ? "תורה" : cat === "neviim" ? "נביאים" : "כתובים"}
                  </button>
                ))}
              </div>
              {/* Book dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">ספר</label>
                <select
                  value={tanakhBook?.en ?? ""}
                  onChange={(e) => {
                    const books = tanakhCategory === "torah" ? TORAH_BOOKS : tanakhCategory === "neviim" ? NEVIIM_BOOKS : KETUVIM_BOOKS;
                    const found = books.find((b) => b.en === e.target.value) ?? null;
                    setTanakhBook(found);
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-[200px]"
                >
                  <option value="">בחר ספר...</option>
                  {(tanakhCategory === "torah" ? TORAH_BOOKS : tanakhCategory === "neviim" ? NEVIIM_BOOKS : KETUVIM_BOOKS).map((b) => (
                    <option key={b.en} value={b.en}>{b.he}</option>
                  ))}
                </select>
              </div>
              {/* Chapter + verse */}
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">פרק</label>
                  <input
                    type="text"
                    value={tanakhChapterHe}
                    onChange={(e) => setTanakhChapterHe(e.target.value)}
                    placeholder="א"
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    dir="rtl"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">פסוק (רשות)</label>
                  <input
                    type="text"
                    value={tanakhVerseHe}
                    onChange={(e) => setTanakhVerseHe(e.target.value)}
                    placeholder="ג"
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Text search — only for gemara/mishna */}
          {tractate && (sourceType === "gemara" || sourceType === "mishna") && (
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="חפש טקסט במסכת..."
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                  dir="rtl"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 transition"
                >
                  {searching ? "..." : "חפש"}
                </button>
              </div>
              {searchError && <p className="text-xs text-red-500">{searchError}</p>}
              {searchResults.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {searchResults.map((r) => (
                    <button
                      key={r.ref}
                      onClick={() => handleSelectSearchResult(r)}
                      title={r.snippet}
                      className="text-xs border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-full transition"
                    >
                      {r.heRef}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {formError && <p className="text-xs text-red-500">{formError}</p>}

          <button
            onClick={handlePull}
            disabled={loadingPull}
            className="bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition text-sm"
          >
            {loadingPull ? "טוען..." : "משוך מקור"}
          </button>
        </div>
      )}

      {/* ── PHASE: selecting ── */}
      {phase === "selecting" && (
        <div className="space-y-3">
          <button onClick={() => setPhase("form")} className="text-xs text-amber-700 underline hover:text-amber-900">
            ← שנה מקור
          </button>

          {/* Navigation */}
          {showNav && (
            <div className="flex gap-2 items-center">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => loadAdjacent("prev")}
                disabled={isPrevDisabled() || loadingDir === "prev"}
                className="text-xs px-3 py-1 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full disabled:opacity-40 transition"
              >
                {loadingDir === "prev" ? "..." : `${getPrevLabel()} ←`}
              </button>
              <span className="flex-1 text-center text-xs text-gray-600 font-medium">
                {getCurrentLabel()}
              </span>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => loadAdjacent("next")}
                disabled={loadingDir === "next"}
                className="text-xs px-3 py-1 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full disabled:opacity-40 transition"
              >
                {loadingDir === "next" ? "..." : `→ ${getNextLabel()}`}
              </button>
            </div>
          )}

          {/* Selectable text */}
          <div
            ref={textRef}
            className="bg-white rounded-lg border border-gray-200 p-4 text-sm leading-loose cursor-text select-text min-h-[120px] max-h-[400px] overflow-y-auto"
            dir="rtl"
          >
            {segments.length > 0
              ? segments.map((s) => stripHtml(s.text)).join(" ")
              : <span className="text-gray-400">לא נמצא טקסט</span>
            }
          </div>

          {pendingSelection && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
              <p className="flex-1 text-gray-700 leading-snug" dir="rtl">
                <span className="font-medium text-yellow-800">נבחר: </span>
                {pendingSelection.slice(0, 120)}{pendingSelection.length > 120 ? "…" : ""}
              </p>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={addChunk}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1 rounded-full transition"
              >
                + הוסף
              </button>
            </div>
          )}

          {(totalChunks > 0 || chunkGroups.length > 0) && (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-amber-700">
                {totalChunks} קטעים{chunkGroups.length > 0 ? ` (${chunkGroups.length} מיקומים)` : ""}
              </span>
              <button
                onClick={() => { setChunks([]); setChunkGroups([]); setPendingSelection(""); }}
                className="text-xs text-gray-400 hover:text-red-500 underline"
              >
                נקה הכל
              </button>
              <div className="flex-1" />
              <button onClick={() => setPhase("confirming")} className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                אשר נוסח ←
              </button>
            </div>
          )}

          {totalChunks === 0 && chunkGroups.length === 0 && (
            <div className="flex justify-end">
              <button onClick={() => setPhase("confirming")} className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                הוסף כל הטקסט ←
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PHASE: confirming ── */}
      {phase === "confirming" && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">האם לאשר את הנוסח הבא?</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm leading-loose max-h-[400px] overflow-y-auto" dir="rtl">
            {confirmedText}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setPhase("selecting")} className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm">חזור לעריכה</button>
            <button onClick={handleConfirm} className="flex-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-lg transition">כן, אשר ←</button>
          </div>
        </div>
      )}

      {/* ── PHASE: commenting ── */}
      {phase === "commenting" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border-r-4 border-amber-400 rounded-lg p-4 text-sm leading-loose max-h-[200px] overflow-y-auto" dir="rtl">
            {confirmedText}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">מפרשים</h3>
            <CommentatorSuggestions
              segmentRefs={confirmedSegmentRefs}
              added={commentaries}
              onAdd={(entry) => setCommentaries((prev) => [...prev, entry])}
              onRemove={(ref) => setCommentaries((prev) => prev.filter((c) => c.ref !== ref))}
            />
          </div>

          {commentaries.length > 0 && (
            <div className="space-y-3">
              {commentaries.map((c) => (
                <div key={c.ref} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-800 text-sm flex-1">{c.heRef}</span>
                    <button
                      onClick={() => handleEditCommentary(c)}
                      className="text-xs px-2 py-1 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded transition"
                    >
                      ערוך
                    </button>
                    <button
                      onClick={() => setCommentaries((prev) => prev.filter((x) => x.ref !== c.ref))}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed max-h-[150px] overflow-y-auto" dir="rtl">
                    {c.text.split("\n").filter(Boolean).map((line, j) => <p key={j}>{line}</p>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setPhase("selecting")} className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm">חזור לעריכה</button>
            {commentaries.length > 0 && (
              <button onClick={() => handleAddToDoc(true)} className="px-4 py-2 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg transition text-sm">
                מפרש בלבד ←
              </button>
            )}
            <button onClick={() => handleAddToDoc(false)} className="flex-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-lg transition">
              {context.annotation ? "שמור שינויים ←" : "הוסף לדף מקורות ←"}
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: editing-commentary ── */}
      {phase === "editing-commentary" && editingCommentary && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-800 text-sm">{editingCommentary.heRef}</span>
            <span className="text-xs text-gray-400">— סמן את הקטעים הרלוונטיים</span>
          </div>

          <div
            ref={editingComTextRef}
            className="bg-white rounded-lg border border-gray-200 p-4 text-sm leading-loose cursor-text select-text min-h-[120px] max-h-[400px] overflow-y-auto"
            dir="rtl"
          >
            {editingCommentary.text || <span className="text-gray-400">אין טקסט</span>}
          </div>

          {editingComPending && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
              <p className="flex-1 text-gray-700 leading-snug" dir="rtl">
                <span className="font-medium text-yellow-800">נבחר: </span>
                {editingComPending.slice(0, 120)}{editingComPending.length > 120 ? "…" : ""}
              </p>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={addComChunk}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1 rounded-full transition"
              >
                + הוסף
              </button>
            </div>
          )}

          {editingComChunks.length > 0 && (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-amber-700">{editingComChunks.length} קטעים</span>
              <button onClick={() => setEditingComChunks([])} className="text-xs text-gray-400 hover:text-red-500 underline">נקה</button>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setEditingCommentary(null); setPhase("commenting"); }} className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm">ביטול</button>
            <button onClick={saveCommentaryEdit} className="flex-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-lg transition">
              {editingComChunks.length > 0 ? "שמור בחירה ←" : "שמור ←"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
