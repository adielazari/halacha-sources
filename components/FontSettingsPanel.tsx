"use client";

import { useState } from "react";
import { useFontSettings, FONTS, SIZES, LINE_HEIGHTS } from "@/lib/fontSettings";

export default function FontSettingsPanel({ dark }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const { fontFamily, fontSize, lineHeight, showNikud, set } = useFontSettings();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={dark
          ? "text-white/70 hover:text-leket-gold transition text-base leading-none"
          : "text-gray-500 hover:text-gray-700 transition text-base leading-none"}
        title="הגדרות תצוגה — גודל טקסט המקורות"
        aria-label="הגדרות תצוגה"
      >
        ⚙️
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-8 z-50 bg-white border border-leket-border rounded-xl shadow-xl p-4 w-64"
            dir="rtl"
          >
            <p className="text-sm font-bold text-leket-navy mb-4">הגדרות תצוגה</p>

            {/* Font family */}
            <div className="mb-4">
              <p className="text-xs text-leket-muted mb-1.5">גופן</p>
              <div className="flex flex-col gap-1">
                {FONTS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => set({ fontFamily: f.value })}
                    style={{ fontFamily: `"${f.value}", serif` }}
                    className={`text-right px-3 py-2 rounded-lg text-sm transition ${
                      fontFamily === f.value
                        ? "bg-leket-navy text-white"
                        : "hover:bg-leket-parchment text-leket-navy"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font size */}
            <div className="mb-4">
              <p className="text-xs text-leket-muted mb-1.5">גודל טקסט</p>
              <div className="flex gap-1">
                {SIZES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => set({ fontSize: s.value })}
                    className={`flex-1 py-1.5 rounded-lg text-xs transition ${
                      fontSize === s.value
                        ? "bg-leket-navy text-white"
                        : "bg-leket-parchment hover:bg-leket-border text-leket-navy"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Line height */}
            <div>
              <p className="text-xs text-leket-muted mb-1.5">רווח שורות</p>
              <div className="flex gap-1">
                {LINE_HEIGHTS.map((lh) => (
                  <button
                    key={lh.value}
                    onClick={() => set({ lineHeight: lh.value })}
                    className={`flex-1 py-1.5 rounded-lg text-xs transition ${
                      lineHeight === lh.value
                        ? "bg-leket-navy text-white"
                        : "bg-leket-parchment hover:bg-leket-border text-leket-navy"
                    }`}
                  >
                    {lh.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nikud */}
            <div className="mt-4">
              <p className="text-xs text-leket-muted mb-1.5">ניקוד</p>
              <div className="flex gap-1">
                <button
                  onClick={() => set({ showNikud: true })}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition ${
                    showNikud
                      ? "bg-leket-navy text-white"
                      : "bg-leket-parchment hover:bg-leket-border text-leket-navy"
                  }`}
                >
                  עם ניקוד
                </button>
                <button
                  onClick={() => set({ showNikud: false })}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition ${
                    !showNikud
                      ? "bg-leket-navy text-white"
                      : "bg-leket-parchment hover:bg-leket-border text-leket-navy"
                  }`}
                >
                  בלי ניקוד
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
