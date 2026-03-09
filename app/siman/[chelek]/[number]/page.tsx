"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore, type ApprovedSource, type CommentaryEntry } from "./store";
import type { ParsedSource } from "@/lib/parser";
import type { Link } from "@/lib/sefaria";
import ApprovedSourceCard from "@/components/ApprovedSourceCard";
import ActiveSourcePanel from "@/components/ActiveSourcePanel";
import ProgressBar from "@/components/ProgressBar";
import { parseSourcesFromSeifim } from "@/lib/parser";

type SourceData = {
  text: string;
  links: Link[];
};

export default function SimanPage() {
  const params = useParams();
  const router = useRouter();
  const chelek = params.chelek as string;
  const number = params.number as string;

  const { sources, currentIndex, approvedSources, setSources, approveSource, skipSource } = useStore();

  const [byPageLoad, setByPageLoad] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSourceData, setCurrentSourceData] = useState<SourceData | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  // Load Beit Yosef text on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/beit-yosef?chelek=${chelek}&siman=${number}`);
        if (!res.ok) throw new Error(`Failed to load Beit Yosef: ${res.status}`);
        const data = await res.json();
        const parsed = parseSourcesFromSeifim(data.text ?? []);
        setSources(parsed);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
        setByPageLoad(true);
      }
    }
    if (!byPageLoad) {
      load();
    }
  }, [chelek, number]);

  const currentSource: ParsedSource | undefined = sources[currentIndex];
  const isDone = currentIndex >= sources.length && sources.length > 0;

  // Load source text when currentSource changes
  const loadSourceData = useCallback(async (source: ParsedSource) => {
    if (!source.sefariaRef) {
      setCurrentSourceData({ text: source.raw, links: [] });
      return;
    }
    setSourceLoading(true);
    try {
      const res = await fetch(
        `/api/source?ref=${encodeURIComponent(source.sefariaRef)}&links=1`
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setCurrentSourceData({ text: data.text ?? "", links: data.links ?? [] });
    } catch {
      setCurrentSourceData({ text: source.raw, links: [] });
    } finally {
      setSourceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentSource) {
      loadSourceData(currentSource);
    }
  }, [currentSource, loadSourceData]);

  function handleApprove(selectedText: string, commentaries: CommentaryEntry[]) {
    if (!currentSource) return;
    const approved: ApprovedSource = {
      ref: currentSource.sefariaRef ?? currentSource.raw,
      raw: currentSource.raw,
      selectedText,
      commentaries,
    };
    approveSource(approved);
    setCurrentSourceData(null);
  }

  const chelekLabels: Record<string, string> = {
    OrachChayim: "אורח חיים",
    YorehDeah: "יורה דעה",
    EvenHaEzer: "אבן העזר",
    ChoshenMishpat: "חושן משפט",
  };

  return (
    <div className="min-h-screen bg-amber-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-amber-200 px-6 py-3 flex items-center justify-between no-print">
        <button
          onClick={() => router.push("/")}
          className="text-amber-700 hover:text-amber-900 text-sm"
        >
          → חזרה
        </button>
        <h1 className="font-bold text-amber-900">
          בית יוסף — {chelekLabels[chelek] ?? chelek} סימן {number}
        </h1>
        <span className="text-xs text-gray-400">{approvedSources.length} מקורות אושרו</span>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Loading / error states */}
        {loading && (
          <div className="text-center py-20 text-gray-400 animate-pulse">
            טוען בית יוסף...
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            שגיאה: {error}
          </div>
        )}

        {!loading && !error && sources.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            לא נמצאו מקורות בסימן זה.
          </div>
        )}

        {/* Approved sources stack */}
        {approvedSources.length > 0 && (
          <div className="space-y-3">
            {approvedSources.map((s, i) => (
              <ApprovedSourceCard key={i} source={s} index={i} />
            ))}
            <hr className="border-amber-300" />
          </div>
        )}

        {/* Progress bar */}
        {sources.length > 0 && !isDone && (
          <ProgressBar current={currentIndex} total={sources.length} />
        )}

        {/* Active source panel */}
        {!loading && !error && !isDone && currentSource && (
          <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-6">
            <ActiveSourcePanel
              source={currentSource}
              sourceText={currentSourceData?.text ?? ""}
              links={currentSourceData?.links ?? []}
              onApprove={handleApprove}
              onSkip={skipSource}
              isLoading={sourceLoading}
            />
          </div>
        )}

        {/* Done state */}
        {isDone && (
          <div className="text-center py-12 space-y-4">
            <p className="text-xl font-bold text-amber-900">
              עברת על כל המקורות!
            </p>
            <p className="text-gray-500 text-sm">
              {approvedSources.length} מקורות אושרו
            </p>
            <button
              onClick={() =>
                router.push(`/siman/${chelek}/${number}/document`)
              }
              className="bg-amber-700 hover:bg-amber-800 text-white font-semibold py-3 px-8 rounded-xl transition"
            >
              צפה במסמך המלא
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
