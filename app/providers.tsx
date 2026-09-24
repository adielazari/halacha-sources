"use client";

import { FontSettingsProvider } from "@/lib/fontSettings";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FontSettingsProvider>{children}</FontSettingsProvider>
  );
}
