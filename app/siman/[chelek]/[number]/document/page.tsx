"use client";

import { useParams, useRouter } from "next/navigation";
import { useStore } from "../store";
import { toHebrewNumeral } from "@/lib/hebrewNumerals";

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim: "אורח חיים",
  YorehDeah: "יורה דעה",
  EvenHaEzer: "אבן העזר",
  ChoshenMishpat: "חושן משפט",
};

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const chelek = params.chelek as string;
  const number = params.number as string;
  const { excerpts } = useStore();

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
          onClick={handleSaveTxt}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
        >
          שמור TXT
        </button>
        <button
          onClick={() => window.print()}
          className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          הדפס
        </button>
      </div>

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
            {excerpts.map((ex, i) => {
              const itemType = ex.type ?? "source";

              if (itemType === "heading") {
                const align = ex.headingAlign ?? "right";
                const level = ex.headingLevel ?? 2;
                const textAlign = align === "right" ? "right" : align === "center" ? "center" : "left";
                const sizeClass = level === 1 ? "text-2xl font-bold" : level === 2 ? "text-lg font-bold" : "text-base font-semibold";
                return (
                  <div key={ex.id} className="py-1">
                    <p className={sizeClass} style={{ textAlign, direction: "rtl" }}>{ex.text}</p>
                  </div>
                );
              }

              if (itemType === "explanation") {
                return (
                  <div key={ex.id} className="border-r-4 border-green-400 pr-4 py-1">
                    <p className="text-sm leading-loose text-gray-700 italic">
                      <span className="font-semibold not-italic text-green-700">הסבר: </span>
                      {ex.text}
                    </p>
                  </div>
                );
              }

              if (itemType === "question") {
                return (
                  <div key={ex.id} className="border-r-4 border-amber-400 pr-4 py-1">
                    <p className="text-sm leading-loose text-gray-800 font-semibold">
                      <span className="text-amber-700">שאלה: </span>
                      {ex.text}
                    </p>
                  </div>
                );
              }

              if (itemType === "answer") {
                return (
                  <div key={ex.id} className="border-r-4 border-teal-400 pr-4 py-1 mr-6">
                    <p className="text-sm leading-loose text-gray-700">
                      <span className="font-semibold text-teal-700">תשובה: </span>
                      {ex.text}
                    </p>
                  </div>
                );
              }

              // source (default)
              return (
                <div key={ex.id} className="border-b border-gray-100 pb-6 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-gray-400">{i + 1}.</span>
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}
