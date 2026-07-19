"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GroupRole } from "@/lib/types";

type GroupEntry = {
  groupId: string;
  groupName: string;
  myRole: GroupRole;
};

type Props = {
  chelek: string;
  simanNumber: number;
};

const ROLE_LABELS: Record<GroupRole, string> = { owner: "בעלים", write: "כתיבה", read: "קריאה" };

export default function GroupSimanBanner({ chelek, simanNumber }: Props) {
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [userGroups, setUserGroups] = useState<(GroupEntry & { id: string })[]>([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/groups/for-siman?chelek=${chelek}&siman=${simanNumber}`)
      .then((r) => r.json() as Promise<GroupEntry[]>)
      .then((d) => setGroups(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [chelek, simanNumber]);

  async function loadUserGroups() {
    if (userGroups.length > 0) { setShowAddPanel(true); return; }
    setAdding(true);
    const res = await fetch("/api/groups");
    const all = await res.json() as (GroupEntry & { id: string })[];
    setAdding(false);
    const writable = Array.isArray(all) ? all.filter((g) => g.myRole !== "read") : [];
    setUserGroups(writable);
    setShowAddPanel(true);
  }

  async function addToGroup(groupId: string) {
    setAddingId(groupId);
    await fetch(`/api/groups/${groupId}/simanim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chelek, simanNumber }),
    });
    setAddingId(null);
    // Refresh
    const res = await fetch(`/api/groups/for-siman?chelek=${chelek}&siman=${simanNumber}`);
    const d = await res.json() as GroupEntry[];
    setGroups(Array.isArray(d) ? d : []);
    setShowAddPanel(false);
  }

  if (groups.length === 0 && !showAddPanel) {
    return (
      <div className="no-print">
        <button
          onClick={loadUserGroups}
          disabled={adding}
          className="text-xs text-leket-muted hover:text-leket-navy border border-dashed border-leket-border rounded-lg px-3 py-1.5 transition"
        >
          {adding ? "..." : "👥 הוסף לקבוצה"}
        </button>

        {showAddPanel && userGroups.length === 0 && (
          <p className="text-xs text-leket-muted mt-1">
            אין קבוצות עם הרשאת כתיבה.{" "}
            <Link href="/groups" className="text-leket-gold hover:underline">נהל קבוצות</Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="no-print">
      <div className="flex items-center gap-2 flex-wrap">
        {groups.map((g) => (
          <Link
            key={g.groupId}
            href={`/groups/${g.groupId}`}
            className="inline-flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-3 py-1 hover:bg-blue-100 transition no-underline"
          >
            <span>👥</span>
            <span>{g.groupName}</span>
            <span className="opacity-60">{ROLE_LABELS[g.myRole]}</span>
          </Link>
        ))}
        <button
          onClick={loadUserGroups}
          disabled={adding}
          className="text-xs text-leket-muted hover:text-leket-navy border border-dashed border-leket-border rounded-full px-3 py-1 transition"
        >
          {adding ? "..." : "+ הוסף לקבוצה"}
        </button>
      </div>

      {/* Add-to-group dropdown */}
      {showAddPanel && (
        <div className="mt-2 bg-white border border-leket-border rounded-xl shadow-md p-3 max-w-xs">
          <p className="text-xs font-medium text-leket-muted mb-2">הוסף לקבוצה</p>
          {userGroups.length === 0 ? (
            <p className="text-xs text-leket-muted">אין קבוצות עם הרשאת כתיבה</p>
          ) : (
            <div className="space-y-1">
              {userGroups
                .filter((g) => !groups.some((existing) => existing.groupId === g.id))
                .map((g) => (
                  <button
                    key={g.id}
                    onClick={() => addToGroup(g.id)}
                    disabled={addingId === g.id}
                    className="w-full text-right text-sm text-leket-navy hover:bg-leket-parchment rounded-lg px-3 py-2 transition"
                  >
                    {addingId === g.id ? "מוסיף..." : g.groupName}
                  </button>
                ))}
            </div>
          )}
          <button onClick={() => setShowAddPanel(false)} className="mt-2 text-xs text-leket-muted hover:text-leket-navy">סגור</button>
        </div>
      )}
    </div>
  );
}
