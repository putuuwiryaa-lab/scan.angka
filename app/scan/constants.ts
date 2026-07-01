import type { CSSProperties } from "react";
import type { Posisi, ScanMode, Target2D } from "./types";

export const SAVED_TREK_KEY = "scan-angka:saved-treks:v2";

export const ANALYSIS_OPTIONS: { value: ScanMode; label: string }[] = [
  { value: "posisi", label: "Trek Posisi" },
  { value: "ai_2d_belakang", label: "AI 2D" },
  { value: "bbfs_2d_belakang", label: "BBFS 2D" },
  { value: "jumlah_2d_belakang", label: "Jumlah 2D" },
  { value: "shio", label: "Shio" },
  { value: "off_posisi", label: "OFF Posisi" },
  { value: "off_2d_belakang", label: "OFF 2D" },
  { value: "off_jumlah_2d_belakang", label: "OFF Jumlah 2D" },
  { value: "off_shio", label: "OFF Shio" },
];

export const POS_OPTIONS: { value: Posisi; label: string }[] = [
  { value: "A", label: "AS" },
  { value: "C", label: "COP" },
  { value: "K", label: "KPL" },
  { value: "E", label: "EKR" },
];

export const TARGET_2D_OPTIONS: { value: Target2D; label: string }[] = [
  { value: "depan", label: "Depan" },
  { value: "tengah", label: "Tengah" },
  { value: "belakang", label: "Belakang" },
];

export const LABEL: Record<Posisi, string> = { A: "AS", C: "COP", K: "KPL", E: "EKR" };

export const ANALYSIS_LABEL: Record<ScanMode, string> = {
  posisi: "Trek Posisi",
  ai_2d_belakang: "AI 2D",
  bbfs_2d_belakang: "BBFS 2D",
  jumlah_2d_belakang: "Jumlah 2D",
  shio: "Shio",
  off_posisi: "OFF Posisi",
  off_2d_belakang: "OFF 2D",
  off_jumlah_2d_belakang: "OFF Jumlah 2D",
  off_shio: "OFF Shio",
};

export const TARGET_2D_LABEL: Record<Target2D, string> = {
  depan: "Depan",
  tengah: "Tengah",
  belakang: "Belakang",
};

export const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
export const SHIO_COLS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"];
export const DIGIT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const NO_BADGE_SELECT_STYLE: CSSProperties = { gridTemplateColumns: "minmax(0,1fr) 24px" };
export const NO_BADGE_OPTION_STYLE: CSSProperties = { gridTemplateColumns: "minmax(0,1fr) auto" };
export const DATA_HINT_FIELD_STYLE: CSSProperties = { position: "relative" };
export const DATA_HINT_INPUT_STYLE: CSSProperties = { paddingRight: 76 };
export const DATA_HINT_STYLE: CSSProperties = {
  position: "absolute",
  right: 12,
  bottom: 14,
  color: "rgba(233,238,245,.34)",
  fontSize: 12,
  fontWeight: 900,
  pointerEvents: "none",
};
export const ROW_ACTIONS_STYLE: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  alignItems: "center",
};
export const SECTION_TITLE_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: "18px 0 10px",
  color: "#e9eef5",
  fontSize: 15,
  fontWeight: 950,
};
export const SECTION_LINE_STYLE: CSSProperties = {
  flex: 1,
  height: 1,
  background: "rgba(255,255,255,.10)",
};
export const SECTION_COUNT_STYLE: CSSProperties = {
  color: "#8b97a8",
  fontSize: 13,
  fontWeight: 900,
};
