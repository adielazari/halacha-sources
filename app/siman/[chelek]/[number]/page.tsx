"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { getSimanTopic } from "@/lib/simanTopics";
import { HeadingToolbar } from "@/components/HeadingToolbar";
import type { HeadingAlign } from "@/components/HeadingToolbar";
import { useUser } from "@/lib/userContext";
import GroupSimanBanner from "@/components/GroupSimanBanner";
import { useDocumentAutosave } from "./useDocumentAutosave";
import type { ManualEntryPayload } from "@/components/AddManualSourceModal";
import SourceViewModal from "@/components/SourceViewModal";
import { usePanelPrefs, DEFAULT_PANEL_HEIGHT } from "@/lib/panelPrefs";

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim: "אורח חיים",
  YorehDeah: "יורה דעה",
  EvenHaEzer: "אבן העזר",
  ChoshenMishpat: "חושן משפט",
};

const SOURCE_ORDER = [
  { key: "tur",           title: "טור" },
  { key: "beitYosef",     title: "בית יוסף" },
  { key: "shulchanArukh", title: "שולחן ערוך" },
  { key: "taz",           title: 'ט"ז' },
  { key: "shakh",         title: 'ש"ך' },
  { key: "pitcheiTeshuva",title: "פתחי תשובה" },
  { key: "magenAvraham",  title: 'מג"א' },
  { key: "beitShmuel",    title: 'ב"ש' },
  { key: "meiratEinayim", title: 'סמ"ע' },
] as const;

// Which side-commentators actually exist for each chelek — e.g. Shakh never
// wrote on Orach Chayim, so that panel used to render permanently empty
// there. Panels not listed for the current chelek are hidden entirely.
const CHELEK_PANEL_KEYS: Record<string, string[]> = {
  OrachChayim:    ["tur", "beitYosef", "shulchanArukh", "magenAvraham", "taz"],
  YorehDeah:      ["tur", "beitYosef", "shulchanArukh", "taz", "shakh", "pitcheiTeshuva"],
  EvenHaEzer:     ["tur", "beitYosef", "shulchanArukh", "taz", "beitShmuel", "pitcheiTeshuva"],
  ChoshenMishpat: ["tur", "beitYosef", "shulchanArukh", "meiratEinayim", "shakh", "pitcheiTeshuva"],
};

type TextsData = {
  tur: { ref: string; text: string } | null;
  beitYosef: { ref: string; text: string[] } | null;
  shulchanArukh: { ref: string; text: string[] } | null;
  taz: { ref: string; text: string[] } | null;
  shakh: { ref: string; text: string[] } | null;
  pitcheiTeshuva: { ref: string; text: string[] } | null;
  magenAvraham: { ref: string; text: string[] } | null;
  beitShmuel: { ref: string; text: string[] } | null;
  meiratEinayim: { ref: string; text: string[] } | null;
};

export type SourcePullContext = {
  text: string;          // the selected commentator text snippet
  sourceKey: string;     // which commentator panel it came from
  sectionIndex?: number;
  sectionHtml?: string;  // full section HTML for the collapsible reference view
  sectionLabel?: string; // label of that section e.g. "ב"י ס"ק ג׳"
  annotation?: Annotation;
  /** Set when re-editing an existing excerpt — causes save to update in-place */
  excerptId?: string;
  /** Pre-load this Sefaria ref into SourcePullView (skips form phase) */
  preloadRef?: string;
};

/** Small inline dialog for adding a heading from a clickable label */
type HeadingDialogState = {
  text: string;
  align: HeadingAlign;
  level: 1 | 2 | 3;
} | null;

type ViewModalState = {
  title: string;
  html: string;
  commentaries?: CommentaryEntry[];
  note?: string;
  onEdit?: () => void;
} | null;

function decodeHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent ?? html;
}

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
    updateHeading,
    updateExcerptText,
    togglePanel,
    setSession,
    setExcerptAnnotationId,
    updateExcerptFields,
    reset,
  } = useStore();
  const { currentUser } = useUser();
  const panelPrefs = usePanelPrefs();
  const panelDragKey = useRef<string | null>(null);
  const panelDropTargetRef = useRef<number | null>(null);
  const [panelDropTarget, setPanelDropTarget] = useState<number | null>(null);
  const updatePanelDropTarget = useCallback((val: number | null) => {
    panelDropTargetRef.current = val;
    setPanelDropTarget(val);
  }, []);

  const [texts, setTexts] = useState<TextsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourcePullContext, setSourcePullContext] = useState<SourcePullContext | null>(null);
  const [headingDialog, setHeadingDialog] = useState<HeadingDialogState>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewModal, setViewModal] = useState<ViewModalState>(null);

  useEffect(() => {
    setSession(chelek, number);
  }, [chelek, number, setSession]);

  const saveState = useDocumentAutosave(chelek, number);

  useEffect(() => {
    fetch(`/api/annotations?chelek=${chelek}&siman=${number}&status=all`)
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
      note?: string;
    }) => {
      // Direct "הוסף לדף" — adds to the doc AND creates a linked annotation so the
      // panel highlights the exact place the source was taken from.
      const excerptId = crypto.randomUUID();
      addExcerpt({
        id: excerptId,
        sourceKey: params.sourceKey,
        sourceLabel: params.sourceLabel,
        text: params.text,
        sectionIndex: params.sectionIndex,
        note: params.note,
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
          highlightText: params.text,
          sectionIndex: params.sectionIndex ?? null,
          userName: currentUser,
        }),
      })
        .then((r) => r.json())
        .then((data: { annotation?: Annotation }) => {
          if (data.annotation) {
            setAnnotations((prev) => [...prev, data.annotation!]);
            setExcerptAnnotationId(excerptId, data.annotation.id);
          }
        })
        .catch(() => {});
    },
    [addExcerpt, chelek, number, currentUser, setExcerptAnnotationId]
  );

  const handleAddManual = useCallback(
    (payload: ManualEntryPayload) => {
      if (payload.kind === "text") {
        addExcerpt({
          type: "source",
          sourceKey: "manual",
          sourceLabel: payload.sourceLabel,
          text: payload.text,
        });
      } else {
        addExcerpt({
          type: "image",
          sourceKey: "manual",
          sourceLabel: payload.sourceLabel,
          text: "",
          imageData: payload.imageData,
        });
      }
    },
    [addExcerpt]
  );

  // Backfill: excerpts added before this linking existed (or added while an
  // earlier POST silently failed) have no annotationId — create one now so the
  // panel highlights their origin too. Guarded so each excerpt is only tried once.
  const backfilledIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const toBackfill = excerpts.filter(
      (ex) =>
        (ex.type ?? "source") === "source" &&
        !ex.annotationId &&
        ex.sourceKey &&
        ex.sourceKey !== "heading" &&
        !backfilledIds.current.has(ex.id)
    );
    if (toBackfill.length === 0) return;
    toBackfill.forEach((ex) => backfilledIds.current.add(ex.id));

    (async () => {
      for (const ex of toBackfill) {
        const highlightText = ex.text.replace(/<[^>]+>/g, "").trim();
        if (!highlightText) continue;
        try {
          const res = await fetch("/api/annotations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chelek,
              siman: number,
              sourceKey: ex.sourceKey,
              sourceLabel: ex.sourceLabel,
              text: ex.text,
              highlightText,
              sectionIndex: ex.sectionIndex ?? null,
              userName: currentUser,
            }),
          });
          const data: { annotation?: Annotation } = await res.json();
          if (data.annotation) {
            setAnnotations((prev) => [...prev, data.annotation!]);
            setExcerptAnnotationId(ex.id, data.annotation.id);
          }
        } catch { /* silent — will retry next mount */ }
      }
    })();
  }, [excerpts, chelek, number, currentUser, setExcerptAnnotationId]);

  // Repair: excerpts pulled via "הגדר מקור" never had sectionIndex copied onto
  // the excerpt itself (only the linked annotation had it) — so the document's
  // origin-section grouping/heading couldn't work. Backfill it from the annotation.
  const sectionFixedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (annotations.length === 0) return;
    const toFix = excerpts.filter((ex) => {
      if (sectionFixedIds.current.has(ex.id)) return false;
      if (ex.sectionIndex !== undefined) return false;
      if (!ex.annotationId) return false;
      const ann = annotations.find((a) => a.id === ex.annotationId);
      return ann?.sectionIndex !== null && ann?.sectionIndex !== undefined;
    });
    if (toFix.length === 0) return;
    toFix.forEach((ex) => {
      sectionFixedIds.current.add(ex.id);
      const ann = annotations.find((a) => a.id === ex.annotationId)!;
      updateExcerptFields(ex.id, { sectionIndex: ann.sectionIndex! });
    });
  }, [excerpts, annotations, updateExcerptFields]);

  // Remove excerpt + delete its panel highlight annotation (if any)
  const handleRemoveExcerpt = useCallback(
    (id: string) => {
      const excerpt = excerpts.find((e) => e.id === id);
      removeExcerpt(id);
      if (excerpt?.annotationId) {
        fetch(`/api/annotations/${excerpt.annotationId}`, { method: "DELETE" }).catch(() => {});
        setAnnotations((prev) => prev.filter((a) => a.id !== excerpt.annotationId));
      }
    },
    [excerpts, removeExcerpt]
  );

  // Open SourcePullView to re-edit an existing excerpt
  const handleEditExcerpt = useCallback(
    (excerptId: string) => {
      const excerpt = excerpts.find((e) => e.id === excerptId);
      if (!excerpt) return;
      // If linked to an annotation, use it (includes sourceRef for auto-fetch)
      const ann = excerpt.annotationId
        ? annotations.find((a) => a.id === excerpt.annotationId)
        : undefined;
      setSourcePullContext({
        text: excerpt.text.replace(/<[^>]+>/g, "").slice(0, 300),
        sourceKey: excerpt.sourceKey,
        sectionIndex: excerpt.sectionIndex,
        annotation: ann,
        preloadRef: ann ? undefined : excerpt.sourceRef,
        excerptId,
      });
    },
    [excerpts, annotations]
  );

  // Sidebar "view" — show the excerpt exactly as it was pulled into the
  // document (its own text + commentaries), in a read-only popup.
  const handleViewOrigin = useCallback(
    (excerptId: string) => {
      const excerpt = excerpts.find((e) => e.id === excerptId);
      if (!excerpt) return;
      setViewModal({
        title: excerpt.sourceLabel,
        html: excerpt.text,
        commentaries: excerpt.commentaries,
        note: excerpt.note,
        onEdit: () => { setViewModal(null); handleEditExcerpt(excerptId); },
      });
    },
    [excerpts, handleEditExcerpt]
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
      const panelSnippet = sourcePullContext?.text ?? "";
      const panelSectionIndex = sourcePullContext?.sectionIndex ?? null;
      const existingAnnotation = sourcePullContext?.annotation;
      const editingExcerptId = sourcePullContext?.excerptId;

      if (editingExcerptId) {
        // Re-editing an existing excerpt — update in place
        updateExcerptFields(editingExcerptId, {
          text: params.text,
          sourceLabel: params.sourceLabel,
          sourceRef: params.sourceRef,
          commentaries: params.commentaries,
          sectionIndex: panelSectionIndex ?? undefined,
        });
        // Also PATCH the linked annotation if there is one
        if (existingAnnotation) {
          fetch(`/api/annotations/${existingAnnotation.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: params.text,
              sourceLabel: params.sourceLabel,
              sourceRef: params.sourceRef ?? null,
              commentaries: params.commentaries ?? [],
            }),
          })
            .then((r) => r.json())
            .then((data: { annotation?: Annotation }) => {
              if (data.annotation) {
                setAnnotations((prev) =>
                  prev.map((a) => (a.id === existingAnnotation.id ? data.annotation! : a))
                );
              }
            })
            .catch(() => {});
        }
      } else if (existingAnnotation) {
        // From mark click — if the excerpt was deleted (race condition or explicit remove),
        // re-add it so the source reappears in the sidebar.
        const linkedExcerpt = excerpts.find((e) => e.annotationId === existingAnnotation.id);
        if (!linkedExcerpt) {
          const newId = crypto.randomUUID();
          addExcerpt({
            id: newId,
            sourceKey: params.sourceKey,
            sourceLabel: params.sourceLabel,
            text: params.text,
            sourceRef: params.sourceRef,
            commentaries: params.commentaries,
            sectionIndex: panelSectionIndex ?? undefined,
          });
          setExcerptAnnotationId(newId, existingAnnotation.id);
        }
        // PATCH the annotation regardless
        fetch(`/api/annotations/${existingAnnotation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: params.text,
            sourceLabel: params.sourceLabel,
            highlightText: panelSnippet ? decodeHtml(panelSnippet.replace(/<[^>]+>/g, "")) : null,
            sectionIndex: panelSectionIndex,
            sectionHtml: sourcePullContext?.sectionHtml ?? null,
            sourceRef: params.sourceRef ?? null,
            commentaries: params.commentaries ?? [],
          }),
        })
          .then((r) => r.json())
          .then((data: { annotation?: Annotation }) => {
            if (data.annotation) {
              setAnnotations((prev) =>
                prev.map((a) => (a.id === existingAnnotation.id ? data.annotation! : a))
              );
            }
          })
          .catch(() => {});
      } else {
        // New annotation — pre-generate ID so we can link excerpt ↔ annotation
        const excerptId = crypto.randomUUID();
        addExcerpt({
          id: excerptId,
          sourceKey: params.sourceKey,
          sourceLabel: params.sourceLabel,
          text: params.text,
          sourceRef: params.sourceRef,
          commentaries: params.commentaries,
          sectionIndex: panelSectionIndex ?? undefined,
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
            // highlightText = the panel snippet the user originally selected,
            // NOT params.text (the pulled Sefaria source, which can't match panel HTML).
            highlightText: panelSnippet ? decodeHtml(panelSnippet.replace(/<[^>]+>/g, "")) : null,
            sectionIndex: panelSectionIndex,
            sectionHtml: sourcePullContext?.sectionHtml ?? null,
            sourceRef: params.sourceRef ?? null,
            commentaries: params.commentaries ?? [],
            userName: currentUser,
          }),
        })
          .then((r) => r.json())
          .then((data: { annotation?: Annotation }) => {
            if (data.annotation) {
              setAnnotations((prev) => [...prev, data.annotation!]);
              setExcerptAnnotationId(excerptId, data.annotation.id);
            }
          })
          .catch(() => {});
      }
      setSourcePullContext(null);
    },
    [addExcerpt, updateExcerptFields, setExcerptAnnotationId, excerpts, chelek, number, currentUser, sourcePullContext]
  );

  // Click on a highlighted <mark> → open a read-only view popup showing the
  // source as it was actually pulled into the document (edit is one more
  // deliberate click away, via the popup's "ערוך מקור" button).
  const handleMarkClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const mark = target.closest("mark[data-annotation-id]");
      if (!mark) return;
      const annId = mark.getAttribute("data-annotation-id");
      if (!annId) return;
      const ann = annotations.find((a) => a.id === annId);
      if (!ann) return;
      const linkedExcerpt = excerpts.find((ex) => ex.annotationId === annId);
      setViewModal({
        title: linkedExcerpt?.sourceLabel ?? ann.sourceLabel,
        html: linkedExcerpt?.text ?? ann.text ?? ann.highlightText ?? "",
        commentaries: linkedExcerpt?.commentaries ?? ann.commentaries,
        note: linkedExcerpt?.note,
        onEdit: () => {
          setViewModal(null);
          setSourcePullContext({
            text: ann.highlightText ?? "",
            sourceKey: ann.sourceKey,
            sectionIndex: ann.sectionIndex ?? undefined,
            sectionHtml: ann.sectionHtml ?? undefined,
            annotation: ann,
          });
        },
      });
    },
    [annotations, excerpts]
  );

  // Section label clicked in SA panel → open heading dialog
  const handleSectionClick = useCallback(
    (_sourceKey: string, sectionIndex: number, _label: string) => {
      const seifLabel = `סעיף ${toHebrewNumeral(sectionIndex + 1)}`;
      setHeadingDialog({ text: seifLabel, align: "right", level: 2 });
    },
    []
  );

  function submitHeadingDialog() {
    if (!headingDialog?.text.trim()) return;
    addHeading(null, headingDialog.text.trim(), headingDialog.align, headingDialog.level);
    setHeadingDialog(null);
  }

  const simanLabel = toHebrewNumeral(parseInt(number));
  const chelekLabel = CHELEK_LABELS[chelek] ?? chelek;
  const topic = getSimanTopic(chelek, parseInt(number));

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" dir="rtl">
      {/* Sidebar — appears on RIGHT in RTL */}
      <SourceDocSidebar
        excerpts={excerpts}
        chelek={chelek}
        siman={number}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onRemove={handleRemoveExcerpt}
        onEdit={handleEditExcerpt}
        onViewOrigin={handleViewOrigin}
        onReorder={reorderExcerpts}
        onAddAnnotation={addAnnotation}
        onAddHeading={addHeading}
        onUpdateHeading={updateHeading}
        onUpdateText={updateExcerptText}
        onAddManual={handleAddManual}
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
          <div className="flex-1 text-center flex items-center justify-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800">{chelekLabel}</span>
            <span className="text-gray-300">·</span>
            {topic && (
              <>
                <button
                  onClick={() => setHeadingDialog({ text: topic, align: "center", level: 1 })}
                  className="text-gray-600 hover:text-purple-700 hover:underline transition text-sm"
                  title="הוסף ככותרת"
                >
                  {topic}
                </button>
                <span className="text-gray-300">·</span>
              </>
            )}
            <button
              onClick={() => setHeadingDialog({ text: `סימן ${simanLabel}`, align: "center", level: 2 })}
              className="text-gray-600 hover:text-purple-700 hover:underline transition text-sm"
              title="הוסף ככותרת"
            >
              סימן {simanLabel}
            </button>
          </div>
          <div className="w-20 flex items-center justify-end gap-2">
            <span className="text-xs text-gray-400">
              {saveState === "saving" ? "שומר..." : saveState === "saved" ? "נשמר" : ""}
            </span>
            <GroupSimanBanner chelek={chelek} simanNumber={parseInt(number, 10)} />
          </div>
        </div>

        {/* Heading dialog — inline panel below header */}
        {headingDialog && (
          <div className="bg-purple-50 border-b border-purple-200 px-6 py-2 flex items-center gap-3 flex-shrink-0" dir="rtl">
            <span className="text-xs text-purple-700 font-semibold flex-shrink-0">הוסף ככותרת:</span>
            <input
              autoFocus
              type="text"
              value={headingDialog.text}
              onChange={(e) => setHeadingDialog({ ...headingDialog, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); submitHeadingDialog(); }
                if (e.key === "Escape") setHeadingDialog(null);
              }}
              className="border border-purple-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 w-44"
            />
            <HeadingToolbar
              align={headingDialog.align}
              level={headingDialog.level}
              onAlignChange={(a) => setHeadingDialog({ ...headingDialog, align: a })}
              onLevelChange={(l) => setHeadingDialog({ ...headingDialog, level: l })}
            />
            <button onClick={submitHeadingDialog} className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">הוסף</button>
            <button onClick={() => setHeadingDialog(null)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100">ביטול</button>
          </div>
        )}

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
            {texts && !loading && (() => {
              const relevantKeys = CHELEK_PANEL_KEYS[chelek] ?? SOURCE_ORDER.map((s) => s.key);
              const orderedPanels = panelPrefs.order
                .filter((key) => relevantKeys.includes(key))
                .map((key) => SOURCE_ORDER.find((s) => s.key === key))
                .filter((s): s is (typeof SOURCE_ORDER)[number] => !!s);

              return (
                <div>
                  {orderedPanels.map(({ key, title }, idx) => {
                    const hex = getHex(key);
                    const expanded = expandedPanels[key] === true;
                    const heightPx = panelPrefs.heights[key] ?? DEFAULT_PANEL_HEIGHT;

                    const panelNode = key === "tur" ? (
                      <TextPanel
                        title={title}
                        hexColor={hex}
                        sourceKey={key}
                        expanded={expanded}
                        onToggle={() => togglePanel(key)}
                        html={texts.tur?.text ?? ""}
                        annotations={annotations.filter((a) => a.sourceKey === key)}
                        currentUser={currentUser}
                        heightPx={heightPx}
                        onHeightChange={(px) => panelPrefs.setHeight(key, px)}
                      />
                    ) : (() => {
                      const data = (texts as Record<string, { ref: string; text: string[] } | null>)[key];
                      const sections = data ? buildSections(key, data.text) : undefined;
                      return (
                        <TextPanel
                          title={title}
                          hexColor={hex}
                          sourceKey={key}
                          expanded={expanded}
                          onToggle={() => togglePanel(key)}
                          sections={sections}
                          annotations={annotations.filter((a) => a.sourceKey === key)}
                          currentUser={currentUser}
                          onSectionClick={key === "shulchanArukh" ? handleSectionClick : undefined}
                          heightPx={heightPx}
                          onHeightChange={(px) => panelPrefs.setHeight(key, px)}
                        />
                      );
                    })();

                    return (
                      <div
                        key={key}
                        draggable
                        onDragStart={(e) => {
                          panelDragKey.current = key;
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", key);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const mid = rect.top + rect.height / 2;
                          updatePanelDropTarget(e.clientY < mid ? idx : idx + 1);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromKey = e.dataTransfer.getData("text/plain") || panelDragKey.current;
                          const to = panelDropTargetRef.current;
                          updatePanelDropTarget(null);
                          panelDragKey.current = null;
                          if (fromKey && to !== null) {
                            const fromIdx = orderedPanels.findIndex((p) => p.key === fromKey);
                            const insertAt = to > fromIdx ? to - 1 : to;
                            if (fromIdx !== insertAt) panelPrefs.reorder(fromKey, insertAt);
                          }
                        }}
                        onDragEnd={() => { updatePanelDropTarget(null); panelDragKey.current = null; }}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        {panelDropTarget === idx && panelDragKey.current !== key && (
                          <div className="h-0.5 bg-blue-500 rounded-full mb-1 shadow-sm" />
                        )}
                        {panelNode}
                        {idx === orderedPanels.length - 1 && panelDropTarget === orderedPanels.length && (
                          <div className="h-0.5 bg-blue-500 rounded-full mt-1 shadow-sm" />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Sefaria attribution */}
        <div className="flex-shrink-0 px-4 py-1.5 border-t border-gray-100 bg-gray-50 flex justify-end">
          <a
            href="https://www.sefaria.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            מבוסס על נתוני{" "}
            <span className="font-medium text-teal-600 hover:text-teal-700">ספריא</span>
          </a>
        </div>
      </div>

      {/* Global floating add button — hidden while source pull is active */}
      {!sourcePullContext && (
        <SelectionPopover
          onAdd={handleAdd}
          onDefineSource={handleDefineSource}
          texts={texts}
        />
      )}

      {viewModal && (
        <SourceViewModal
          title={viewModal.title}
          html={viewModal.html}
          commentaries={viewModal.commentaries}
          note={viewModal.note}
          onEdit={viewModal.onEdit}
          onClose={() => setViewModal(null)}
        />
      )}
    </div>
  );
}
