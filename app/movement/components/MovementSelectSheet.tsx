"use client";

import { useEffect } from "react";
import styles from "./MovementSelectSheet.module.css";

export type MovementSheetOption = {
  value: string | number;
  label: string;
  secondary?: string;
};

type Props = {
  open: boolean;
  title: string;
  options: MovementSheetOption[];
  selectedValue: string | number;
  onSelect: (value: string | number) => void;
  onClose: () => void;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  emptyText?: string;
};

export default function MovementSelectSheet({
  open,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  emptyText = "Pilihan tidak ditemukan",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden="true" />
        <header className={styles.header}>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup pilihan">×</button>
        </header>

        {onSearchChange && (
          <div className={styles.searchWrap}>
            <input
              value={searchValue ?? ""}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder ?? "Cari..."}
              autoFocus
              inputMode="search"
            />
          </div>
        )}

        <div className={styles.optionList}>
          {options.length === 0 && <p className={styles.empty}>{emptyText}</p>}
          {options.map((option) => {
            const active = String(option.value) === String(selectedValue);
            return (
              <button
                key={String(option.value)}
                type="button"
                className={active ? styles.optionActive : styles.option}
                onClick={() => onSelect(option.value)}
              >
                <span className={styles.optionText}>
                  <b>{option.label}</b>
                  {option.secondary && <small>{option.secondary}</small>}
                </span>
                <span className={styles.check} aria-hidden="true">{active ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
