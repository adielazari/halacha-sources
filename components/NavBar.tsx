"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import FontSettingsPanel from "@/components/FontSettingsPanel";

export default function NavBar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isHome = pathname === "/";
  const isAdmin = session?.user?.role === "admin";

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
          {status === "authenticated" && (
            <>
              <Link href="/groups"
                className="text-sm text-white/70 hover:text-leket-gold transition">
                קבוצות
              </Link>
              <Link href="/collections"
                className="text-sm text-white/70 hover:text-leket-gold transition">
                קבצי לימוד
              </Link>
              <Link href="/agents"
                className="text-sm text-white/70 hover:text-leket-gold transition">
                🤖 סוכנים
              </Link>
              {isAdmin && (
                <Link href="/admin"
                  className="text-sm text-white/70 hover:text-leket-gold transition">
                  ניהול
                </Link>
              )}
              <FontSettingsPanel dark />
              <span className="text-sm text-white/60 hidden sm:inline">
                {session.user.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-sm text-white/70 hover:text-red-400 transition"
              >
                יציאה
              </button>
            </>
          )}
          {status === "unauthenticated" && !pathname.startsWith("/login") && !pathname.startsWith("/register") && (
            <Link href="/login" className="text-sm text-white/70 hover:text-leket-gold transition">
              כניסה
            </Link>
          )}
          {!isHome && status === "authenticated" && (
            <Link href="/" className="text-sm text-white/70 hover:text-leket-gold transition">
              ← בית
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
