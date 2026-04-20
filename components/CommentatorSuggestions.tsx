"use client";

import { useState, useEffect } from "react";
import type { CommentaryEntry } from "@/lib/types";
import type { Link } from "@/lib/sefaria";

type Props = {
  segmentRefs: string[];       // refs of the confirmed selected segments
  added: CommentaryEntry[];
  onAdd: (entry: CommentaryEntry) => void;
  onRemove: (groupKey: string) => void;
};

type CommentatorGroup = {
  key: string;        // collectiveTitle used as unique id
  heTitle: string;    // display name
  refs: string[];     // all individual link refs in this group
};

export default function CommentatorSuggestions({
  segmentRefs,
  added,
  onAdd,
  onRemove,
}: Props) {
  const [groups, setGroups] = useState<CommentatorGroup[]>([]);
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch links for all segment refs and build groups
  useEffect(() => {
    if (segmentRefs.length === 0) return;
    let cancelled = false;
    setFetching(true);

    async function loadLinks() {
      try {
        const results = await Promise.all(
          segmentRefs.map((ref) =>
            fetch(`/api/source?ref=${encodeURIComponent(ref)}&links=1`)
              .then((r) => (r.ok ? r.json() : { links: [] }))
              .then((d) => (d.links ?? []) as Link[])
          )
        );
        if (cancelled) return;

        // Merge all links, filter to Commentary only
        const allLinks = results.flat().filter((l) => l.category === "Commentary");

        // Group by collectiveTitle
        const map = new Map<string, CommentatorGroup>();
        for (const link of allLinks) {
          const key = link.collectiveTitle || link.heRef || link.ref;
          if (!map.has(key)) {
            map.set(key, { key, heTitle: link.collectiveTitle || link.heRef, refs: [] });
          }
          const group = map.get(key)!;
          if (!group.refs.includes(link.ref)) {
            group.refs.push(link.ref);
          }
        }
        setGroups(Array.from(map.values()));
      } catch {
        // silent
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    loadLinks();
    return () => { cancelled = true; };
  }, [segmentRefs.join(",")]);

  const addedKeys = new Set(added.map((a) => a.ref));

  async function handleAdd(group: CommentatorGroup) {
    if (addedKeys.has(group.key)) return;
    setLoading(group.key);
    setLoadError(null);
    try {
      // Fetch all refs in the group and concatenate text
      const texts = await Promise.all(
        group.refs.map((ref) =>
          fetch(`/api/source?ref=${encodeURIComponent(ref)}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("שגיאת שרת"))))
            .then((d) => (d.text ?? "") as string)
        )
      );
      const combined = texts
        .filter(Boolean)
        .map(t => t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
        .join("\n");
      if (!combined) {
        setLoadError(`לא נמצא טקסט עבור ${group.heTitle}`);
        return;
      }
      onAdd({ ref: group.key, heRef: group.heTitle, text: combined });
    } catch {
      setLoadError(`שגיאה בטעינת ${group.heTitle} — בדוק חיבור לאינטרנט`);
    } finally {
      setLoading(null);
    }
  }

  if (fetching) {
    return <p className="text-xs text-gray-400 animate-pulse">טוען מפרשים...</p>;
  }
  if (groups.length === 0) {
    return <p className="text-xs text-gray-400">אין מפרשים זמינים</p>;
  }

  return (
    <div className="space-y-2">
      {loadError && (
        <p className="text-xs text-red-500">{loadError}</p>
      )}
      <div className="flex flex-wrap gap-2">
      {groups.map((group) => {
        const isAdded = addedKeys.has(group.key);
        return (
          <button
            key={group.key}
            onClick={() => (isAdded ? onRemove(group.key) : handleAdd(group))}
            disabled={loading === group.key}
            className={`text-xs px-2 py-1 rounded-full border transition ${
              isAdded
                ? "bg-amber-700 text-white border-amber-700"
                : "border-gray-300 text-gray-600 hover:border-amber-500 hover:text-amber-700"
            } disabled:opacity-50`}
          >
            {loading === group.key ? "..." : group.heTitle}
          </button>
        );
      })}
      </div>
    </div>
  );
}
