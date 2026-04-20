"use client";

import { useState } from "react";
import type { ManualSource } from "@/lib/useFeedback";
import { TRACTATE_ENTRIES, HILCHOT_ENTRIES, RISHONIM_ENTRIES } from "@/lib/authorMap";
import { toHebrewNumeral } from "@/lib/hebrewNumerals";
import SearchableSelect from "./SearchableSelect";

type SourceType = "gemara" | "mishna" | "rishonim" | "rambam";

type Props = {
  seifIndex?: number;
  onAdd: (src: ManualSource) => void;
  onClose: () => void;
};

const TAB_LABELS: { id: SourceType; label: string }[] = [
  { id: "gemara", label: "גמרא" },
  { id: "mishna", label: "משנה" },
  { id: "rishonim", label: "ראשונים" },
  { id: "rambam", label: 'רמב"ם' },
];

function buildRef(
  type: SourceType,
  tractate: string,
  daf: number,
  amud: "a" | "b",
  chapter: string,
  mishna: string,
  commentator: string,
  hilchot: string,
  hilchotChapter: string,
  halacha: string
): { sefariaRef: string; displayName: string } | null {
  switch (type) {
    case "gemara": {
      if (!tractate || !daf) return null;
      const sefariaRef = `${tractate}.${daf}${amud}`;
      const dafHe = toHebrewNumeral(daf) + (amud === "a" ? ":" : ".");
      const tractateLabel = TRACTATE_ENTRIES.find((e) => e.value === tractate)?.label ?? tractate;
      const displayName = `${tractateLabel} דף ${dafHe}`;
      return { sefariaRef, displayName };
    }
    case "mishna": {
      if (!tractate || !chapter) return null;
      const sefariaRef = mishna
        ? `Mishnah_${tractate}.${chapter}.${mishna}`
        : `Mishnah_${tractate}.${chapter}`;
      const tractateLabel = TRACTATE_ENTRIES.find((e) => e.value === tractate)?.label ?? tractate;
      const displayName = mishna
        ? `משנה ${tractateLabel} פרק ${toHebrewNumeral(Number(chapter))} משנה ${toHebrewNumeral(Number(mishna))}`
        : `משנה ${tractateLabel} פרק ${toHebrewNumeral(Number(chapter))}`;
      return { sefariaRef, displayName };
    }
    case "rishonim": {
      if (!commentator || !tractate || !daf) return null;
      const sefariaRef = `${commentator}_on_${tractate}.${daf}${amud}`;
      const commentatorLabel = RISHONIM_ENTRIES.find((e) => e.value === commentator)?.label ?? commentator;
      const tractateLabel = TRACTATE_ENTRIES.find((e) => e.value === tractate)?.label ?? tractate;
      const dafHe = toHebrewNumeral(daf) + (amud === "a" ? ":" : ".");
      const displayName = `${commentatorLabel} על ${tractateLabel} ${dafHe}`;
      return { sefariaRef, displayName };
    }
    case "rambam": {
      if (!hilchot || !hilchotChapter) return null;
      const sefariaRef = halacha
        ? `Mishneh_Torah,_Laws_of_${hilchot}.${hilchotChapter}.${halacha}`
        : `Mishneh_Torah,_Laws_of_${hilchot}.${hilchotChapter}`;
      const hilchotLabel = HILCHOT_ENTRIES.find((e) => e.value === hilchot)?.label ?? hilchot;
      const displayName = halacha
        ? `רמב"ם הלכות ${hilchotLabel} פרק ${toHebrewNumeral(Number(hilchotChapter))} הלכה ${toHebrewNumeral(Number(halacha))}`
        : `רמב"ם הלכות ${hilchotLabel} פרק ${toHebrewNumeral(Number(hilchotChapter))}`;
      return { sefariaRef, displayName };
    }
  }
}

