"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { GroupWithDetails, GroupRole, GroupMember, JoinRequest } from "@/lib/types";
import { getSimanTopic } from "@/lib/simanTopics";
import { fromHebrewNumeral } from "@/lib/hebrewNumerals";

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim: "אורח חיים", YorehDeah: "יורה דעה",
  EvenHaEzer: "אבן העזר",  ChoshenMishpat: "חושן משפט",
};
const CHELAKOT = [
  { value: "OrachChayim", label: "אורח חיים" },
  { value: "YorehDeah",   label: "יורה דעה" },
  { value: "EvenHaEzer",  label: "אבן העזר" },
  { value: "ChoshenMishpat", label: "חושן משפט" },
];
const ROLE_LABELS: Record<GroupRole, string> = { owner: "בעלים", write: "כתיבה", read: "קריאה" };

type UserResult = { id: string; name: string; email: string };

export default function GroupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [grp, setGrp] = useState<GroupWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"simanim" | "members" | "requests">("simanim");
  const [requests, setRequests] = useState<JoinRequest[]>([]);

  // Add siman
  const [addChelek, setAddChelek] = useState("OrachChayim");
  const [addSiman, setAddSiman] = useState("");
  const [addErr, setAddErr] = useState("");
  const [adding, setAdding] = useState(false);

  // Invite user
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<UserResult[]>([]);
  const [inviting, setInviting] = useState<string | null>(null);
  const [inviteErr, setInviteErr] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    fetch(`/api/groups/${params.id}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() as Promise<GroupWithDetails>; })
      .then((d) => { setGrp(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

  const loadRequests = useCallback(() => {
    fetch(`/api/groups/${params.id}/requests`)
      .then((r) => r.ok ? r.json() as Promise<JoinRequest[]> : Promise.resolve([]))
      .then((d) => setRequests(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [params.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (grp?.myRole === "owner") loadRequests(); }, [grp?.myRole, loadRequests]);

  async function addSiman_() {
    const n = fromHebrewNumeral(addSiman) ?? parseInt(addSiman, 10);
    if (!n || n < 1) { setAddErr("מספר לא תקין"); return; }
    setAdding(true); setAddErr("");
    const res = await fetch(`/api/groups/${params.id}/simanim`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chelek: addChelek, simanNumber: n }),
    });
    setAdding(false);
    if (res.status === 409) { setAddErr("סימן כבר קיים"); return; }
    if (!res.ok) { setAddErr("שגיאה"); return; }
    setAddSiman(""); load();
  }

  async function removeSiman(chelek: string, simanNumber: number) {
    await fetch(`/api/groups/${params.id}/simanim`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chelek, simanNumber }),
    });
    load();
  }

  async function changeRole(userId: string, role: GroupRole) {
    await fetch(`/api/groups/${params.id}/members/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    load();
  }

  async function removeMember(userId: string) {
    await fetch(`/api/groups/${params.id}/members/${userId}`, { method: "DELETE" });
    if (userId === session?.user?.id) router.push("/groups");
    else load();
  }

  async function handleRequest(requestId: string, action: "approved" | "rejected") {
    await fetch(`/api/groups/${params.id}/requests/${requestId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    loadRequests(); load();
  }

  function handleInviteSearch(val: string) {
    setInviteQuery(val); setInviteErr("");
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.length < 2) { setInviteResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(val)}&groupId=${params.id}`);
      const data = await res.json() as UserResult[];
      setInviteResults(Array.isArray(data) ? data : []);
    }, 300);
  }

  async function inviteUser(userId: string) {
    setInviting(userId); setInviteErr("");
    const res = await fetch(`/api/groups/${params.id}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json() as { error?: string };
    setInviting(null);
    if (!res.ok) { setInviteErr(data.error ?? "שגיאה"); return; }
    setInviteQuery(""); setInviteResults([]);
    load();
  }

  async function deleteGroup() {
    if (!grp || !confirm(`למחוק את "${grp.name}"?`)) return;
    await fetch(`/api/groups/${params.id}`, { method: "DELETE" });
    router.push("/groups");
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-[calc(100vh-3.5rem)]">
      <div className="w-8 h-8 border-2 border-leket-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!grp) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-4">
      <p className="text-leket-muted">קבוצה לא נמצאה</p>
      <Link href="/groups" className="text-leket-gold hover:underline text-sm">← חזרה לקבוצות</Link>
    </div>
  );

  const isOwner = grp.myRole === "owner";
  const canWrite = grp.myRole === "owner" || grp.myRole === "write";
  const tabs = [
    { key: "simanim" as const, label: "סימנים", count: grp.simanim.length },
    { key: "members" as const, label: "חברים", count: grp.members.length },
    ...(isOwner ? [{ key: "requests" as const, label: "בקשות", count: requests.length }] : []),
  ];

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-leket-cream px-4 py-10" dir="rtl">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-leket-navy">{grp.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${isOwner ? "bg-leket-gold/20 text-leket-gold" : grp.myRole === "write" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                  {ROLE_LABELS[grp.myRole]}
                </span>
                <span className="text-xs text-leket-muted">{grp.members.length} חברים · {grp.simanim.length} סימנים</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {!isOwner && (
                <button onClick={() => removeMember(session?.user?.id ?? "")} className="text-sm text-red-400 border border-red-200 rounded-xl px-3 py-2 hover:bg-red-50 transition">
                  עזוב
                </button>
              )}
              {isOwner && (
                <button onClick={deleteGroup} className="text-sm text-red-400 border border-red-200 rounded-xl px-3 py-2 hover:bg-red-50 transition">
                  מחק
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-leket-border mb-6">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${tab === t.key ? "border-leket-navy text-leket-navy" : "border-transparent text-leket-muted hover:text-leket-navy"}`}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${t.key === "requests" ? "bg-red-500 text-white" : "bg-leket-parchment text-leket-muted"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Simanim tab */}
        {tab === "simanim" && (
          <div>
            {canWrite && (
              <div className="leket-card px-5 py-4 mb-4 flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-32">
                  <label className="block text-xs text-leket-muted mb-1">חלק</label>
                  <select value={addChelek} onChange={(e) => setAddChelek(e.target.value)} className="leket-input text-sm py-1.5">
                    {CHELAKOT.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-24">
                  <label className="block text-xs text-leket-muted mb-1">סימן</label>
                  <input type="text" value={addSiman} onChange={(e) => { setAddSiman(e.target.value); setAddErr(""); }}
                    placeholder="מספר או אותיות" className="leket-input text-sm py-1.5" />
                </div>
                <button onClick={addSiman_} disabled={adding} className="leket-btn-primary px-4 py-2 rounded-xl text-sm shrink-0">
                  {adding ? "..." : "+ הוסף"}
                </button>
                {addErr && <p className="w-full text-red-500 text-xs">{addErr}</p>}
              </div>
            )}
            {grp.simanim.length === 0 ? (
              <p className="text-center py-10 text-leket-muted text-sm">אין סימנים עדיין</p>
            ) : (
              <div className="space-y-2">
                {grp.simanim.map((s) => {
                  const topic = getSimanTopic(s.chelek, s.simanNumber);
                  return (
                    <div key={s.id} className="leket-card px-5 py-3 flex items-center justify-between">
                      <Link href={`/siman/${s.chelek}/${s.simanNumber}`} className="flex-1 no-underline">
                        <span className="font-semibold text-leket-navy text-sm">{CHELEK_LABELS[s.chelek]} סימן {s.simanNumber}</span>
                        {topic && <span className="text-xs text-leket-muted mr-2">{topic}</span>}
                      </Link>
                      {canWrite && (
                        <button onClick={() => removeSiman(s.chelek, s.simanNumber)} className="text-leket-muted hover:text-red-400 text-sm p-1">✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Members tab */}
        {tab === "members" && (
          <div>
            {/* Invite user (owner only) */}
            {isOwner && (
              <div className="leket-card px-5 py-4 mb-4">
                <p className="text-sm font-medium text-leket-muted mb-2">הזמן משתמש ישירות</p>
                <input
                  value={inviteQuery}
                  onChange={(e) => handleInviteSearch(e.target.value)}
                  className="leket-input text-sm"
                  placeholder="חפש לפי שם או אימייל..."
                />
                {inviteErr && <p className="text-xs text-red-500 mt-1">{inviteErr}</p>}
                {inviteResults.length > 0 && (
                  <div className="mt-2 border border-leket-border rounded-xl overflow-hidden">
                    {inviteResults.map((u) => (
                      <div key={u.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-leket-parchment border-b border-leket-border last:border-0">
                        <div>
                          <p className="text-sm font-medium text-leket-navy">{u.name}</p>
                          <p className="text-xs text-leket-muted">{u.email}</p>
                        </div>
                        <button onClick={() => inviteUser(u.id)} disabled={inviting === u.id}
                          className="text-xs text-leket-navy border border-leket-border rounded-lg px-3 py-1.5 hover:bg-white transition">
                          {inviting === u.id ? "..." : "הוסף"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {grp.members.map((m: GroupMember) => (
                <div key={m.id} className="leket-card px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-leket-navy text-sm">{m.userName}</p>
                    <p className="text-xs text-leket-muted">{new Date(m.joinedAt).toLocaleDateString("he-IL")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.role === "owner" ? (
                      <span className="text-xs text-leket-gold font-medium">בעלים</span>
                    ) : isOwner ? (
                      <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value as GroupRole)}
                        className="text-xs border border-leket-border rounded-lg px-2 py-1 bg-white text-leket-muted">
                        <option value="read">קריאה</option>
                        <option value="write">כתיבה</option>
                      </select>
                    ) : (
                      <span className="text-xs text-leket-muted">{ROLE_LABELS[m.role]}</span>
                    )}
                    {(isOwner || m.userId === session?.user?.id) && m.role !== "owner" && (
                      <button onClick={() => removeMember(m.userId)} className="text-leket-muted hover:text-red-400 text-sm p-1">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Requests tab (owner only) */}
        {tab === "requests" && isOwner && (
          <div>
            {requests.length === 0 ? (
              <p className="text-center py-10 text-leket-muted text-sm">אין בקשות ממתינות</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="leket-card px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-leket-navy text-sm">{r.userName}</p>
                      <p className="text-xs text-leket-muted">{r.userEmail}</p>
                      <p className="text-xs text-leket-muted mt-0.5">{new Date(r.requestedAt).toLocaleDateString("he-IL")}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRequest(r.id, "approved")}
                        className="text-sm bg-green-50 text-green-700 border border-green-200 rounded-xl px-4 py-2 hover:bg-green-100 transition font-medium">
                        אשר
                      </button>
                      <button onClick={() => handleRequest(r.id, "rejected")}
                        className="text-sm text-red-400 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition">
                        דחה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
