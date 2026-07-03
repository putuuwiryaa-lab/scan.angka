import type { Posisi, ScanMode, Target2D, Target3D } from "./types";

export const ANALYSIS_OPTIONS: { value: ScanMode; label: string }[] = [
  { value: "posisi", label: "Trek Posisi" },
  { value: "ai_2d_belakang", label: "AI 2D" },
  { value: "bbfs_2d_belakang", label: "BBFS 2D" },
  { value: "jumlah_2d_belakang", label: "Jumlah 2D" },
  { value: "ai_3d", label: "AI 3D" },
  { value: "bbfs_3d", label: "BBFS 3D" },
  { value: "shio", label: "Shio" },
  { value: "off_posisi", label: "OFF Posisi" },
  { value: "off_2d_belakang", label: "OFF 2D" },
  { value: "off_jumlah_2d_belakang", label: "OFF Jumlah 2D" },
  { value: "off_3d", label: "OFF 3D" },
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

export const TARGET_3D_OPTIONS: { value: Target3D; label: string }[] = [
  { value: "depan", label: "Depan" },
  { value: "belakang", label: "Belakang" },
];

export const LABEL: Record<Posisi, string> = { A: "AS", C: "COP", K: "KPL", E: "EKR" };

export const ANALYSIS_LABEL: Record<ScanMode, string> = {
  posisi: "Trek Posisi",
  ai_2d_belakang: "AI 2D",
  bbfs_2d_belakang: "BBFS 2D",
  jumlah_2d_belakang: "Jumlah 2D",
  ai_3d: "AI 3D",
  bbfs_3d: "BBFS 3D",
  shio: "Shio",
  off_posisi: "OFF Posisi",
  off_2d_belakang: "OFF 2D",
  off_jumlah_2d_belakang: "OFF Jumlah 2D",
  off_3d: "OFF 3D",
  off_shio: "OFF Shio",
};

export const TARGET_2D_LABEL: Record<Target2D, string> = {
  depan: "Depan",
  tengah: "Tengah",
  belakang: "Belakang",
};

export const TARGET_3D_LABEL: Record<Target3D, string> = {
  depan: "Depan",
  belakang: "Belakang",
};

export const DIGIT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