export default function AddManualSourceModal({ seifIndex, onAdd, onClose }: Props) {
  const [tab, setTab] = useState<SourceType>("gemara");

  // Shared fields
  const [tractate, setTractate] = useState("");
  const [daf, setDaf] = useState("");
  const [amud, setAmud] = useState<"a" | "b">("a");
  const [chapter, setChapter] = useState("");
  const [mishna, setMishna] = useState("");
  const [commentator, setCommentator] = useState("");
  const [hilchot, setHilchot] = useState("");
  const [hilchotChapter, setHilchotChapter] = useState("");
  const [halacha, setHalacha] = useState("");

  const [fetchStatus, setFetchStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [fetchedText, setFetchedText] = useState("");
  const [fetchError, setFetchError] = useState("");

  const dafNum = parseInt(daf, 10);
  const built = buildRef(
    tab,
    tractate,
    isNaN(dafNum) ? 0 : dafNum,
    amud,
    chapter,
    mishna,
    commentator,
    hilchot,
    hilchotChapter,
    halacha
  );

  async function handleFetch() {
    if (!built) return;
    setFetchStatus("loading");
    setFetchedText("");
    setFetchError("");
    try {
      const res = await fetch(`/api/source?ref=${encodeURIComponent(built.sefariaRef)}`);
      if (!res.ok) throw new Error(`שגיאה ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const text: string = data.text ?? "";
      setFetchedText(text.slice(0, 300));
      setFetchStatus("ok");
    } catch (e: any) {
      setFetchError(e.message ?? "שגיאה לא ידועה");
      setFetchStatus("error");
    }
  }

  function handleAdd() {
    if (!built) return;
    onAdd({
      ref: built.displayName,
      text: "",
      seifIndex,
      sefariaRef: built.sefariaRef,
    });
    onClose();
  }

  function resetFetch() {
    setFetchStatus("idle");
    setFetchedText("");
    setFetchError("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-amber-900">הוסף מקור ידנית</h2>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {TAB_LABELS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); resetFetch(); }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                tab === t.id
                  ? "bg-amber-700 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {/* Commentator (ראשונים only) */}
          {tab === "rishonim" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">מפרש</label>
              <SearchableSelect
                items={RISHONIM_ENTRIES}
                value={commentator}
                onChange={(v) => { setCommentator(v); resetFetch(); }}
                placeholder="חפש מפרש..."
              />
            </div>
          )}

          {/* Tractate (gemara / mishna / rishonim) */}
          {(tab === "gemara" || tab === "mishna" || tab === "rishonim") && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">מסכת</label>
              <SearchableSelect
                items={TRACTATE_ENTRIES}
                value={tractate}
                onChange={(v) => { setTractate(v); resetFetch(); }}
                placeholder="חפש מסכת..."
              />
            </div>
          )}

          {/* Daf + Amud (gemara / rishonim) */}
          {(tab === "gemara" || tab === "rishonim") && (
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  דף{daf && !isNaN(Number(daf)) ? ` (${toHebrewNumeral(Number(daf))})` : ""}
                </label>
                <input
                  type="number"
                  min={2}
                  value={daf}
                  onChange={(e) => { setDaf(e.target.value); resetFetch(); }}
                  placeholder="מספר דף"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">עמוד</label>
                <div className="flex gap-2">
                  {(["a", "b"] as const).map((a) => (
                    <label key={a} className="flex items-center gap-1 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="amud"
                        value={a}
                        checked={amud === a}
                        onChange={() => { setAmud(a); resetFetch(); }}
                      />
                      {a === "a" ? "עמוד א'" : "עמוד ב'"}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chapter (mishna / rambam) */}
          {(tab === "mishna" || tab === "rambam") && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                פרק{chapter && !isNaN(Number(chapter)) ? ` (${toHebrewNumeral(Number(chapter))})` : ""}
              </label>
              <input
                type="number"
                min={1}
                value={chapter}
                onChange={(e) => { setChapter(e.target.value); resetFetch(); }}
                placeholder="מספר פרק"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

          {/* Mishna number (mishna only, optional) */}
          {tab === "mishna" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                משנה (אופציונלי){mishna && !isNaN(Number(mishna)) ? ` (${toHebrewNumeral(Number(mishna))})` : ""}
              </label>
              <input
                type="number"
                min={1}
                value={mishna}
                onChange={(e) => { setMishna(e.target.value); resetFetch(); }}
                placeholder="מספר משנה"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

          {/* Hilchot (rambam only) */}
          {tab === "rambam" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">הלכות</label>
              <SearchableSelect
                items={HILCHOT_ENTRIES}
                value={hilchot}
                onChange={(v) => { setHilchot(v); resetFetch(); }}
                placeholder="חפש הלכות..."
              />
            </div>
          )}

          {/* Hilchot chapter (rambam only) */}
          {tab === "rambam" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                פרק{hilchotChapter && !isNaN(Number(hilchotChapter)) ? ` (${toHebrewNumeral(Number(hilchotChapter))})` : ""}
              </label>
              <input
                type="number"
                min={1}
                value={hilchotChapter}
                onChange={(e) => { setHilchotChapter(e.target.value); resetFetch(); }}
                placeholder="מספר פרק"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

          {/* Halacha (rambam only, optional) */}
          {tab === "rambam" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                הלכה (אופציונלי){halacha && !isNaN(Number(halacha)) ? ` (${toHebrewNumeral(Number(halacha))})` : ""}
              </label>
              <input
                type="number"
                min={1}
                value={halacha}
                onChange={(e) => { setHalacha(e.target.value); resetFetch(); }}
                placeholder="מספר הלכה"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}
        </div>

        {/* Constructed ref preview */}
        {built && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
            <span className="font-medium">קישור לספריא: </span>
            <span dir="ltr" className="font-mono">{built.sefariaRef}</span>
          </div>
        )}

        {/* Fetch button + status */}
        {built && (
          <button
            onClick={handleFetch}
            disabled={fetchStatus === "loading"}
            className="w-full border border-amber-600 text-amber-700 hover:bg-amber-50 disabled:opacity-50 font-medium py-2 px-4 rounded-lg transition text-sm"
          >
            {fetchStatus === "loading" ? "טוען..." : "משוך מספריא"}
          </button>
        )}

        {fetchStatus === "ok" && fetchedText && (
          <div className="text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-h-32 overflow-auto leading-relaxed">
            {fetchedText}…
          </div>
        )}

        {fetchStatus === "error" && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            שגיאה: {fetchError}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleAdd}
            disabled={!built}
            className="flex-1 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
          >
            הוסף
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
