"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { CollectionWithSimanim } from "@/lib/types";
import { getSimanTopic } from "@/lib/simanTopics";
import { downloadExport } from "@/lib/downloadExport";
import { fromHebrewNumeral } from "@/lib/hebrewNumerals";

const CHELEK_LABELS: Record<string, string> = {
  OrachChayim:    "אורח חיים",
  YorehDeah:      "יורה דעה",
  EvenHaEzer:     "אבן העזר",
  ChoshenMishpat: "חושן משפט",
};

const MODE_LABELS: Record<string, string> = {
  topic:    "לפי נושא",
  quantity: "לפי נושא",
  free:     "בחירה חופשית",
};

const CHELAKOT = [
  { value: "OrachChayim",    label: "אורח חיים" },
  { value: "YorehDeah",      label: "יורה דעה" },
  { value: "EvenHaEzer",     label: "אבן העזר" },
  { value: "ChoshenMishpat", label: "חושן משפט" },
];

function AddSimanPanel({ collectionId, onAdded }: { collectionId: string; onAdded: () => void }) {
  const [chelek, setChelek] = useState("OrachChayim");
  const [simanNum, setSimanNum] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function add() {
    const n = fromHebrewNumeral(simanNum) ?? parseInt(simanNum, 10);
    if (!n || n < 1) { setErr("מספר סימן לא תקין"); return; }
    setSaving(true); setErr("");
    const res = await fetch(`/api/collections/${collectionId}/simanim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chelek, simanNumber: n }),
    });
    setSaving(false);
    if (res.status === 409) { setErr("סימן זה כבר בקובץ"); return; }
    if (!res.ok) { setErr("שגיאה"); return; }
    setSimanNum("");
    onAdded();
  }

  return (
    <div className="mt-4 border-t border-leket-border pt-4 space-y-2">
      <p className="text-xs font-medium text-leket-muted">הוסף סימן</p>
      <select value={chelek} onChange={(e) => setChelek(e.target.value)} className="leket-input text-sm py-1.5">
        {CHELAKOT.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <div className="flex gap-2">
        <input
          type="text"
          value={simanNum}
          onChange={(e) => { setSimanNum(e.target.value); setErr(""); }}
          placeholder="מספר או אותיות"
          className="leket-input text-sm py-1.5 flex-1"
        />
        <button onClick={add} disabled={saving} className="leket-btn-primary px-3 py-1.5 rounded-lg text-sm shrink-0">
          {saving ? "..." : "+"}
        </button>
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
    </div>
  );
}

export default function CollectionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [coll, setColl] = useState<CollectionWithSimanim | null>(null);
  const [loadingColl, setLoadingColl] = useState(true);
  const [activeSiman, setActiveSiman] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const load = useCallback(() => {
    setLoadingColl(true);
    fetch(`/api/collections/${params.id}`)
      .then((r) => r.json() as Promise<CollectionWithSimanim>)
      .then((data) => { setColl(data); setNewName(data.name); setLoadingColl(false); })
      .catch(() => setLoadingColl(false));
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  async function saveName() {
    if (!newName.trim() || !coll) return;
    setSavingName(true);
    await fetch(`/api/collections/${coll.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setSavingName(false);
    setEditing(false);
    setColl((prev) => prev ? { ...prev, name: newName.trim() } : prev);
  }

  async function removeSiman(chelek: string, simanNumber: number) {
    await fetch(`/api/collections/${params.id}/simanim`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chelek, simanNumber }),
    });
    load();
  }

  async function deleteCollection() {
    if (!coll || !confirm(`למחוק את "${coll.name}"?`)) return;
    await fetch(`/api/collections/${coll.id}`, { method: "DELETE" });
    router.push("/collections");
  }

  function saveFile() {
    if (!coll) return;
    const data = { collection: { ...coll } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${coll.name}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as { collection: { simanim?: { chelek: string; simanNumber: number }[] } };
        const simanim = data.collection?.simanim ?? [];
        if (simanim.length === 0) { alert("לא נמצאו סימנים בקובץ"); return; }
        await fetch(`/api/collections/${params.id}/simanim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ simanim }),
        });
        load();
      } catch { alert("קובץ לא תקין"); }
    };
    input.click();
  }

  const simanList = (coll?.simanim ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ chelek: s.chelek, simanNumber: s.simanNumber }));

  const activeKey = activeSiman ?? (simanList.length > 0 ? `${simanList[0].chelek}:${simanList[0].simanNumber}` : null);
  const [activeChelek, activeNumStr] = activeKey ? activeKey.split(":") : ["", ""];
  const activeNumber = activeNumStr ? parseInt(activeNumStr, 10) : null;

  if (loadingColl) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-3.5rem)]">
        <div className="w-8 h-8 border-2 border-leket-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!coll) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-4">
        <p className="text-leket-muted">קובץ לימוד לא נמצא</p>
        <Link href="/collections" className="text-leket-gold hover:underline text-sm">← חזרה לקבצים</Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-leket-cream" dir="rtl">

      {/* ── Sidebar ── */}
      <aside className="w-72 shrink-0 flex flex-col border-l border-leket-border bg-white overflow-hidden print:hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-leket-border">
          {editing ? (
            <div className="flex gap-2 mb-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="leket-input text-sm py-1.5 flex-1"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && saveName()}
              />
              <button onClick={saveName} disabled={savingName} className="text-leket-navy text-sm font-semibold hover:text-leket-gold">
                {savingName ? "..." : "שמור"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-leket-navy leading-snug flex-1 ml-2">{coll.name}</h2>
              <button onClick={() => setEditing(true)} className="text-leket-muted hover:text-leket-navy text-xs p-1">✏️</button>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-leket-parchment border border-leket-border rounded-full px-2 py-0.5 text-leket-muted">
              {MODE_LABELS[coll.orgMode]}
            </span>
            {coll.chelek && (
              <span className="text-xs text-leket-muted">{CHELEK_LABELS[coll.chelek]}</span>
            )}
          </div>
        </div>

        {/* Siman list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {simanList.length === 0 && (
            <p className="text-xs text-leket-muted text-center py-6">אין סימנים בקובץ</p>
          )}

          {simanList.map(({ chelek, simanNumber }) => {
            const key = `${chelek}:${simanNumber}`;
            const topic = getSimanTopic(chelek, simanNumber);
            const isActive = activeKey === key;

            return (
              <div
                key={key}
                className={`group flex items-center justify-between rounded-lg px-3 py-2.5 mb-0.5 cursor-pointer transition-all ${
                  isActive ? "bg-leket-navy text-white" : "hover:bg-leket-parchment text-leket-navy"
                }`}
                onClick={() => setActiveSiman(key)}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isActive ? "text-white" : "text-leket-navy"}`}>
                    {CHELEK_LABELS[chelek]} סימן {simanNumber}
                  </p>
                  {topic && (
                    <p className={`text-xs truncate mt-0.5 ${isActive ? "text-white/70" : "text-leket-muted"}`}>{topic}</p>
                  )}
                </div>
                {coll.orgMode === "free" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSiman(chelek, simanNumber); }}
                    className={`opacity-0 group-hover:opacity-100 text-xs p-0.5 transition ${isActive ? "text-white/70 hover:text-white" : "text-leket-muted hover:text-red-400"}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {coll.orgMode === "free" && (
            <AddSimanPanel collectionId={coll.id} onAdded={load} />
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-leket-border px-4 py-3 space-y-2">
          {simanList.length > 0 && (
            <>
              <button
                onClick={() =>
                  downloadExport(
                    "pdf",
                    simanList.map((s) => ({ chelek: s.chelek, siman: String(s.simanNumber) })),
                    `${coll.name}.pdf`
                  )
                }
                className="w-full text-sm text-leket-navy border border-leket-border rounded-lg px-3 py-2 hover:bg-leket-parchment transition text-right"
              >
                📄 ייצוא מאוחד PDF
              </button>
              <button
                onClick={() =>
                  downloadExport(
                    "docx",
                    simanList.map((s) => ({ chelek: s.chelek, siman: String(s.simanNumber) })),
                    `${coll.name}.docx`
                  )
                }
                className="w-full text-sm text-leket-navy border border-leket-border rounded-lg px-3 py-2 hover:bg-leket-parchment transition text-right"
              >
                📄 ייצוא מאוחד Word
              </button>
            </>
          )}
          <button onClick={saveFile} className="w-full text-sm text-leket-navy border border-leket-border rounded-lg px-3 py-2 hover:bg-leket-parchment transition text-right">
            💾 שמור קובץ
          </button>
          {coll.orgMode === "free" && (
            <button onClick={importJson} className="w-full text-sm text-leket-navy border border-leket-border rounded-lg px-3 py-2 hover:bg-leket-parchment transition text-right">
              📂 טען קובץ
            </button>
          )}
          <button onClick={deleteCollection} className="w-full text-sm text-red-400 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition text-right">
            🗑️ מחק קובץ
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeKey && activeChelek && activeNumber ? (
          <>
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-leket-border bg-white shrink-0 print:hidden">
              <span className="text-sm text-leket-muted">
                {CHELEK_LABELS[activeChelek]} · סימן {activeNumber}
                {getSimanTopic(activeChelek, activeNumber) && (
                  <span className="mr-2 text-leket-navy/60">{getSimanTopic(activeChelek, activeNumber)}</span>
                )}
              </span>
              <Link
                href={`/siman/${activeChelek}/${activeNumber}`}
                className="text-sm text-leket-gold hover:underline font-medium"
              >
                ערוך את הסימן ↗
              </Link>
            </div>
            {/* Iframe */}
            <iframe
              key={activeKey}
              src={`/siman/${activeChelek}/${activeNumber}`}
              className="flex-1 border-none w-full"
              title={`סימן ${activeNumber}`}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <p className="text-5xl">📂</p>
            <p className="text-leket-navy font-semibold">
              {simanList.length === 0 ? "הקובץ ריק" : "בחר סימן מהרשימה"}
            </p>
            {simanList.length === 0 && coll.orgMode === "free" && (
              <p className="text-leket-muted text-sm">הוסף סימנים מהסרגל הצדדי</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
