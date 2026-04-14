"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "./store";
import type { CommentaryEntry, Annotation } from "@/lib/types";
import TextPanel from "@/components/TextPanel";
import SelectionPopover from "@/components/SelectionPopover";
import SourceDocSidebar from "@/components/SourceDocSidebar";
import SourcePullView from "@/components/SourcePullView";
import { buildSourceLabel, buildSectionNumber, getHex } from "@/lib/sourceLabels";
// buildSourceLabel is used by SelectionPopover via handleDefineSource's sectionLabel
import { toHebrewNumeral } from "@/lib/hebrewNumerals";

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim: "אורח חיים",
  YorehDeah: "יורה דעה",
  EvenHaEzer: "אבן העזר",
  ChoshenMishpat: "חושן משפט",
};

const SOURCE_ORDER = [
  { key: "shulchanArukh", title: "שולחן ערוך" },
  { key: "tur",           title: "טור" },
  { key: "beitYosef",     title: "בית יוסף" },
  { key: "taz",           title: 'ט"ז' },
  { key: "shakh",         title: 'ש"ך' },
  { key: "pitcheiTeshuva",title: "פתחי תשובה" },
] as const;

type TextsData = {
  tur: { ref: string; text: string } | null;
  beitYosef: { ref: string; text: string[] } | null;
  shulchanArukh: { ref: string; text: string[] } | null;
  taz: { ref: string; text: string[] } | null;
  shakh: { ref: string; text: string[] } | null;
  pitcheiTeshuva: { ref: string; text: string[] } | null;
};

export type SourcePullContext = {
  text: string;          // the selected commentator text snippet
  sourceKey: string;     // which commentator panel it came from
  sectionIndex?: number;
  sectionHtml?: string;  // full section HTML for the collapsible reference view
  sectionLabel?: string; // label of that section e.g. "ב"י ס"ק ג׳"
  annotation?: Annotation;
};

function buildSections(
  _sourceKey: string,
  texts: string[]
): { index: number; label: string; html: string }[] {
  return texts.map((html, i) => ({
    index: i,
    label: buildSectionNumber(i),
    html,
  }));
}

