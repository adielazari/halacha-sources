"use client";

import { UserProvider } from "@/lib/userContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}
