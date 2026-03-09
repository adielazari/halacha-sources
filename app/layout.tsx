import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "בית יוסף — בונה מקורות",
  description: "סייר מקורות בית יוסף",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-amber-50 text-gray-800 font-hebrew">
        {children}
      </body>
    </html>
  );
}
