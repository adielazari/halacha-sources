"use client";

import { SessionProvider } from "next-auth/react";
import { FontSettingsProvider } from "@/lib/fontSettings";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <FontSettingsProvider>{children}</FontSettingsProvider>
    </SessionProvider>
  );
}
