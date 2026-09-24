"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import type { Excerpt } from "@/lib/types";

export type SaveState = "idle" | "saving" | "saved";

/**
 * Keeps the per-siman document (excerpts + expandedPanels) durably saved on
 * the server (SQLite), on top of the instant-paint localStorage cache the
 * store already has. Server is authoritative once the initial GET resolves.
 */
export function useDocumentAutosave(chelek: string, siman: string): SaveState {
  const excerpts = useStore((s) => s.excerpts);
  const expandedPanels = useStore((s) => s.expandedPanels);
  const loadDocument = useStore((s) => s.loadDocument);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fetch + hydrate once per (chelek, siman).
  useEffect(() => {
    hydrated.current = false;

    fetch(`/api/documents?chelek=${chelek}&siman=${siman}`)
      .then((r) => r.json())
      .then((data: { document: { excerpts: Excerpt[]; expandedPanels: Record<string, boolean> } | null }) => {
        if (data.document) loadDocument(data.document.excerpts, data.document.expandedPanels);
      })
      .catch(() => {/* keep localStorage copy on failure */})
      .finally(() => { hydrated.current = true; });
  }, [chelek, siman, loadDocument]);

  // Debounced autosave whenever the document changes.
  useEffect(() => {
    if (!hydrated.current) return;

    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch("/api/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chelek, siman, excerpts, expandedPanels }),
      })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("idle"));
    }, 1000);

    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excerpts, expandedPanels, chelek, siman]);

  return saveState;
}
