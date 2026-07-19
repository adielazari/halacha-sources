"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Group, GroupRole } from "@/lib/types";

type GroupWithRole = Group & { myRole: GroupRole; pendingRequests: number };

const ROLE_LABELS: Record<GroupRole, string> = { owner: "בעלים", write: "כתיבה", read: "קריאה" };

export default function GroupsPage() {
  const router = useRouter();
  const [myGroups, setMyGroups] = useState<GroupWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "find" | null>(null);

  // Create form
  const [createName, setCreateName] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [creating, setCreating] = useState(false);

  // Find/join form
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [requestErr, setRequestErr] = useState<Record<string, string>>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json() as Promise<GroupWithRole[]>)
      .then((d) => { setMyGroups(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateErr("");
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: createName }),
    });
    const data = await res.json() as { id?: string; error?: string };
    setCreating(false);
    if (!res.ok) { setCreateErr(data.error ?? "שגיאה"); return; }
    router.push(`/groups/${data.id!}`);
  }

  function handleSearchChange(val: string) {
    setSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/groups?search=${encodeURIComponent(val)}`);
      const data = await res.json() as Group[];
      setSearchResults(Array.isArray(data) ? data.filter((g) => !myGroups.some((m) => m.id === g.id)) : []);
      setSearching(false);
    }, 300);
  }

  async function sendRequest(groupId: string) {
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) { setRequestErr((p) => ({ ...p, [groupId]: data.error ?? "שגיאה" })); return; }
    setRequestedIds((p) => { const s = new Set(Array.from(p)); s.add(groupId); return s; });
  }

  const closeModal = () => { setModal(null); setCreateName(""); setCreateErr(""); setSearchQuery(""); setSearchResults([]); setRequestErr({}); };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-leket-cream px-4 py-10" dir="rtl">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-leket-navy">קבוצות</h1>
            <p className="text-leket-muted text-sm mt-1">שיתוף מקורות עם אחרים</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModal("find")} className="border border-leket-border bg-white text-leket-navy text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-leket-parchment transition">
              🔍 מצא קבוצה
            </button>
            <button onClick={() => setModal("create")} className="leket-btn-primary text-sm px-4 py-2.5 rounded-xl">
              + צור קבוצה
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-leket-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && myGroups.length === 0 && (
          <div className="leket-card text-center py-16 px-8">
            <p className="text-5xl mb-4">👥</p>
            <p className="text-leket-navy font-semibold text-lg mb-2">אין עדיין קבוצות</p>
            <p className="text-leket-muted text-sm">צור קבוצה חדשה או מצא קבוצה קיימת</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {myGroups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="leket-card px-6 py-5 hover:shadow-md transition-shadow no-underline">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-lg font-bold text-leket-navy">{g.name}</h2>
                <div className="flex items-center gap-2">
                  {g.pendingRequests > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">{g.pendingRequests}</span>
                  )}
                  <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${g.myRole === "owner" ? "bg-leket-gold/20 text-leket-gold" : g.myRole === "write" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                    {ROLE_LABELS[g.myRole]}
                  </span>
                </div>
              </div>
              <p className="text-xs text-leket-muted">{new Date(g.createdAt).toLocaleDateString("he-IL")}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Create modal */}
      {modal === "create" && (
        <Modal title="צור קבוצה חדשה" onClose={closeModal}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-leket-muted mb-1.5">שם הקבוצה</label>
              <input value={createName} onChange={(e) => setCreateName(e.target.value)} className="leket-input" placeholder='לדוגמה: "חבורת שבת"' autoFocus required />
              <p className="text-xs text-leket-muted mt-1">יכולות להיות מספר קבוצות עם אותו שם</p>
            </div>
            {createErr && <p className="text-red-500 text-sm">{createErr}</p>}
            <button type="submit" disabled={creating} className="leket-btn-primary w-full">{creating ? "יוצר..." : "צור קבוצה"}</button>
          </form>
        </Modal>
      )}

      {/* Find & join modal */}
      {modal === "find" && (
        <Modal title="מצא קבוצה" onClose={closeModal}>
          <div className="space-y-4">
            <div>
              <input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="leket-input"
                placeholder="חפש לפי שם קבוצה..."
                autoFocus
              />
            </div>

            {searching && <p className="text-xs text-leket-muted text-center">מחפש...</p>}

            {!searching && searchQuery && searchResults.length === 0 && (
              <p className="text-sm text-leket-muted text-center py-4">לא נמצאו קבוצות</p>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((g) => {
                const requested = requestedIds.has(g.id);
                return (
                  <div key={g.id} className="flex items-center justify-between bg-leket-parchment rounded-xl px-4 py-3">
                    <div>
                      <p className="font-semibold text-leket-navy text-sm">{g.name}</p>
                      {requestErr[g.id] && <p className="text-xs text-red-500 mt-0.5">{requestErr[g.id]}</p>}
                    </div>
                    {requested ? (
                      <span className="text-xs text-green-600 font-medium">✓ בקשה נשלחה</span>
                    ) : (
                      <button onClick={() => sendRequest(g.id)} className="text-sm text-leket-navy border border-leket-border rounded-lg px-3 py-1.5 hover:bg-white transition">
                        בקש להצטרף
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {searchQuery && (
              <p className="text-xs text-leket-muted text-center">
                בקשת ההצטרפות תישלח לבעל הקבוצה לאישור
              </p>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="leket-card w-full max-w-sm px-8 py-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-leket-navy">{title}</h2>
          <button onClick={onClose} className="text-leket-muted hover:text-leket-navy text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
