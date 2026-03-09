"use client";

import { useParams, useRouter } from "next/navigation";
import { useStore } from "../store";

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const chelek = params.chelek as string;
  const number = params.number as string;
  const { approvedSources } = useStore();

  const chelekLabels: Record<string, string> = {
    OrachChayim: "אורח חיים",
    YorehDeah: "יורה דעה",
    EvenHaEzer: "אבן העזר",
    ChoshenMishpat: "חושן משפט",
  };

  function handleSaveTxt() {
    const lines: string[] = [
      `בית יוסף — ${chelekLabels[chelek] ?? chelek} סימן ${number}`,
      "=".repeat(40),
      "",
    ];
    for (let i = 0; i < approvedSources.length; i++) {
      const src = approvedSources[i];
      lines.push(`[${i + 1}] ${src.ref}`);
      lines.push(src.selectedText);
      for (const c of src.commentaries) {
        lines.push(`  ${c.heRef}: ${c.text}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beit-yosef-${chelek}-${number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveJson() {
    const data = { chelek, siman: number, sources: approvedSources };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beit-yosef-${chelek}-${number}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Toolbar — hidden in print */}
      <div className="no-print bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => router.push(`/siman/${chelek}/${number}`)}
          className="text-amber-700 hover:text-amber-900 text-sm"
        >
          → חזרה
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSaveTxt}
          className="text-sm px-3 py-1.5 border border-amber-400 rounded hover:bg-amber-100 text-amber-800"
        >
          שמור TXT
        </button>
        <button
          onClick={handleSaveJson}
          className="text-sm px-3 py-1.5 border border-amber-400 rounded hover:bg-amber-100 text-amber-800"
        >
          שמור JSON
        </button>
        <button
          onClick={() => window.print()}
          className="text-sm px-4 py-1.5 bg-amber-700 text-white rounded hover:bg-amber-800"
        >
          הדפס
        </button>
      </div>

      {/* Document body */}
      <div className="max-w-2xl mx-auto px-8 py-12">
        <h1 className="text-2xl font-bold text-center mb-1">
          בית יוסף — {chelekLabels[chelek] ?? chelek}
        </h1>
        <h2 className="text-xl text-center text-gray-600 mb-8">סימן {number}</h2>

        {approvedSources.length === 0 ? (
          <p className="text-center text-gray-400">לא נבחרו מקורות</p>
        ) : (
          <div className="space-y-8">
            {approvedSources.map((src, i) => (
              <div key={i} className="border-b border-gray-100 pb-6 last:border-0">
                <h3 className="font-bold text-amber-900 text-lg mb-2">
                  {i + 1}. {src.ref}
                </h3>
                <p className="text-sm leading-loose text-gray-800 mb-3">
                  {src.selectedText}
                </p>
                {src.commentaries.length > 0 && (
                  <div className="pr-5 border-r-4 border-amber-200 space-y-2">
                    {src.commentaries.map((c, j) => (
                      <div key={j} className="text-xs text-gray-600">
                        <span className="font-semibold text-amber-800">{c.heRef}: </span>
                        {c.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
