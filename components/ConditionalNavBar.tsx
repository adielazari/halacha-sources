"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";

export default function ConditionalNavBar() {
  const pathname = usePathname();
  // Siman page has its own navigation header — no need for the global bar there
  if (pathname.startsWith("/siman/")) return null;
  return <NavBar />;
}
