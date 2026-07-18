import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AccessGuard from "./access-guard";
import PwaRegister from "./pwa-register";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Scan Angka",
  description: "Aplikasi scan praktis dengan fitur Batch Scan dalam satu tempat.",
  applicationName: "Scan Angka",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Scan Angka",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <PwaRegister />
        <AccessGuard />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
