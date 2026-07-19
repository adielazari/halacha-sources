"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export const FONTS = [
  { value: "Noto Serif Hebrew", label: 'נוטו סריף (ברירת מחדל)' },
  { value: "Frank Ruhl Libre",  label: "פרנק רוהל (מסורתי)" },
  { value: "Heebo",             label: "היבו (ללא תגיות)" },
] as const;

export const SIZES = [
  { value: "14px", label: "קטן" },
  { value: "16px", label: "רגיל" },
  { value: "18px", label: "גדול" },
  { value: "20px", label: "גדול מאד" },
] as const;

export const LINE_HEIGHTS = [
  { value: "1.5", label: "צפוף" },
  { value: "1.8", label: "רגיל" },
  { value: "2.2", label: "מרווח" },
] as const;

export type FontFamily = typeof FONTS[number]["value"];
export type FontSize = typeof SIZES[number]["value"];
export type LineHeight = typeof LINE_HEIGHTS[number]["value"];

interface FontSettings {
  fontFamily: FontFamily;
  fontSize: FontSize;
  lineHeight: LineHeight;
}

const DEFAULTS: FontSettings = {
  fontFamily: "Noto Serif Hebrew",
  fontSize:   "16px",
  lineHeight: "1.8",
};

const STORAGE_KEY = "leket-font-settings";

interface FontSettingsCtx extends FontSettings {
  set: (patch: Partial<FontSettings>) => void;
}

const Ctx = createContext<FontSettingsCtx | null>(null);

export function FontSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<FontSettings>(DEFAULTS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--app-font-family", `"${settings.fontFamily}", serif`);
    root.style.setProperty("--app-font-size",   settings.fontSize);
    root.style.setProperty("--app-line-height", settings.lineHeight);
  }, [settings]);

  function set(patch: Partial<FontSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return <Ctx.Provider value={{ ...settings, set }}>{children}</Ctx.Provider>;
}

export function useFontSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFontSettings must be used within FontSettingsProvider");
  return ctx;
}
