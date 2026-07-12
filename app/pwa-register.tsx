"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "scan-angka:pwa-install-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;

function isAdminPath(pathname: string | null) {
  return pathname === "/admin" || Boolean(pathname?.startsWith("/admin/"));
}

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isIos() {
  const navigatorWithPlatform = navigator as Navigator & { platform?: string };
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigatorWithPlatform.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function wasDismissedRecently() {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION;
  } catch {
    return false;
  }
}

const styles: Record<string, CSSProperties> = {
  card: {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: "calc(82px + env(safe-area-inset-bottom))",
    zIndex: 10000,
    maxWidth: 430,
    margin: "0 auto",
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(110, 155, 255, 0.35)",
    background: "linear-gradient(145deg, rgba(20, 28, 42, 0.98), rgba(11, 17, 27, 0.98))",
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.48)",
    color: "#f4f7ff",
    backdropFilter: "blur(18px)",
  },
  row: { display: "flex", alignItems: "flex-start", gap: 12 },
  icon: {
    width: 42,
    height: 42,
    flex: "0 0 42px",
    display: "grid",
    placeItems: "center",
    borderRadius: 13,
    background: "rgba(110, 155, 255, 0.16)",
    border: "1px solid rgba(110, 155, 255, 0.3)",
  },
  content: { minWidth: 0, flex: 1 },
  title: { margin: 0, fontSize: 15, lineHeight: 1.3, fontWeight: 800 },
  text: { margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "rgba(226, 234, 250, 0.76)" },
  close: {
    width: 30,
    height: 30,
    padding: 0,
    border: 0,
    borderRadius: 10,
    background: "transparent",
    color: "rgba(226, 234, 250, 0.58)",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
  },
  actions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 },
  later: {
    minHeight: 38,
    padding: "0 14px",
    borderRadius: 11,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    background: "rgba(255, 255, 255, 0.05)",
    color: "rgba(244, 247, 255, 0.78)",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  install: {
    minHeight: 38,
    padding: "0 17px",
    borderRadius: 11,
    border: 0,
    background: "linear-gradient(135deg, #6e9bff, #4f7df0)",
    color: "white",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(79, 125, 240, 0.3)",
  },
};

export default function PwaRegister() {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isAdminPath(pathname)) {
      setVisible(false);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        }).catch(() => {
          // Admin tetap berjalan ketika unregister service worker gagal.
        });
      }
      return;
    }

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Aplikasi tetap dapat dipakai ketika pendaftaran service worker gagal.
      });
    }

    if (isStandalone()) {
      setVisible(false);
      return;
    }

    const dismissed = wasDismissedRecently();
    const ios = isIos();
    setIosDevice(ios);
    let showTimer: number | undefined;

    const handleBeforeInstall = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPrompt(promptEvent);
      if (!dismissed) {
        window.clearTimeout(showTimer);
        showTimer = window.setTimeout(() => setVisible(true), 1200);
      }
    };

    const handleInstalled = () => {
      setVisible(false);
      setInstallPrompt(null);
      try {
        window.localStorage.removeItem(DISMISS_KEY);
      } catch {
        // Abaikan kegagalan penyimpanan lokal.
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    if (ios && !dismissed) {
      showTimer = window.setTimeout(() => setVisible(true), 2200);
    }

    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [pathname]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Abaikan kegagalan penyimpanan lokal.
    }
  }

  async function install() {
    if (iosDevice || !installPrompt) {
      dismiss();
      return;
    }

    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "dismissed") dismiss();
      else setVisible(false);
      setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  }

  if (!visible || isAdminPath(pathname)) return null;

  return (
    <aside style={styles.card} role="dialog" aria-live="polite" aria-label="Instal Scan Angka">
      <div style={styles.row}>
        <div style={styles.icon} aria-hidden="true">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        </div>
        <div style={styles.content}>
          <h2 style={styles.title}>Instal Scan Angka</h2>
          <p style={styles.text}>
            {iosDevice
              ? "Ketuk tombol Bagikan di Safari, lalu pilih Tambahkan ke Layar Utama."
              : "Pasang di layar utama agar lebih cepat dibuka dan tampil seperti aplikasi."}
          </p>
        </div>
        <button type="button" style={styles.close} onClick={dismiss} aria-label="Tutup notifikasi instal">×</button>
      </div>
      <div style={styles.actions}>
        <button type="button" style={styles.later} onClick={dismiss}>Nanti</button>
        <button type="button" style={styles.install} onClick={install} disabled={installing}>
          {iosDevice ? "Mengerti" : installing ? "Memproses..." : "Instal"}
        </button>
      </div>
    </aside>
  );
}