export default function SimanPage() {
  const params = useParams();
  const router = useRouter();
  const chelek = params.chelek as string;
  const number = params.number as string;

  const {
    excerpts,
    expandedPanels,
    addExcerpt,
    removeExcerpt,
    reorderExcerpts,
    addAnnotation,
    addHeading,
    togglePanel,
    setSession,
    reset,
  } = useStore();

  const [texts, setTexts] = useState<TextsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourcePullContext, setSourcePullContext] = useState<SourcePullContext | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    setSession(chelek, number);
  }, [chelek, number, setSession]);

  useEffect(() => {
    fetch(`/api/annotations?chelek=${chelek}&siman=${number}`)
      .then((r) => { if (!r.ok) return { annotations: [] }; return r.json(); })
      .then((data: { annotations: Annotation[] }) => setAnnotations(data.annotations ?? []))
      .catch(() => {/* silent */});
  }, [chelek, number]);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/siman-texts?chelek=${chelek}&siman=${number}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TextsData>;
      })
      .then((data) => {
        setTexts(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [chelek, number]);

  const handleAdd = useCallback(
    (params: {
      sourceKey: string;
      sectionIndex?: number;
      text: string;
      sourceLabel: string;
    }) => {
      addExcerpt({
        sourceKey: params.sourceKey,
        sourceLabel: params.sourceLabel,
        text: params.text,
        sectionIndex: params.sectionIndex,
      });
      fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chelek,
          siman: number,
          sourceKey: params.sourceKey,
          sourceLabel: params.sourceLabel,
          text: params.text,
          highlightText: params.text.replace(/<[^>]+>/g, ""),
          sectionIndex: params.sectionIndex ?? null,
        }),
      })
        .then((r) => r.json())
        .then((data: { annotation?: Annotation }) => {
          if (data.annotation) setAnnotations((prev) => [...prev, data.annotation!]);
        })
        .catch(() => {});
    },
    [addExcerpt, chelek, number]
  );

  const handleDefineSource = useCallback(
    (selectedText: string, sourceKey: string, sectionIndex?: number, sectionHtml?: string) => {
      const sectionLabel = sectionIndex !== undefined
        ? buildSourceLabel(sourceKey, sectionIndex)
        : undefined;
      setSourcePullContext({ text: selectedText, sourceKey, sectionIndex, sectionHtml, sectionLabel });
    },
    []
  );

  const handleAddPulledSource = useCallback(
    (params: {
      sourceKey: string;
      sourceLabel: string;
      text: string;
      sourceRef?: string;
      commentaries?: CommentaryEntry[];
    }) => {
      addExcerpt({
        sourceKey: params.sourceKey,
        sourceLabel: params.sourceLabel,
        text: params.text,
        sourceRef: params.sourceRef,
        commentaries: params.commentaries,
      });
      fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chelek,
          siman: number,
          sourceKey: params.sourceKey,
          sourceLabel: params.sourceLabel,
          text: params.text,
          highlightText: params.text.replace(/<[^>]+>/g, ""),
          sourceRef: params.sourceRef ?? null,
          commentaries: params.commentaries ?? [],
        }),
      })
        .then((r) => r.json())
        .then((data: { annotation?: Annotation }) => {
          if (data.annotation) setAnnotations((prev) => [...prev, data.annotation!]);
        })
        .catch(() => {});
      setSourcePullContext(null);
    },
    [addExcerpt, chelek, number]
  );

  function handleMarkClick(e: React.MouseEvent) {
    const mark = (e.target as Element).closest("mark[data-annotation-id]");
    if (!mark) return;
    const annotationId = mark.getAttribute("data-annotation-id");
    const annotation = annotations.find((a) => a.id === annotationId);
    if (!annotation) return;
    setSourcePullContext({
      text: annotation.highlightText ?? annotation.text,
      sourceKey: annotation.sourceKey,
      sectionIndex: annotation.sectionIndex ?? undefined,
      sectionHtml: annotation.sectionHtml ?? undefined,
      sectionLabel: annotation.sourceLabel,
      annotation,
    });
  }

  const simanLabel = toHebrewNumeral(parseInt(number));
  const chelekLabel = CHELEK_LABELS[chelek] ?? chelek;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" dir="rtl">
      {/* Sidebar — appears on RIGHT in RTL */}
      <SourceDocSidebar
        excerpts={excerpts}
        chelek={chelek}
        siman={number}
        onRemove={removeExcerpt}
        onReorder={reorderExcerpts}
        onAddAnnotation={addAnnotation}
        onAddHeading={addHeading}
        onReset={reset}
      />

      {/* Main content — appears to the left of the sidebar in RTL */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => router.push("/")}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← בחר סימן
          </button>
          <div className="flex-1 text-center">
            <span className="font-bold text-gray-800">{chelekLabel}</span>
            <span className="mx-2 text-gray-300">·</span>
            <span className="text-gray-600">סימן {simanLabel}</span>
          </div>
          <div className="w-20" />
        </div>

        {/* Source pull view — replaces panels */}
        {sourcePullContext && (
          <SourcePullView
            context={sourcePullContext}
            onBack={() => setSourcePullContext(null)}
            onAddToDoc={handleAddPulledSource}
          />
        )}

        {/* Panels area — hidden while source pull is active */}
        {!sourcePullContext && (
          <div className="flex-1 overflow-y-auto p-4" onClick={handleMarkClick}>
            {loading && (
              <div className="text-center py-16 space-y-3">
                <div className="text-3xl animate-spin inline-block">⏳</div>
                <p className="text-gray-500 text-sm">טוען טקסטים מספריה...</p>
                <p className="text-gray-400 text-xs">הטעינה הראשונה עשויה לקחת כמה שניות</p>
              </div>
            )}
            {error && (
              <div className="mx-4 mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                <p className="font-bold mb-1">שגיאה בטעינה</p>
                <p>{error}</p>
                <button
                  onClick={() => {
                    setLoading(true);
                    setError("");
                    fetch(`/api/siman-texts?chelek=${chelek}&siman=${number}`)
                      .then((r) => r.json())
                      .then((data) => { setTexts(data); setLoading(false); })
                      .catch((e: Error) => { setError(e.message); setLoading(false); });
                  }}
                  className="mt-3 text-xs underline"
                >
                  נסה שוב
                </button>
              </div>
            )}
            {texts && !loading && (
              <div>
                {SOURCE_ORDER.map(({ key, title }) => {
                  const hex = getHex(key);
                  const expanded = expandedPanels[key] === true;

                  if (key === "tur") {
                    return (
                      <TextPanel
                        key={key}
                        title={title}
                        hexColor={hex}
                        sourceKey={key}
                        expanded={expanded}
                        onToggle={() => togglePanel(key)}
                        html={texts.tur?.text ?? ""}
                        annotations={annotations.filter((a) => a.sourceKey === key)}
                      />
                    );
                  }

                  const data = (texts as Record<string, { ref: string; text: string[] } | null>)[key];
                  const sections = data ? buildSections(key, data.text) : undefined;

                  return (
                    <TextPanel
                      key={key}
                      title={title}
                      hexColor={hex}
                      sourceKey={key}
                      expanded={expanded}
                      onToggle={() => togglePanel(key)}
                      sections={sections}
                      annotations={annotations.filter((a) => a.sourceKey === key)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global floating add button — hidden while source pull is active */}
      {!sourcePullContext && (
        <SelectionPopover
          onAdd={handleAdd}
          onDefineSource={handleDefineSource}
          texts={texts}
        />
      )}
    </div>
  );
}
