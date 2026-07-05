"use client";

import { useEffect } from "react";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    if (isAdminPath(window.location.pathname)) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => {
        // Admin tetap jalan walau unregister service worker gagal.
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA tetap berjalan meski service worker gagal register.
    });
  }, []);

  return null;
}
