"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("הסיסמה חייבת להכיל לפחות 8 תווים"); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, token: token || undefined }),
    });
    const data = await res.json() as { error?: string; ok?: boolean };
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "שגיאה בהרשמה"); return; }
    router.push("/login");
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="leket-card w-full max-w-sm px-8 py-10">
        <h1 className="text-2xl font-bold text-leket-navy text-center mb-1">הרשמה</h1>
        <p className="text-leket-muted text-sm text-center mb-8">הצטרפות ללקט</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-leket-muted mb-1.5">שם מלא</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="leket-input" placeholder="ישראל ישראלי" required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-leket-muted mb-1.5">אימייל</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="leket-input" placeholder="your@email.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-leket-muted mb-1.5">סיסמה</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="leket-input" placeholder="לפחות 8 תווים" required />
          </div>

          {error && <p className="text-red-500 text-sm text-right">{error}</p>}
          <button type="submit" disabled={loading} className="leket-btn-primary w-full mt-2">
            {loading ? "נרשם..." : "הרשמה"}
          </button>
        </form>

        <p className="text-center text-sm text-leket-muted mt-6">
          יש לך חשבון?{" "}
          <Link href="/login" className="text-leket-gold hover:underline">כניסה</Link>
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
