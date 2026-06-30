import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Racik ACKE",
  description: "Analisa kolom mati A/C/K/E dari data Supabase",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const navStyle: CSSProperties = {
    maxWidth: 560,
    margin: "0 auto",
    padding: "12px 16px 0",
    display: "flex",
    gap: 8,
  };
  const linkStyle: CSSProperties = {
    flex: 1,
    minHeight: 38,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(110,155,255,.28)",
    borderRadius: 999,
    background: "rgba(110,155,255,.10)",
    color: "#cfe0ff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  };

  return (
    <html lang="id">
      <body>
        <nav style={navStyle}>
          <a href="/" style={linkStyle}>Scan</a>
          <a href="/batch" style={linkStyle}>Batch Scan</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
