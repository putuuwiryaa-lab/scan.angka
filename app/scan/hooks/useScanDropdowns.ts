"use client";

import { useState } from "react";

export type ScanDropdown = "market" | "jenis" | "target" | "digit";

export function useScanDropdowns() {
  const [activeDropdown, setActiveDropdown] = useState<ScanDropdown | null>(null);

  function isOpen(name: ScanDropdown) {
    return activeDropdown === name;
  }

  function toggleDropdown(name: ScanDropdown) {
    setActiveDropdown((current) => current === name ? null : name);
  }

  function openDropdown(name: ScanDropdown) {
    setActiveDropdown(name);
  }

  function closeDropdown() {
    setActiveDropdown(null);
  }

  return {
    activeDropdown,
    isOpen,
    toggleDropdown,
    openDropdown,
    closeDropdown,
  };
}
