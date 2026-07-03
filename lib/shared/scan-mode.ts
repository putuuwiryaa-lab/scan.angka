export const SCAN_MODES = [
  "posisi",
  "ai_2d_belakang",
  "bbfs_2d_belakang",
  "jumlah_2d_belakang",
  "ai_3d",
  "bbfs_3d",
  "off_posisi",
  "off_2d_belakang",
  "off_jumlah_2d_belakang",
  "off_3d",
  "shio",
  "off_shio",
] as const;

export type ScanMode = (typeof SCAN_MODES)[number];

export function isScanMode(value: unknown): value is ScanMode {
  return typeof value === "string" && (SCAN_MODES as readonly string[]).includes(value);
}

export function isPositionMode(mode: ScanMode) {
  return mode === "posisi" || mode === "off_posisi";
}

export function isOffMode(mode: ScanMode) {
  return mode === "off_posisi" || mode === "off_2d_belakang" || mode === "off_jumlah_2d_belakang" || mode === "off_3d" || mode === "off_shio";
}

export function isJumlah2DMode(mode: ScanMode) {
  return mode === "jumlah_2d_belakang" || mode === "off_jumlah_2d_belakang";
}

export function is3DMode(mode: ScanMode) {
  return mode === "ai_3d" || mode === "bbfs_3d" || mode === "off_3d";
}

export function isAi3DMode(mode: ScanMode) {
  return mode === "ai_3d";
}

export function isBbfs3DMode(mode: ScanMode) {
  return mode === "bbfs_3d";
}

export function isOff3DMode(mode: ScanMode) {
  return mode === "off_3d";
}

export function isShioMode(mode: ScanMode) {
  return mode === "shio" || mode === "off_shio";
}
