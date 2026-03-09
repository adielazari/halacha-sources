"use client";

import { useState } from "react";
import type { CommentaryEntry } from "@/app/siman/[chelek]/[number]/store";
import type { Link } from "@/lib/sefaria";

type Props = {
  sourceRef: string;
  links: Link[];
  added: CommentaryEntry[];
  onAdd: (entry: CommentaryEntry) => void;
  onRemove: (ref: string) => void;
};

export default function CommentatorSuggestions({
  links,
  added,
  onAdd,
  onRemove,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const addedRefs = new Set(added.map((a) => a.ref));

  // Group by category
  const grouped: Record<string, Link[]> = {};
  for (const link of links) {
    const cat = link.category || "אחר";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(link);
  }

  async function handleAdd(link: Link) {
    if (addedRefs.has(link.ref)) return;
    setLoading(link.ref);
    try {
      const res = await fetch(`/api/source?ref=${encodeURIComponent(link.ref)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      onAdd({ ref: link.ref, heRef: link.heRef, text: data.text ?? "" });
    } catch {
      // silent
    } finally {
      setLoading(null);
    }
  }

  if (links.length === 0) {
    return <p className="text-xs text-gray-400">אין מפרשים זמינים</p>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <p className="text-xs text-gray-500 font-medium mb-1">{cat}</p>
          <div className="flex flex-wrap gap-2">
            {items.slice(0, 12).map((link) => {
              const isAdded = addedRefs.has(link.ref);
              return (
                <button
                  key={link.ref}
                  onClick={() => (isAdded ? onRemove(link.ref) : handleAdd(link))}
                  disabled={loading === link.ref}
                  className={`text-xs px-2 py-1 rounded-full border transition ${
                    isAdded
                      ? "bg-amber-700 text-white border-amber-700"
                      : "border-gray-300 text-gray-600 hover:border-amber-500 hover:text-amber-700"
                  } disabled:opacity-50`}
                >
                  {loading === link.ref ? "..." : link.heRef || link.collectiveTitle || link.ref}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
