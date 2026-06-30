"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

const items = [
  { href: "/", label: "Scan" },
  { href: "/batch", label: "Batch" },
];

const shellStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 40,
  padding: "8px 12px calc(8px + env(safe-area-inset-bottom))",
  background: "linear-gradient(180deg, rgba(13,17,23,0), rgba(13,17,23,.98) 34%)",
  pointerEvents: "none",
};

const navStyle: CSSProperties = {
  width: "100%",
  maxWidth: 560,
  minHeight: 58,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 6,
  padding: 6,
  border: "1px solid rgba(110,155,255,.22)",
  borderRadius: 18,
  background: "rgba(17,24,35,.96)",
  boxShadow: "0 -14px 32px rgba(0,0,0,.34)",
  backdropFilter: "blur(14px)",
  pointerEvents: "auto",
};

function itemStyle(active: boolean): CSSProperties {
  return {
    minHeight: 46,
    display: "grid",
    placeItems: "center",
    borderRadius: 13,
    border: active ? "1px solid rgba(224,179,65,.44)" : "1px solid transparent",
    background: active ? "rgba(224,179,65,.16)" : "rgba(110,155,255,.08)",
    color: active ? "#e0b341" : "#cfe0ff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: 0.2,
  };
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav style={shellStyle} aria-label="Navigasi utama">
      <div style={navStyle}>
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={itemStyle(Boolean(active))}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
