"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Collection } from "@/lib/types";

const MODE_LABELS: Record<string, string> = {
  topic:    "לפי נושא",
  quantity: "לפי כמות",
  free:     "בחירה חופשית",
};
const MODE_ICONS: Record<string, string> = {
  topic:    "🗂",
  quantity: "📊",
  free:     "✍️",
};

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim:    "אורח חיים",
  YorehDeah:      "יורה דעה",
  EvenHaEzer:     "אבן העזר",
  ChoshenMishpat: "חושן משפט",
};

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json() as Promise<Collection[]>)
      .then((data) => { setCollections(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את "${name}"?`)) return;
    setDeleting(id);
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-leket-cream px-4 py-10" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-leket-navy">קבצי לימוד</h1>
            <p className="text-leket-muted text-sm mt-1">ארגן מקורות מכמה סימנים לקובץ אחד</p>
          </div>
          <Link href="/collections/new" className="leket-btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold no-underline">
            + קובץ חדש
          </Link>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-leket-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && collections.length === 0 && (
          <div className="leket-card text-center py-16 px-8">
            <p className="text-5xl mb-4">📚</p>
            <p className="text-leket-navy font-semibold text-lg mb-2">אין עדיין קבצי לימוד</p>
            <p className="text-leket-muted text-sm mb-6">צור קובץ לימוד כדי לאסוף מקורות ממספר סימנים</p>
            <Link href="/collections/new" className="leket-btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold no-underline">
              צור קובץ ראשון
            </Link>
          </div>
        )}

        {!loading && collections.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {collections.map((c) => (
              <div key={c.id} className="leket-card px-6 py-5 flex flex-col gap-3 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/collections/${c.id}`} className="text-lg font-bold text-leket-navy hover:text-leket-gold transition-colors flex-1 leading-snug">
                    {c.name}
                  </Link>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    disabled={deleting === c.id}
                    className="opacity-0 group-hover:opacity-100 text-leket-muted hover:text-red-400 transition text-sm p-1 shrink-0"
                    title="מחק"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-leket-parchment border border-leket-border rounded-full px-3 py-1 text-leket-muted">
                    {MODE_ICONS[c.orgMode]} {MODE_LABELS[c.orgMode]}
                  </span>
                  {c.chelek && (
                    <span className="text-xs bg-leket-navy/10 rounded-full px-3 py-1 text-leket-navy font-medium">
                      {CHELEK_LABELS[c.chelek] ?? c.chelek}
                    </span>
                  )}
                  {c.topic && (
                    <span className="text-xs text-leket-muted truncate max-w-[200px]">{c.topic}</span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-leket-muted">
                    {new Date(c.updatedAt).toLocaleDateString("he-IL")}
                  </span>
                  <Link href={`/collections/${c.id}`} className="text-xs text-leket-gold hover:underline font-medium">
                    פתח ←
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
