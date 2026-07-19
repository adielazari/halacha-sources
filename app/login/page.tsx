"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("אימייל או סיסמה שגויים");
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="leket-card w-full max-w-sm px-8 py-10">
        <h1 className="text-2xl font-bold text-leket-navy text-center mb-1">כניסה</h1>
        <p className="text-leket-muted text-sm text-center mb-8">ברוכים השבים ללקט</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-leket-muted mb-1.5">אימייל</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="leket-input" placeholder="your@email.com" required autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-leket-muted mb-1.5">סיסמה</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="leket-input" placeholder="••••••••" required
            />
          </div>
          {error && <p className="text-red-500 text-sm text-right">{error}</p>}
          <button type="submit" disabled={loading} className="leket-btn-primary w-full mt-2">
            {loading ? "נכנס..." : "כניסה"}
          </button>
        </form>

        <p className="text-center text-sm text-leket-muted mt-6">
          אין לך חשבון?{" "}
          <Link href="/register" className="text-leket-gold hover:underline">
            הרשמה בהזמנה
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
