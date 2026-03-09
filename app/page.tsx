"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CHELAKOT = [
  { value: "OrachChayim", label: "אורח חיים" },
  { value: "YorehDeah", label: "יורה דעה" },
  { value: "EvenHaEzer", label: "אבן העזר" },
  { value: "ChoshenMishpat", label: "חושן משפט" },
];

export default function HomePage() {
  const router = useRouter();
  const [chelek, setChelek] = useState("OrachChayim");
  const [siman, setSiman] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(siman, 10);
    if (!siman || isNaN(num) || num < 1) {
      setError("נא להכניס מספר סימן תקין");
      return;
    }
    router.push(`/siman/${chelek}/${num}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-2 text-amber-900">בית יוסף</h1>
        <p className="text-gray-500 mb-8 text-sm">בונה מסמך מקורות</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="text-right">
            <label className="block text-sm font-medium mb-1 text-gray-700">חלק</label>
            <select
              value={chelek}
              onChange={(e) => setChelek(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {CHELAKOT.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="text-right">
            <label className="block text-sm font-medium mb-1 text-gray-700">מספר סימן</label>
            <input
              type="number"
              min={1}
              value={siman}
              onChange={(e) => { setSiman(e.target.value); setError(""); }}
              placeholder="לדוגמה: 1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            הבא ←
          </button>
        </form>
      </div>
    </main>
  );
}
