"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/userContext";
import type { Annotation } from "@/lib/types";

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim: "אורח חיים",
  YorehDeah: "יורה דעה",
  EvenHaEzer: "אבן העזר",
  ChoshenMishpat: "חושן משפט",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  approved: "מאושר",
  rejected: "נדחה",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

type Tab = "pending" | "history";
type HistoryFilter = "all" | "pending" | "approved" | "rejected";

export default function AdminPage() {
  const { setCurrentUser } = useUser();

  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  // Set admin identity on mount
  useEffect(() => {
    setCurrentUser("admin");
  }, [setCurrentUser]);

  // Fetch pending when tab === "pending"
  useEffect(() => {
    if (tab !== "pending") return;
    setLoading(true);
    fetch("/api/annotations/admin?status=pending")
      .then((r) => r.json())
      .then((d) => setPending(d.annotations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  // Fetch history when tab === "history"
  useEffect(() => {
    if (tab !== "history") return;
    setLoading(true);
    fetch("/api/annotations/admin?status=all")
      .then((r) => r.json())
      .then((d) => setHistory(d.annotations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  async function handleAction(id: string, status: "approved" | "rejected") {
    setActionInFlight(id);
    try {
      await fetch(`/api/annotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      // Optimistic removal from pending list
      setPending((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // silent — item stays in list, user can retry
    } finally {
      setActionInFlight(null);
    }
  }

  const filteredHistory =
    historyFilter === "all"
      ? history
      : history.filter((a) => a.status === historyFilter);

  return (
    <div className="min-h-screen bg-amber-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <h1 className="text-lg font-bold text-gray-800">פאנל ניהול</h1>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">admin</span>
        <div className="flex-1" />
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">← ראשי</a>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {(["pending", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
                tab === t
                  ? "border-amber-600 text-amber-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "pending" ? "ממתינים לאישור" : "היסטוריה"}
              {t === "pending" && pending.length > 0 && (
                <span className="mr-2 bg-amber-600 text-white text-xs rounded-full px-1.5 py-0.5">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* ── PENDING TAB ── */}
        {tab === "pending" && (
          <>
            {loading ? (
              <p className="text-center text-gray-400 text-sm py-12">טוען...</p>
            ) : pending.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">אין הצעות ממתינות</p>
            ) : (
              <div className="space-y-3">
                {pending.map((ann) => (
                  <div
                    key={ann.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 items-start"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-gray-800 text-sm">{ann.sourceLabel}</span>
                        <span className="text-xs text-gray-400">
                          {CHELEK_LABELS[ann.chelek] ?? ann.chelek} סימן {ann.siman}
                        </span>
                      </div>
                      {ann.highlightText && (
                        <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mb-2 line-clamp-2">
                          {ann.highlightText.slice(0, 120)}{ann.highlightText.length > 120 ? "..." : ""}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>מאת: <strong className="text-gray-600">{ann.userName}</strong></span>
                        <span>{new Date(ann.createdAt).toLocaleDateString("he-IL")}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAction(ann.id, "approved")}
                        disabled={actionInFlight === ann.id}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        ✓ אשר
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(ann.id, "rejected")}
                        disabled={actionInFlight === ann.id}
                        className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
                      >
                        ✗ דחה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <>
            {/* Filter bar */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["all", "pending", "approved", "rejected"] as HistoryFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setHistoryFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    historyFilter === f
                      ? "bg-amber-600 text-white border-amber-600"
                      : "border-gray-300 text-gray-600 hover:border-amber-400"
                  }`}
                >
                  {f === "all" ? "הכל" : STATUS_LABELS[f]}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-center text-gray-400 text-sm py-12">טוען...</p>
            ) : filteredHistory.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">אין רשומות</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">סטטוס</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">מקור</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">סימן</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">משתמש</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">תאריך</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHistory.map((ann) => (
                      <tr key={ann.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ann.status]}`}>
                            {STATUS_LABELS[ann.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate">{ann.sourceLabel}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {CHELEK_LABELS[ann.chelek] ?? ann.chelek} {ann.siman}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{ann.userName}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(ann.createdAt).toLocaleDateString("he-IL")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
