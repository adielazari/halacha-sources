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

type EditState = {
  highlightText: string;
  text: string;
};

// A single expandable annotation row used in both tabs
function AnnotationRow({
  ann,
  actionInFlight,
  onAction,
  showStatusButtons,
}: {
  ann: Annotation;
  actionInFlight: string | null;
  onAction: (id: string, update: Partial<{ status: Annotation["status"]; highlightText: string; text: string }>) => Promise<void>;
  showStatusButtons: "pending-only" | "all-statuses";
}) {
  const [expanded, setExpanded] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState(true);
  const [edit, setEdit] = useState<EditState>({ highlightText: ann.highlightText ?? "", text: ann.text ?? "" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onAction(ann.id, { highlightText: edit.highlightText, text: edit.text });
    setSaving(false);
  }

  const busy = actionInFlight === ann.id || saving;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Row summary — always visible */}
      <div className="p-4 flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[ann.status]}`}>
              {STATUS_LABELS[ann.status]}
            </span>
            <span className="font-bold text-gray-800 text-sm">{ann.sourceLabel}</span>
            <span className="text-xs text-gray-400">
              {CHELEK_LABELS[ann.chelek] ?? ann.chelek} סימן {ann.siman}
            </span>
          </div>
          {ann.highlightText && (
            <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mb-1 line-clamp-1">
              {ann.highlightText.slice(0, 100)}{ann.highlightText.length > 100 ? "..." : ""}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>מאת: <strong className="text-gray-600">{ann.userName}</strong></span>
            <span>{new Date(ann.createdAt).toLocaleDateString("he-IL")}</span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-blue-500 hover:text-blue-700 underline"
            >
              {expanded ? "סגור" : "פרטים ועריכה"}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {showStatusButtons === "pending-only" ? (
            <>
              <button
                type="button"
                onClick={() => onAction(ann.id, { status: "approved" })}
                disabled={busy}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                ✓ אשר
              </button>
              <button
                type="button"
                onClick={() => onAction(ann.id, { status: "rejected" })}
                disabled={busy}
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
              >
                ✗ דחה
              </button>
            </>
          ) : (
            <>
              {ann.status !== "approved" && (
                <button
                  type="button"
                  onClick={() => onAction(ann.id, { status: "approved" })}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                >
                  ✓ אשר
                </button>
              )}
              {ann.status !== "pending" && (
                <button
                  type="button"
                  onClick={() => onAction(ann.id, { status: "pending" })}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition"
                >
                  ↩ ממתין
                </button>
              )}
              {ann.status !== "rejected" && (
                <button
                  type="button"
                  onClick={() => onAction(ann.id, { status: "rejected" })}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
                >
                  ✗ דחה
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expanded details + edit */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50" dir="rtl">
          {/* Halachic context — sectionHtml */}
          {ann.sectionHtml && (
            <div className="border border-amber-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setSectionCollapsed((c) => !c)}
                className="w-full text-right px-3 py-2 bg-amber-50 hover:bg-amber-100 text-xs font-medium text-amber-800 flex items-center gap-2 transition"
              >
                <span>{sectionCollapsed ? "▶" : "▼"}</span>
                <span>הקשר הלכתי — {ann.sourceLabel}</span>
              </button>
              {!sectionCollapsed && (
                <div
                  className="p-3 text-xs leading-loose text-gray-700 bg-white max-h-40 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: ann.sectionHtml }}
                />
              )}
            </div>
          )}

          {/* Edit highlight text */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              טקסט מודגש (מה יודגש בפאנל)
            </label>
            <input
              type="text"
              value={edit.highlightText}
              onChange={(e) => setEdit((s) => ({ ...s, highlightText: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
              dir="rtl"
            />
          </div>

          {/* Edit pulled source text */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              טקסט המקור שנמשך
            </label>
            <textarea
              value={edit.text}
              onChange={(e) => setEdit((s) => ({ ...s, text: e.target.value }))}
              rows={4}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 resize-y"
              dir="rtl"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? "שומר..." : "שמור שינויים"}
            </button>
            <button
              type="button"
              onClick={() => { setEdit({ highlightText: ann.highlightText ?? "", text: ann.text ?? "" }); setExpanded(false); }}
              className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600 transition"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { setCurrentUser } = useUser();

  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  useEffect(() => { setCurrentUser("admin"); }, [setCurrentUser]);

  useEffect(() => {
    if (tab !== "pending") return;
    setLoading(true);
    fetch("/api/annotations/admin?status=pending")
      .then((r) => r.json())
      .then((d) => setPending(d.annotations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "history") return;
    setLoading(true);
    fetch("/api/annotations/admin?status=all")
      .then((r) => r.json())
      .then((d) => setHistory(d.annotations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  async function handleAction(
    id: string,
    update: Partial<{ status: Annotation["status"]; highlightText: string; text: string }>
  ) {
    setActionInFlight(id);
    try {
      const r = await fetch(`/api/annotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: { annotation?: Annotation } = await r.json();
      const updated = data.annotation;
      if (!updated) return;

      // Update both lists in place
      setPending((prev) =>
        update.status
          ? prev.filter((a) => a.id !== id)   // status change removes from pending
          : prev.map((a) => (a.id === id ? updated : a))
      );
      setHistory((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      // silent
    } finally {
      setActionInFlight(null);
    }
  }

  const filteredHistory =
    historyFilter === "all" ? history : history.filter((a) => a.status === historyFilter);

  return (
    <div className="min-h-screen bg-amber-50" dir="rtl">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <h1 className="text-lg font-bold text-gray-800">פאנל ניהול</h1>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">admin</span>
        <div className="flex-1" />
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">← ראשי</a>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {(["pending", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
                tab === t ? "border-amber-600 text-amber-700" : "border-transparent text-gray-500 hover:text-gray-700"
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
        {tab === "pending" && (
          <>
            {loading ? (
              <p className="text-center text-gray-400 text-sm py-12">טוען...</p>
            ) : pending.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">אין הצעות ממתינות</p>
            ) : (
              <div className="space-y-3">
                {pending.map((ann) => (
                  <AnnotationRow
                    key={ann.id}
                    ann={ann}
                    actionInFlight={actionInFlight}
                    onAction={handleAction}
                    showStatusButtons="pending-only"
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <>
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
              <div className="space-y-3">
                {filteredHistory.map((ann) => (
                  <AnnotationRow
                    key={ann.id}
                    ann={ann}
                    actionInFlight={actionInFlight}
                    onAction={handleAction}
                    showStatusButtons="all-statuses"
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
