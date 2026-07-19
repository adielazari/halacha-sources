"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { AgentDefinition, AgentLanguage } from "@/lib/types";

type EditableFields = { name: string; model: string; systemPrompt: string; language: AgentLanguage };

function toEditable(agent: AgentDefinition): EditableFields {
  return { name: agent.name, model: agent.model, systemPrompt: agent.systemPrompt, language: agent.language };
}

function AgentCard({ agent, onSaved, onDeleted }: {
  agent: AgentDefinition;
  onSaved: (updated: AgentDefinition) => void;
  onDeleted: (id: string) => void;
}) {
  const [fields, setFields] = useState<EditableFields>(toEditable(agent));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json() as { agent?: AgentDefinition };
      if (data.agent) {
        onSaved(data.agent);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`למחוק את הסוכן "${agent.name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    onDeleted(agent.id);
  }

  return (
    <div className="leket-card px-6 py-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <input
          value={fields.name}
          onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
          className="leket-input flex-1 font-semibold"
          dir="rtl"
        />
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-leket-muted hover:text-red-400 transition text-sm px-2"
          title="מחק"
        >
          🗑
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-leket-muted w-16 shrink-0">מודל</label>
        <input
          value={fields.model}
          onChange={(e) => setFields((f) => ({ ...f, model: e.target.value }))}
          className="leket-input flex-1 text-sm"
          dir="ltr"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-leket-muted w-16 shrink-0">שפה</label>
        <div className="flex gap-2">
          {(["he", "en"] as AgentLanguage[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setFields((f) => ({ ...f, language: lang }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                fields.language === lang
                  ? "bg-leket-navy text-white border-leket-navy"
                  : "border-leket-border text-leket-muted hover:border-leket-navy"
              }`}
            >
              {lang === "he" ? "עברית" : "English"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-leket-muted mb-1">הנחיות (system prompt)</label>
        <textarea
          value={fields.systemPrompt}
          onChange={(e) => setFields((f) => ({ ...f, systemPrompt: e.target.value }))}
          rows={6}
          className="leket-input text-sm resize-y"
          dir="rtl"
        />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="leket-btn-primary text-sm px-5 py-2">
          {saving ? "שומר..." : "שמור"}
        </button>
        {saved && <span className="text-sm text-green-600">נשמר ✓</span>}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json() as Promise<{ agents?: AgentDefinition[] }>)
      .then((data) => setAgents(data.agents ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "סוכן חדש",
          model: "claude-opus-4-8",
          systemPrompt: "",
          language: "he",
        }),
      });
      const data = await res.json() as { agent?: AgentDefinition };
      if (data.agent) setAgents((prev) => [...prev, data.agent!]);
    } finally {
      setCreating(false);
    }
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-leket-muted">טוען...</p></div>;
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-leket-cream px-4 py-10" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-leket-navy">🤖 סוכנים</h1>
            <p className="text-leket-muted text-sm mt-1">
              הרץ סוכנים על כל סימן כדי להוסיף נקודות מחוללות אוטומטית לדף המקורות
            </p>
          </div>
          <button onClick={handleCreate} disabled={creating} className="leket-btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold">
            + סוכן חדש
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-leket-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && agents.length === 0 && (
          <div className="leket-card text-center py-16 px-8">
            <p className="text-5xl mb-4">🤖</p>
            <p className="text-leket-navy font-semibold text-lg mb-2">אין עדיין סוכנים</p>
          </div>
        )}

        {!loading && agents.length > 0 && (
          <div className="flex flex-col gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onSaved={(updated) => setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))}
                onDeleted={(id) => setAgents((prev) => prev.filter((a) => a.id !== id))}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
