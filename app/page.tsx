"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fromHebrewNumeral } from "@/lib/hebrewNumerals";
import type { Collection } from "@/lib/types";

const CHELAKOT = [
  { value: "OrachChayim",    label: "אורח חיים",    abbr: "א״ח" },
  { value: "YorehDeah",      label: "יורה דעה",     abbr: "י״ד" },
  { value: "EvenHaEzer",     label: "אבן העזר",     abbr: "א״ה" },
  { value: "ChoshenMishpat", label: "חושן משפט",   abbr: "ח״מ" },
];

const MODE_ICONS: Record<string, string> = { topic: "🗂", quantity: "📊", free: "✍️" };

export default function HomePage() {
  const router = useRouter();
  const [chelek, setChelek] = useState("OrachChayim");
  const [siman, setSiman] = useState("");
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<Collection[]>([]);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.ok ? r.json() as Promise<Collection[]> : Promise.resolve([]))
      .then((data) => setRecent(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => {});
  }, []);

  function navigate(ch: string, si: string) {
    const num = fromHebrewNumeral(si) ?? parseInt(si, 10);
    if (!num || isNaN(num) || num < 1) {
      setError("נא להכניס מספר סימן תקין (לדוגמה: 25 או כה׳)");
      return;
    }
    router.push(`/siman/${ch}/${num}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(chelek, siman);
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-leket-cream flex flex-col" dir="rtl">

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">

        {/* Brand */}
        <div className="mb-8">
          <h1 className="text-7xl font-bold text-leket-navy leading-none tracking-tight mb-3">
            לקט
          </h1>
          <hr className="gold-rule w-48 mx-auto mb-4" />
          <p className="text-leket-muted text-base font-normal">
            מלקט ומארגן מקורות הלכה
          </p>
        </div>

        <div className="w-full max-w-xl flex flex-col gap-8">

          {/* Search card */}
          <div className="leket-card px-8 py-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-right">
                  <label className="block text-xs font-medium text-leket-muted mb-1.5">חלק</label>
                  <select value={chelek} onChange={(e) => setChelek(e.target.value)} className="leket-input text-sm">
                    {CHELAKOT.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="text-right">
                  <label className="block text-xs font-medium text-leket-muted mb-1.5">סימן</label>
                  <input
                    type="text"
                    value={siman}
                    onChange={(e) => { setSiman(e.target.value); setError(""); }}
                    placeholder="25 או כה׳"
                    className="leket-input text-sm"
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-xs text-right">{error}</p>}
              <button type="submit" className="leket-btn-primary w-full">פתח מקורות</button>
            </form>
          </div>

          {/* Recent collections */}
          {recent.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Link href="/collections" className="text-xs text-leket-gold hover:underline">הצג הכל ←</Link>
                <h2 className="text-sm font-semibold text-leket-muted">קבצי לימוד אחרונים</h2>
              </div>
              <div className="space-y-2">
                {recent.map((c) => (
                  <Link
                    key={c.id}
                    href={`/collections/${c.id}`}
                    className="leket-card px-4 py-3 flex items-center justify-between hover:shadow-md transition-shadow no-underline"
                  >
                    <span className="text-xs text-leket-muted">
                      {MODE_ICONS[c.orgMode]} {new Date(c.updatedAt).toLocaleDateString("he-IL")}
                    </span>
                    <span className="text-sm font-semibold text-leket-navy">{c.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {recent.length === 0 && (
            <div className="text-center">
              <Link
                href="/collections/new"
                className="inline-flex items-center gap-2 text-sm text-leket-muted hover:text-leket-navy border border-leket-border rounded-xl px-5 py-3 bg-white transition-colors no-underline"
              >
                <span>📚</span>
                <span>צור קובץ לימוד ראשון</span>
              </Link>
            </div>
          )}
        </div>
      </section>

      <footer className="no-print py-4 text-center text-xs text-leket-muted border-t border-leket-border">
        לקט מקורות הלכה
      </footer>
    </main>
  );
}
