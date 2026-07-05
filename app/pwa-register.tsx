"use client";

import { useEffect } from "react";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const pathname = window.location.pathname;

    if (isAdminPath(pathname)) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => {
        // Admin tetap jalan walau unregister service worker gagal.
      });
      return;
    }

    if (!pathname.startsWith("/pwa")) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/pwa/" }).catch(() => {
      // PWA tetap berjalan meski service worker gagal register.
    });
  }, []);

  return null;
}
