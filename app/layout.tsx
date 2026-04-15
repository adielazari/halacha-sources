import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
