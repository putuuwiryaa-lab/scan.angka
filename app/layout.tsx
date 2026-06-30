import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Racik ACKE",
  description: "Analisa kolom mati A/C/K/E dari data Supabase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <nav className="main-nav">
          <a href="/">Scan</a>
          <a href="/batch">Batch Scan</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
