"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "leket-panel-prefs";
const DEFAULT_ORDER = ["tur", "beitYosef", "shulchanArukh", "taz", "shakh", "pitcheiTeshuva"];
// Roughly matches the old hardcoded 55vh on a typical viewport — keeps the
// first-load behavior unchanged for anyone who hasn't customized anything.
export const DEFAULT_PANEL_HEIGHT = 420;

type PanelPrefs = { order: string[]; heights: Record<string, number> };

function load(): PanelPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const storedOrder: string[] = Array.isArray(parsed.order) ? parsed.order : DEFAULT_ORDER;
      // Forward-compat: fold in any panel keys that didn't exist when this was saved.
      const order = [...storedOrder, ...DEFAULT_ORDER.filter((k) => !storedOrder.includes(k))];
      return { order, heights: parsed.heights ?? {} };
    }
  } catch { /* ignore */ }
  return { order: DEFAULT_ORDER, heights: {} };
}

function persist(prefs: PanelPrefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

export function usePanelPrefs() {
  const [prefs, setPrefs] = useState<PanelPrefs>({ order: DEFAULT_ORDER, heights: {} });

  useEffect(() => { setPrefs(load()); }, []);

  const reorder = useCallback((fromKey: string, toIndex: number) => {
    setPrefs((prev) => {
      const order = [...prev.order];
      const fromIndex = order.indexOf(fromKey);
      if (fromIndex === -1 || fromIndex === toIndex) return prev;
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, fromKey);
      const next = { ...prev, order };
      persist(next);
      return next;
    });
  }, []);

  const setHeight = useCallback((key: string, px: number) => {
    setPrefs((prev) => {
      const next = { ...prev, heights: { ...prev.heights, [key]: px } };
      persist(next);
      return next;
    });
  }, []);

  return { order: prefs.order, heights: prefs.heights, reorder, setHeight };
}
