"use client";

import { useRef, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "../store";
import { toHebrewNumeral } from "@/lib/hebrewNumerals";
import type { Excerpt } from "@/lib/types";
import { downloadExport } from "@/lib/downloadExport";
import { groupExcerpts } from "@/lib/groupExcerpts";
import SourceViewModal from "@/components/SourceViewModal";

type AgentSummary = { id: string; name: string };

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim: "אורח חיים",
  YorehDeah: "יורה דעה",
  EvenHaEzer: "אבן העזר",
  ChoshenMishpat: "חושן משפט",
};

function ExcerptItem({ ex, num, nested, onView }: { ex: Excerpt; num: number; nested?: boolean; onView?: (ex: Excerpt) => void }) {
  const itemType = ex.type ?? "source";

  if (itemType === "heading") {
    const align = ex.headingAlign ?? "right";
    const level = ex.headingLevel ?? 2;
    const textAlign = align === "right" ? "right" : align === "center" ? "center" : "left";
    const sizeClass = level === 1 ? "text-2xl font-bold" : level === 2 ? "text-lg font-bold" : "text-base font-semibold";
    return (
      <div className="py-1">
        <p className={sizeClass} style={{ textAlign, direction: "rtl" }}>{ex.text}</p>
      </div>
    );
  }

  if (itemType === "explanation") {
    return (
      <div className="border-r-4 border-green-400 pr-4 py-1">
        <p className="text-sm leading-loose text-gray-700 italic">
          <span className="font-semibold not-italic text-green-700">הסבר: </span>
          {ex.text}
        </p>
      </div>
    );
  }

  if (itemType === "question") {
    return (
      <div className="border-r-4 border-amber-400 pr-4 py-1">
        <p className="text-sm leading-loose text-gray-800 font-semibold">
          <span className="text-amber-700">שאלה: </span>
          {ex.text}
        </p>
      </div>
    );
  }

  if (itemType === "answer") {
    return (
      <div className="border-r-4 border-teal-400 pr-4 py-1 mr-6">
        <p className="text-sm leading-loose text-gray-700">
          <span className="font-semibold text-teal-700">תשובה: </span>
          {ex.text}
        </p>
      </div>
    );
  }

  if (itemType === "image") {
    return (
      <div className="py-1">
        {ex.imageData && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ex.imageData} alt={ex.sourceLabel} className="max-w-full rounded border border-gray-200" />
        )}
        {ex.sourceLabel && ex.sourceLabel !== "תמונה" && (
          <p className="text-xs text-gray-500 mt-1 text-center">{ex.sourceLabel}</p>
        )}
      </div>
    );
  }

  if (itemType === "agentPoint") {
    return (
      <div className="border-r-4 border-indigo-400 bg-indigo-50/40 rounded pr-4 py-2">
        <p className="text-sm leading-loose text-gray-800">
          <span className="ml-1">🤖</span>{ex.text}
        </p>
      </div>
    );
  }

  // source (default)
  return (
    <div
      className={`${nested ? "border-b border-dashed border-amber-200 pb-4 last:border-0 last:pb-0" : "border-b border-gray-100 pb-6 last:border-0"} ${onView ? "cursor-pointer hover:bg-amber-50/40 rounded transition -mx-2 px-2" : ""}`}
      onClick={onView ? () => onView(ex) : undefined}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-gray-400">{num}.</span>
        <span className="text-sm font-bold text-gray-800">{ex.sourceLabel}</span>
      </div>
      <p
        className="text-sm leading-loose text-gray-800"
        dangerouslySetInnerHTML={{ __html: ex.text }}
      />
      {ex.note && (
        <p className="text-xs text-gray-500 mt-2 italic">{ex.note}</p>
      )}
      {ex.commentaries && ex.commentaries.length > 0 && (
        <div className="mt-3 pr-3 border-r-2 border-amber-200 space-y-2">
          {ex.commentaries.map((c) => (
            <div key={c.ref}>
              {!ex.sourceLabel.includes(c.heRef) && (
                <p className="text-xs font-semibold text-amber-800 mb-0.5">{c.heRef}</p>
              )}
              <div className="text-xs text-gray-600 space-y-0.5">
                {c.text.split("\n").filter(Boolean).map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const chelek = params.chelek as string;
  const number = params.number as string;
  const { excerpts } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [runError, setRunError] = useState("");
  const [viewingExcerpt, setViewingExcerpt] = useState<Excerpt | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((data: { agents?: AgentSummary[] }) => setAgents(data.agents ?? []))
      .catch(() => {/* silent */});
  }, []);

  async function handleRunAgent(agentId: string) {
    setRunningAgentId(agentId);
    setRunError("");
    try {
      const res = await fetch(`/api/agents/${agentId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chelek, siman: number }),
      });
      const data = await res.json() as { document?: { excerpts: Excerpt[]; expandedPanels: Record<string, boolean> }; error?: string };
      if (!res.ok || !data.document) {
        setRunError(data.error || "הרצת הסוכן נכשלה");
        return;
      }
      useStore.getState().loadDocument(data.document.excerpts, data.document.expandedPanels);
    } catch {
      setRunError("הרצת הסוכן נכשלה");
    } finally {
      setRunningAgentId(null);
    }
  }

  function handleSaveTxt() {
    const lines: string[] = [
      `דף מקורות הלכתי — ${CHELEK_LABELS[chelek] ?? chelek} סימן ${toHebrewNumeral(parseInt(number))}`,
      "=".repeat(50),
      "",
    ];
    let sourceCounter = 0;
    for (let i = 0; i < excerpts.length; i++) {
      const ex = excerpts[i];
      const itemType = ex.type ?? "source";
      if (itemType === "heading") {
        lines.push(`--- ${ex.text} ---`);
      } else if (itemType === "source") {
        sourceCounter++;
        lines.push(`[${sourceCounter}] ${ex.sourceLabel}`);
        lines.push(ex.text.replace(/<[^>]+>/g, ""));
        if (ex.note) lines.push(`הערה: ${ex.note}`);
        if (ex.commentaries) {
          for (const c of ex.commentaries) {
            lines.push(`  [${c.heRef}] ${c.text.replace(/\n/g, " ")}`);
          }
        }
      } else if (itemType === "explanation") {
        lines.push(`הסבר: ${ex.text}`);
      } else if (itemType === "question") {
        lines.push(`שאלה: ${ex.text}`);
      } else if (itemType === "answer") {
        lines.push(`  תשובה: ${ex.text}`);
      } else if (itemType === "image") {
        lines.push(`[תמונה${ex.sourceLabel && ex.sourceLabel !== "תמונה" ? `: ${ex.sourceLabel}` : ""}]`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chelek}-${number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJson() {
    const { excerpts, expandedPanels } = useStore.getState();
    const payload = JSON.stringify({ chelek, siman: number, excerpts, expandedPanels }, null, 2);
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chelek}-${number}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as {
          excerpts?: Excerpt[];
          expandedPanels?: Record<string, boolean>;
        };
        const importedExcerpts = parsed.excerpts ?? [];
        const importedPanels = parsed.expandedPanels ?? {};
        useStore.getState().loadDocument(importedExcerpts, importedPanels);
        // Save immediately so the import isn't silently overwritten later by
        // the editing page's autosave hook re-fetching the (now stale) server copy.
        fetch("/api/documents", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chelek, siman: number, excerpts: importedExcerpts, expandedPanels: importedPanels }),
        }).catch(() => {});
      } catch {
        alert("קובץ לא תקין");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Toolbar */}
      <div className="no-print bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => router.push(`/siman/${chelek}/${number}`)}
          className="text-gray-600 hover:text-gray-800 text-sm"
        >
          ← חזרה
        </button>
        <div className="flex-1" />
        <button
          onClick={handleExportJson}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
        >
          ייצוא גיבוי
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
        >
          ייבוא גיבוי
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportJsonFile}
          className="hidden"
        />
        <button
          onClick={handleSaveTxt}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
        >
          שמור TXT
        </button>
        <button
          onClick={() => downloadExport("pdf", [{ chelek, siman: number }], `${chelek}-${number}.pdf`)}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
        >
          הורד PDF
        </button>
        <button
          onClick={() => downloadExport("docx", [{ chelek, siman: number }], `${chelek}-${number}.docx`)}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
        >
          הורד Word
        </button>
        <button
          onClick={() => window.print()}
          className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          הדפס
        </button>
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => handleRunAgent(agent.id)}
            disabled={runningAgentId !== null}
            className="text-sm px-3 py-1.5 border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50 disabled:opacity-50 whitespace-nowrap"
          >
            {runningAgentId === agent.id ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="animate-spin inline-block">⏳</span> מריץ...
              </span>
            ) : (
              <>🤖 הרץ: {agent.name}</>
            )}
          </button>
        ))}
      </div>

      {runError && (
        <div className="no-print bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-700">
          {runError}
        </div>
      )}

      {/* Document body */}
      <div className="max-w-2xl mx-auto px-8 py-12">
        <h1 className="text-2xl font-bold text-center mb-1">דף מקורות הלכתי</h1>
        <h2 className="text-lg text-center text-gray-600 mb-1">
          {CHELEK_LABELS[chelek] ?? chelek}
        </h2>
        <h3 className="text-base text-center text-gray-500 mb-10">
          סימן {toHebrewNumeral(parseInt(number))}
        </h3>

        {excerpts.length === 0 ? (
          <p className="text-center text-gray-400">לא נבחרו מקורות</p>
        ) : (
          <div className="space-y-6">
            {(() => {
              let counter = 0;
              return groupExcerpts(excerpts).map((block) => {
                if (block.kind === "single") {
                  const isSource = (block.item.type ?? "source") === "source";
                  if (isSource) counter++;
                  return <ExcerptItem key={block.item.id} ex={block.item} num={counter} onView={isSource ? setViewingExcerpt : undefined} />;
                }
                return (
                  <div key={block.items[0].id} className="border border-amber-200 bg-amber-50/50 rounded-lg p-4 space-y-4">
                    <p className="text-sm font-bold text-amber-800">{block.heading}</p>
                    {block.items.map((ex) => {
                      counter++;
                      return <ExcerptItem key={ex.id} ex={ex} num={counter} nested onView={setViewingExcerpt} />;
                    })}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {viewingExcerpt && (
        <SourceViewModal
          title={viewingExcerpt.sourceLabel}
          html={viewingExcerpt.text}
          commentaries={viewingExcerpt.commentaries}
          note={viewingExcerpt.note}
          onClose={() => setViewingExcerpt(null)}
        />
      )}
    </div>
  );
}
