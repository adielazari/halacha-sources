import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import ConditionalNavBar from "@/components/ConditionalNavBar";

export const metadata: Metadata = {
  title: "לקט — מקורות הלכה",
  description: "מלקט ומארגן מקורות הלכה",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-leket-cream text-leket-text font-hebrew">
        <Providers>
          <ConditionalNavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
