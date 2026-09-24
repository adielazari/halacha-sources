"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import FontSettingsPanel from "@/components/FontSettingsPanel";

export default function NavBar() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="no-print sticky top-0 z-50 bg-leket-navy border-b border-leket-navyDark shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white leading-none">לקט</span>
          <span className="text-leket-gold text-xs hidden sm:inline">מקורות הלכה</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <Link href="/collections"
            className="text-sm text-white/70 hover:text-leket-gold transition">
            קבצי לימוד
          </Link>
          <Link href="/agents"
            className="text-sm text-white/70 hover:text-leket-gold transition">
            🤖 סוכנים
          </Link>
          <FontSettingsPanel dark />
          {!isHome && (
            <Link href="/" className="text-sm text-white/70 hover:text-leket-gold transition">
              ← בית
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
