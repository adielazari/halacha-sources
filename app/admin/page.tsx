"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Annotation } from "@/lib/types";

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim: "אורח חיים", YorehDeah: "יורה דעה",
  EvenHaEzer: "אבן העזר", ChoshenMishpat: "חושן משפט",
};
const STATUS_LABELS: Record<string, string> = { pending: "ממתין", approved: "מאושר", rejected: "נדחה" };
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

type Tab = "pending" | "history" | "users" | "invitations";

// ── AnnotationRow ─────────────────────────────────────────────────────────────

function AnnotationRow({ ann, actionInFlight, onAction, showStatusButtons }: {
  ann: Annotation;
  actionInFlight: string | null;
  onAction: (id: string, update: Partial<{ status: Annotation["status"]; highlightText: string; text: string }>) => Promise<void>;
  showStatusButtons: "pending-only" | "all-statuses";
}) {
  const [expanded, setExpanded] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState(true);
  const [edit, setEdit] = useState({ highlightText: ann.highlightText ?? "", text: ann.text ?? "" });
  const [saving, setSaving] = useState(false);
  const busy = actionInFlight === ann.id || saving;

  return (
    <div className="bg-white border border-leket-border rounded-xl overflow-hidden">
      <div className="p-4 flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[ann.status]}`}>
              {STATUS_LABELS[ann.status]}
            </span>
            <span className="font-bold text-leket-text text-sm">{ann.sourceLabel}</span>
            <span className="text-xs text-leket-muted">{CHELEK_LABELS[ann.chelek] ?? ann.chelek} סימן {ann.siman}</span>
          </div>
          {ann.highlightText && (
            <p className="text-xs text-leket-text bg-leket-parchment border border-leket-border rounded px-2 py-1 mb-1 line-clamp-1">
              {ann.highlightText.slice(0, 100)}{ann.highlightText.length > 100 ? "..." : ""}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-leket-muted">
            <span>מאת: <strong className="text-leket-text">{ann.userName}</strong></span>
            <span>{new Date(ann.createdAt).toLocaleDateString("he-IL")}</span>
            <button onClick={() => setExpanded((v) => !v)} className="text-leket-gold hover:underline">
              {expanded ? "סגור" : "פרטים ועריכה"}
            </button>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {showStatusButtons === "pending-only" ? (
            <>
              <button onClick={() => onAction(ann.id, { status: "approved" })} disabled={busy}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">✓ אשר</button>
              <button onClick={() => onAction(ann.id, { status: "rejected" })} disabled={busy}
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">✗ דחה</button>
            </>
          ) : (
            <>
              {ann.status !== "approved" && <button onClick={() => onAction(ann.id, { status: "approved" })} disabled={busy}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">✓ אשר</button>}
              {ann.status !== "pending" && <button onClick={() => onAction(ann.id, { status: "pending" })} disabled={busy}
                className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50">↩ ממתין</button>}
              {ann.status !== "rejected" && <button onClick={() => onAction(ann.id, { status: "rejected" })} disabled={busy}
                className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">✗ דחה</button>}
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-leket-border p-4 space-y-4 bg-leket-cream">
          {ann.sectionHtml && (
            <div className="border border-leket-border rounded-lg overflow-hidden">
              <button onClick={() => setSectionCollapsed((c) => !c)}
                className="w-full text-right px-3 py-2 bg-leket-parchment text-xs font-medium text-leket-navy flex items-center gap-2">
                <span>{sectionCollapsed ? "▶" : "▼"}</span><span>הקשר הלכתי — {ann.sourceLabel}</span>
              </button>
              {!sectionCollapsed && (
                <div className="p-3 text-xs leading-loose text-leket-text bg-white max-h-40 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: ann.sectionHtml }} />
              )}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-leket-muted mb-1">טקסט מודגש</label>
            <input value={edit.highlightText} onChange={(e) => setEdit((s) => ({ ...s, highlightText: e.target.value }))}
              className="leket-input text-sm" dir="rtl" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-leket-muted mb-1">טקסט המקור</label>
            <textarea value={edit.text} onChange={(e) => setEdit((s) => ({ ...s, text: e.target.value }))}
              rows={4} className="leket-input text-sm resize-y" dir="rtl" />
          </div>
          <div className="flex gap-2">
            <button onClick={async () => { setSaving(true); await onAction(ann.id, { highlightText: edit.highlightText, text: edit.text }); setSaving(false); }}
              disabled={busy} className="leket-btn-primary text-sm px-4 py-1.5">
              {saving ? "שומר..." : "שמור"}
            </button>
            <button onClick={() => { setEdit({ highlightText: ann.highlightText ?? "", text: ann.text ?? "" }); setExpanded(false); }}
              className="px-4 py-1.5 text-sm border border-leket-border rounded-xl hover:bg-leket-parchment text-leket-muted">
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── InvitationsTab ────────────────────────────────────────────────────────────

type InvRecord = { id: string; token: string; email: string | null; usedBy: string | null; usedAt: string | null; createdAt: string; link?: string };

function InvitationsTab() {
  const [invitations, setInvitations] = useState<InvRecord[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/invitations").then((r) => r.json()).then((d: InvRecord[]) => setInvitations(d)).finally(() => setLoading(false));
  }, []);

  async function createInv() {
    setCreating(true);
    const r = await fetch("/api/invitations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() || undefined }),
    });
    const d: InvRecord = await r.json();
    setInvitations((prev) => [d, ...prev]);
    setNewLink(d.link ?? "");
    setEmail("");
    setCreating(false);
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Create invitation */}
      <div className="leket-card p-5">
        <h3 className="font-semibold text-leket-navy mb-3">הזמן משתמש חדש</h3>
        <div className="flex gap-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            className="leket-input flex-1" placeholder="אימייל (אופציונלי)" type="email" />
          <button onClick={createInv} disabled={creating} className="leket-btn-primary whitespace-nowrap">
            {creating ? "יוצר..." : "צור קישור"}
          </button>
        </div>
        {newLink && (
          <div className="mt-3 flex items-center gap-2 bg-leket-parchment border border-leket-border rounded-xl px-3 py-2">
            <span className="text-xs text-leket-text flex-1 break-all font-mono">{newLink}</span>
            <button onClick={() => copyLink(newLink)}
              className="text-xs text-leket-gold hover:underline whitespace-nowrap">
              {copied ? "✓ הועתק" : "העתק"}
            </button>
          </div>
        )}
      </div>

      {/* Invitations list */}
      {loading ? <p className="text-center text-leket-muted text-sm py-8">טוען...</p> : invitations.length === 0 ? (
        <p className="text-center text-leket-muted text-sm py-8">אין הזמנות עדיין</p>
      ) : (
        <div className="space-y-2">
          {invitations.map((inv) => {
            const base = typeof window !== "undefined" ? window.location.origin : "";
            const link = `${base}/register?token=${inv.token}`;
            return (
              <div key={inv.id} className="leket-card px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-leket-text">{inv.email ?? <span className="text-leket-muted text-xs">ללא אימייל ספציפי</span>}</p>
                  <p className="text-xs text-leket-muted">{new Date(inv.createdAt).toLocaleDateString("he-IL")}</p>
                </div>
                {inv.usedBy ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">נוצל</span>
                ) : (
                  <button onClick={() => copyLink(link)}
                    className="text-xs text-leket-gold hover:underline">העתק קישור</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── UsersTab ──────────────────────────────────────────────────────────────────

type UserRecord = { id: string; name: string; email: string; role: string; createdAt: string };

function UsersTab({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((d: UserRecord[]) => setUsers(d)).finally(() => setLoading(false));
  }, []);

  async function toggleRole(user: UserRecord) {
    const newRole = user.role === "admin" ? "user" : "admin";
    await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, role: newRole }) });
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
  }

  if (loading) return <p className="text-center text-leket-muted text-sm py-8">טוען...</p>;

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <div key={user.id} className="leket-card px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-leket-text">{user.name}</p>
            <p className="text-xs text-leket-muted">{user.email}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.role === "admin" ? "bg-leket-navy text-white" : "bg-leket-parchment text-leket-muted"}`}>
            {user.role === "admin" ? "אדמין" : "משתמש"}
          </span>
          {user.id !== currentUserId && (
            <button onClick={() => toggleRole(user)}
              className="text-xs text-leket-gold hover:underline">
              {user.role === "admin" ? "הסר אדמין" : "הפוך לאדמין"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [loading, setLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session.user.role !== "admin") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (tab !== "pending") return;
    setLoading(true);
    fetch("/api/annotations/admin?status=pending")
      .then((r) => r.json()).then((d: { annotations?: Annotation[] }) => setPending(d.annotations ?? []))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "history") return;
    setLoading(true);
    fetch("/api/annotations/admin?status=all")
      .then((r) => r.json()).then((d: { annotations?: Annotation[] }) => setHistory(d.annotations ?? []))
      .finally(() => setLoading(false));
  }, [tab]);

  async function handleAction(id: string, update: Partial<{ status: Annotation["status"]; highlightText: string; text: string }>) {
    setActionInFlight(id);
    try {
      const r = await fetch(`/api/annotations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) });
      if (!r.ok) throw new Error();
      const data: { annotation?: Annotation } = await r.json();
      const updated = data.annotation;
      if (!updated) return;
      setPending((prev) => update.status ? prev.filter((a) => a.id !== id) : prev.map((a) => a.id === id ? updated : a));
      setHistory((prev) => prev.map((a) => a.id === id ? updated : a));
    } finally { setActionInFlight(null); }
  }

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center"><p className="text-leket-muted">טוען...</p></div>;

  const TABS: { key: Tab; label: string }[] = [
    { key: "pending", label: "ממתינים לאישור" },
    { key: "history", label: "היסטוריה" },
    { key: "users", label: "משתמשים" },
    { key: "invitations", label: "הזמנות" },
  ];

  const filteredHistory = historyFilter === "all" ? history : history.filter((a) => a.status === historyFilter);

  return (
    <div className="min-h-[calc(100vh-3.5rem)]" dir="rtl">
      {/* Tab bar */}
      <div className="bg-white border-b border-leket-border px-4">
        <div className="max-w-4xl mx-auto flex gap-0">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition ${tab === key ? "border-leket-gold text-leket-navy" : "border-transparent text-leket-muted hover:text-leket-navy"}`}>
              {label}
              {key === "pending" && pending.length > 0 && (
                <span className="mr-2 bg-leket-gold text-white text-xs rounded-full px-1.5 py-0.5">{pending.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {tab === "pending" && (
          loading ? <p className="text-center text-leket-muted text-sm py-12">טוען...</p>
          : pending.length === 0 ? <p className="text-center text-leket-muted text-sm py-12">אין הצעות ממתינות</p>
          : <div className="space-y-3">{pending.map((ann) => <AnnotationRow key={ann.id} ann={ann} actionInFlight={actionInFlight} onAction={handleAction} showStatusButtons="pending-only" />)}</div>
        )}

        {tab === "history" && (
          <>
            <div className="flex gap-2 mb-4">
              {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                <button key={f} onClick={() => setHistoryFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${historyFilter === f ? "bg-leket-navy text-white border-leket-navy" : "border-leket-border text-leket-muted hover:border-leket-navy"}`}>
                  {f === "all" ? "הכל" : STATUS_LABELS[f]}
                </button>
              ))}
            </div>
            {loading ? <p className="text-center text-leket-muted text-sm py-12">טוען...</p>
            : filteredHistory.length === 0 ? <p className="text-center text-leket-muted text-sm py-12">אין רשומות</p>
            : <div className="space-y-3">{filteredHistory.map((ann) => <AnnotationRow key={ann.id} ann={ann} actionInFlight={actionInFlight} onAction={handleAction} showStatusButtons="all-statuses" />)}</div>}
          </>
        )}

        {tab === "users" && <UsersTab currentUserId={session?.user?.id ?? ""} />}
        {tab === "invitations" && <InvitationsTab />}
      </div>
    </div>
  );
}
