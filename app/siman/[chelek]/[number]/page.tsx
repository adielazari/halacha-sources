"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "./store";
import type { CommentaryEntry } from "@/lib/types";
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
import FontSettingsPanel from "@/components/FontSettingsPanel";
import { useDocumentAutosave } from "./useDocumentAutosave";
import type { ManualEntryPayload } from "@/components/AddManualSourceModal";
import SourceViewModal from "@/components/SourceViewModal";
import { usePanelPrefs, DEFAULT_PANEL_HEIGHT } from "@/lib/panelPrefs";
import type { HalachicBlock } from "@/lib/sefaria";
import HalachicBlockView from "@/components/HalachicBlockView";

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
  seifBlocks: HalachicBlock[];
};

export type SourcePullContext = {
  text: string;          // the selected commentator text snippet
  sourceKey: string;     // which commentator panel it came from
  sectionIndex?: number;
  sectionHtml?: string;  // full section HTML for the collapsible reference view
  sectionLabel?: string; // label of that section e.g. "ב"י ס"ק ג׳"
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
    viewMode,
    setViewMode,
    addExcerpt,
    removeExcerpt,
    reorderExcerpts,
    addAnnotation,
    addHeading,
    updateHeading,
    updateExcerptText,
    togglePanel,
    setSession,
    updateExcerptFields,
    reset,
  } = useStore();
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewModal, setViewModal] = useState<ViewModalState>(null);

  useEffect(() => {
    setSession(chelek, number);
  }, [chelek, number, setSession]);

  const saveState = useDocumentAutosave(chelek, number);

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
      linkedSeif?: number;
    }) => {
      // Direct "הוסף לדף" — the selected panel text is both the excerpt and
      // what the panel highlights (see lib/highlightSources.ts).
      addExcerpt({
        sourceKey: params.sourceKey,
        sourceLabel: params.sourceLabel,
        text: params.text,
        sectionIndex: params.sectionIndex,
        note: params.note,
        linkedSeif: params.linkedSeif,
        highlightText: params.text,
      });
    },
    [addExcerpt]
  );

  // Clicking a Beit Yosef paragraph's own letter-label to pick its SA se'if —
  // there's no reliable automatic mapping (unlike the mefarshim in
  // HalachicBlock), so this is how the user builds it by hand as they study.
  // Works on any paragraph, not just ones already pulled into the document.
  const handleLinkBeitYosefSeif = useCallback(
    (sectionIndex: number, seif: number | undefined) => {
      const existing = excerpts.find((e) => e.sourceKey === "beitYosef" && e.sectionIndex === sectionIndex);
      if (existing) {
        updateExcerptFields(existing.id, { linkedSeif: seif });
        return;
      }
      const html = texts?.beitYosef?.text[sectionIndex];
      if (!html) return;
      // Just tags the paragraph — unlike handleAdd (used for an actual
      // "select this text and pull it out" action), no highlightText, so the
      // panel doesn't highlight it.
      // Linking a se'if is an organizing action, not a "this text matters"
      // one.
      addExcerpt({
        id: crypto.randomUUID(),
        sourceKey: "beitYosef",
        sectionIndex,
        text: html,
        sourceLabel: buildSourceLabel("beitYosef", sectionIndex),
        linkedSeif: seif,
      });
    },
    [excerpts, texts, updateExcerptFields, addExcerpt]
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

  // Removing an excerpt also removes its panel highlight — both live on the excerpt.
  const handleRemoveExcerpt = removeExcerpt;

  // Open SourcePullView to re-edit an existing excerpt
  const handleEditExcerpt = useCallback(
    (excerptId: string) => {
      const excerpt = excerpts.find((e) => e.id === excerptId);
      if (!excerpt) return;
      setSourcePullContext({
        // The highlighted mention (e.g. "נדרים (י.)") detects the source
        // better than the pulled text itself.
        text: excerpt.highlightText ?? excerpt.text.replace(/<[^>]+>/g, "").slice(0, 300),
        sourceKey: excerpt.sourceKey,
        sectionIndex: excerpt.sectionIndex,
        preloadRef: excerpt.sourceRef,
        excerptId,
      });
    },
    [excerpts]
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
      const panelSectionIndex = sourcePullContext?.sectionIndex;
      const editingExcerptId = sourcePullContext?.excerptId;

      if (editingExcerptId) {
        // Re-editing an existing excerpt — update in place, its highlight stays.
        updateExcerptFields(editingExcerptId, {
          text: params.text,
          sourceLabel: params.sourceLabel,
          sourceRef: params.sourceRef,
          commentaries: params.commentaries,
          sectionIndex: panelSectionIndex,
        });
      } else {
        addExcerpt({
          sourceKey: params.sourceKey,
          sourceLabel: params.sourceLabel,
          text: params.text,
          sourceRef: params.sourceRef,
          commentaries: params.commentaries,
          sectionIndex: panelSectionIndex,
          // The panel snippet the user originally selected — NOT params.text
          // (the pulled Sefaria source, which can't match the panel HTML).
          highlightText: panelSnippet ? decodeHtml(panelSnippet.replace(/<[^>]+>/g, "")) : undefined,
        });
      }
      setSourcePullContext(null);
    },
    [addExcerpt, updateExcerptFields, sourcePullContext]
  );

  // Click on a highlighted <mark> → open a read-only view popup showing the
  // source as it was actually pulled into the document (edit is one more
  // deliberate click away, via the popup's "ערוך מקור" button).
  const handleMarkClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const mark = target.closest("mark[data-excerpt-id]");
      const excerptId = mark?.getAttribute("data-excerpt-id");
      if (excerptId) handleViewOrigin(excerptId);
    },
    [handleViewOrigin]
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
        onSetLinkedSeif={(id, seif) => updateExcerptFields(id, { linkedSeif: seif })}
        onToggleHidden={(id, hidden) => updateExcerptFields(id, { hidden })}
        maxSeif={texts?.shulchanArukh?.text.length}
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
            <FontSettingsPanel />
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
            {texts && !loading && (
              <div className="flex items-center gap-3 mb-3 text-sm">
                <button
                  onClick={() => setViewMode("panels")}
                  className={viewMode === "panels" ? "font-bold text-gray-900" : "text-gray-400 hover:text-gray-600"}
                >
                  כל המקורות
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setViewMode("seifim")}
                  className={viewMode === "seifim" ? "font-bold text-gray-900" : "text-gray-400 hover:text-gray-600"}
                >
                  לפי סעיפי שו״ע
                </button>
              </div>
            )}

            {viewMode === "seifim" && texts && !loading && (
              <HalachicBlockView chelek={chelek} siman={number} blocks={texts.seifBlocks} linkedExcerpts={excerpts} />
            )}

            {viewMode === "panels" && texts && !loading && (() => {
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
                        highlights={excerpts}
                        heightPx={heightPx}
                        onHeightChange={(px) => panelPrefs.setHeight(key, px)}
                        draggable
                      />
                    ) : (() => {
                      const data = (texts as unknown as Record<string, { ref: string; text: string[] } | null>)[key];
                      const sections = data ? buildSections(key, data.text) : undefined;
                      const isBeitYosef = key === "beitYosef";
                      const linkedSeifBySection = isBeitYosef
                        ? Object.fromEntries(
                            excerpts
                              .filter((e) => e.sourceKey === "beitYosef" && e.sectionIndex !== undefined && e.linkedSeif !== undefined)
                              .map((e) => [e.sectionIndex as number, e.linkedSeif as number])
                          )
                        : undefined;
                      return (
                        <TextPanel
                          title={title}
                          hexColor={hex}
                          sourceKey={key}
                          expanded={expanded}
                          onToggle={() => togglePanel(key)}
                          sections={sections}
                          highlights={excerpts}
                          onSectionClick={key === "shulchanArukh" ? handleSectionClick : undefined}
                          maxSeif={isBeitYosef ? texts?.shulchanArukh?.text.length : undefined}
                          linkedSeifBySection={linkedSeifBySection}
                          onLinkSeif={isBeitYosef ? handleLinkBeitYosefSeif : undefined}
                          heightPx={heightPx}
                          onHeightChange={(px) => panelPrefs.setHeight(key, px)}
                          draggable
                        />
                      );
                    })();

                    return (
                      <div
                        key={key}
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
                        className="select-text"
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
