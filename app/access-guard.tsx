"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ACCESS_CHECK_INTERVAL_MS = 30_000;

function isPublicPage(pathname: string) {
  return pathname === "/pin" || pathname.startsWith("/admin");
}

export default function AccessGuard() {
  const pathname = usePathname();
  const redirecting = useRef(false);

  useEffect(() => {
    if (!pathname || isPublicPage(pathname)) return;

    let cancelled = false;

    async function checkAccess() {
      try {
        const response = await fetch("/api/access/status", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });

        if (cancelled || response.ok) return;

        if ((response.status === 401 || response.status === 403) && !redirecting.current) {
          redirecting.current = true;
          window.location.replace("/pin");
        }
      } catch {
        // Gangguan jaringan tidak boleh mengeluarkan user yang aksesnya masih aktif.
      }
    }

    void checkAccess();

    const intervalId = window.setInterval(() => {
      void checkAccess();
    }, ACCESS_CHECK_INTERVAL_MS);

    const handleFocus = () => {
      void checkAccess();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkAccess();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname]);

  return null;
}
