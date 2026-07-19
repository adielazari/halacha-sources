"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrgMode } from "@/lib/types";
import { getTopicsForChelek, getSimansByTopic } from "@/lib/simanTopics";

const CHELAKOT = [
  { value: "OrachChayim",    label: "אורח חיים",   abbr: "א״ח" },
  { value: "YorehDeah",      label: "יורה דעה",    abbr: "י״ד" },
  { value: "EvenHaEzer",     label: "אבן העזר",    abbr: "א״ה" },
  { value: "ChoshenMishpat", label: "חושן משפט",  abbr: "ח״מ" },
];

const MODES: { value: OrgMode; title: string; desc: string; icon: string }[] = [
  { value: "topic", title: "לפי נושא",     icon: "🗂",  desc: "בחר קטגוריה — הסימנים הרלוונטיים מופיעים אוטומטית" },
  { value: "free",  title: "בחירה חופשית", icon: "✍️",  desc: "בחר סימנים ידנית כרצונך" },
];

export default function NewCollectionPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<OrgMode>("free");
  const [chelek, setChelek] = useState("OrachChayim");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topics = getTopicsForChelek(chelek).map((t) => t.topic);

  async function handleCreate() {
    if (!name.trim()) { setError("נא להכניס שם לקובץ"); return; }
    if (mode === "topic" && !topic) { setError("נא לבחור נושא"); return; }

    setLoading(true); setError("");

    const body: Record<string, unknown> = { name: name.trim(), orgMode: mode };
    if (mode !== "free") body.chelek = chelek;
    if (mode === "topic") body.topic = topic;

    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { id?: string; error?: string };
    if (!res.ok || !data.id) { setError(data.error ?? "שגיאה ביצירה"); setLoading(false); return; }

    // For topic mode: auto-add simanim
    if (mode === "topic" && topic) {
      const nums = getSimansByTopic(chelek, topic);
      await fetch(`/api/collections/${data.id}/simanim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simanim: nums.map((n) => ({ chelek, simanNumber: n })) }),
      });
    }

    router.push(`/collections/${data.id}`);
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-leket-cream flex items-center justify-center px-4 py-10" dir="rtl">
      <div className="w-full max-w-lg">

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-leket-navy">קובץ לימוד חדש</h1>
          <p className="text-leket-muted text-sm mt-1">שלב {step} מתוך 2</p>
        </div>

        {/* Step 1: Name + Mode */}
        {step === 1 && (
          <div className="leket-card px-8 py-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-leket-muted mb-1.5">שם הקובץ</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="leket-input"
                placeholder="לדוגמה: הלכות אבלות — חזרה"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-leket-muted mb-3">מצב ארגון</label>
              <div className="space-y-3">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={`w-full text-right px-4 py-4 rounded-xl border-2 transition-all ${
                      mode === m.value
                        ? "border-leket-navy bg-leket-navy/5"
                        : "border-leket-border bg-white hover:border-leket-navy/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{m.icon}</span>
                      <div>
                        <p className="font-semibold text-leket-navy text-sm">{m.title}</p>
                        <p className="text-xs text-leket-muted mt-0.5">{m.desc}</p>
                      </div>
                      {mode === m.value && (
                        <span className="mr-auto text-leket-navy text-lg">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={() => { if (!name.trim()) { setError("נא להכניס שם"); return; } setError(""); setStep(2); }}
              className="leket-btn-primary w-full py-3 rounded-xl font-semibold"
            >
              הבא ←
            </button>
          </div>
        )}

        {/* Step 2: Mode-specific config */}
        {step === 2 && (
          <div className="leket-card px-8 py-8 space-y-6">
            <button onClick={() => setStep(1)} className="text-sm text-leket-muted hover:text-leket-navy flex items-center gap-1">
              → חזרה
            </button>

            {mode === "free" && (
              <div className="text-center py-4">
                <p className="text-5xl mb-3">✍️</p>
                <p className="text-leket-navy font-semibold">בחירה חופשית</p>
                <p className="text-leket-muted text-sm mt-2">
                  הקובץ ייצור ריק. תוסיף סימנים בתוך הקובץ לפי הצורך.
                </p>
              </div>
            )}

            {mode === "topic" && (
              <div>
                <label className="block text-sm font-medium text-leket-muted mb-1.5">חלק</label>
                <select value={chelek} onChange={(e) => { setChelek(e.target.value); setTopic(""); }} className="leket-input">
                  {CHELAKOT.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            )}

            {mode === "topic" && (
              <div>
                <label className="block text-sm font-medium text-leket-muted mb-1.5">נושא</label>
                {topics.length === 0 ? (
                  <p className="text-leket-muted text-sm">אין נושאים מוגדרים לחלק זה</p>
                ) : (
                  <select value={topic} onChange={(e) => setTopic(e.target.value)} className="leket-input">
                    <option value="">— בחר נושא —</option>
                    {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                {topic && (
                  <p className="text-xs text-leket-muted mt-2">
                    {getSimansByTopic(chelek, topic).length} סימנים יתווספו אוטומטית
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="leket-btn-primary w-full py-3 rounded-xl font-semibold"
            >
              {loading ? "יוצר..." : "צור קובץ"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
