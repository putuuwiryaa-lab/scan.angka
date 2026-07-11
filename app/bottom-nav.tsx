"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./bottom-nav.module.css";

type IconName = "scan" | "movement" | "batch";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

const items: NavItem[] = [
  { href: "/", label: "Scan", icon: "scan" },
  { href: "/movement", label: "Prediksi", icon: "movement" },
  { href: "/batch", label: "Batch", icon: "batch" },
];

function NavIcon({ name }: { name: IconName }) {
  if (name === "scan") {
    return (
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 4 4" />
        <path d="M8.5 10.5h4" />
      </svg>
    );
  }

  if (name === "movement") {
    return (
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17.5 9 12l3.2 3.2L20 7.5" />
        <path d="M15.5 7.5H20V12" />
        <circle cx="4" cy="17.5" r="1.2" />
        <circle cx="9" cy="12" r="1.2" />
        <circle cx="12.2" cy="15.2" r="1.2" />
      </svg>
    );
  }

  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.2" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.shell} aria-label="Navigasi utama">
      <div className={styles.nav}>
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? styles.activeItem : styles.item}
              aria-current={active ? "page" : undefined}
            >
              <NavIcon name={item.icon} />
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
