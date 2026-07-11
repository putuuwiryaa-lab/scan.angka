"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./bottom-nav.module.css";

type IconName = "scan" | "echo" | "batch";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

const items: NavItem[] = [
  { href: "/", label: "Scan", icon: "scan" },
  { href: "/echo", label: "Echo", icon: "echo" },
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

  if (name === "echo") {
    return (
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6.7 8.4a6.2 6.2 0 0 0 0 7.2" />
        <path d="M17.3 8.4a6.2 6.2 0 0 1 0 7.2" />
        <path d="M4 5.8a9.5 9.5 0 0 0 0 12.4" />
        <path d="M20 5.8a9.5 9.5 0 0 1 0 12.4" />
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
