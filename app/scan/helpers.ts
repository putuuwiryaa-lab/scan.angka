import { ANALYSIS_LABEL, COLS, LABEL, SHIO_COLS, TARGET_2D_LABEL, TARGET_3D_LABEL } from "./constants";
import { is3DMode, isJumlah2DMode, isOffMode, isPositionMode, isShioMode, marketTitle } from "../shared/scan-utils";
import type { Market, Posisi, SavedGroup, SavedTrek, ScanItem, ScanMode, ScanRow, Target2D, Target3D } from "./types";

export function pickColumns(columns: string[], deret: number[]) {
  const source: readonly string[] = deret.length === 12 ? SHIO_COLS : COLS;
  return columns.map((column) => deret[source.indexOf(column)]).filter((digit) => Number.isFinite(digit));
}

export function predictionDisplayValues(values: number[], mode: ScanMode) {
  return isJumlah2DMode(mode) ? values.filter((digit) => digit !== 0) : values;
}

export function isSingapore(market: Market) {
  const text = `${market.id} ${market.name ?? ""}`.toLowerCase();
  return text.includes("singapore") || text.includes("sgp");
}

export function formatSyncTime(value: string | null) {
  if (!value) return "Sinkron data belum tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sinkron data belum tersedia";
  return `Terakhir sinkron data: ${date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function shioLabel(value: number) {
  return String(value + 1).padStart(2, "0");
}

export function labelValue(value: number, mode: ScanMode) {
  return isShioMode(mode) ? shioLabel(value) : String(value);
}

export function labelsFromValues(values: number[], mode: ScanMode) {
  return values.map((value) => labelValue(value, mode));
}

export function joinValues(values: number[], mode: ScanMode) {
  return labelsFromValues(values, mode).join(isShioMode(mode) ? "-" : "");
}

export function targetDigits(row: ScanRow) {
  return row.targetDigits?.length ? row.targetDigits : [row.targetDigit];
}

export function rowValues(item: ScanItem, row: ScanRow) {
  const targets = targetDigits(row);
  return pickColumns(item.kolomHidup, row.deret).map((digit) => ({ digit, hit: targets.includes(digit) }));
}

export function savedRowValues(saved: SavedTrek, row: ScanRow) {
  const targets = targetDigits(row);
  return pickColumns(saved.kolomHidup, row.deret).map((digit) => ({ digit, hit: targets.includes(digit) }));
}

export function rowText(item: ScanItem, row: ScanRow) {
  return joinValues(rowValues(item, row).map(({ digit }) => digit), item.scanMode);
}

function hitCount(targets: number[], values: number[]) {
  return targets.filter((digit) => values.includes(digit)).length;
}

export function statusFor(mode: ScanMode, targets: number[], values: number[]) {
  if (isOffMode(mode)) return values.some((digit) => targets.includes(digit)) ? "❌" : "✅";
  if (mode === "bbfs_2d_belakang" || mode === "bbfs_3d") return targets.every((digit) => values.includes(digit)) ? "✅" : "❌";
  if (mode === "ai_3d") return hitCount(targets, values) >= Math.min(2, targets.length) ? "✅" : "❌";
  return values.some((digit) => targets.includes(digit)) ? "✅" : "❌";
}

export function rowStatus(item: ScanItem, row: ScanRow) {
  return statusFor(item.scanMode, targetDigits(row), rowValues(item, row).map(({ digit }) => digit));
}

export function savedRowStatus(saved: SavedTrek, row: ScanRow) {
  return statusFor(saved.scanMode, targetDigits(row), savedRowValues(saved, row).map(({ digit }) => digit));
}

export function predictionValues(item: ScanItem) {
  return predictionDisplayValues(pickColumns(item.kolomHidup, item.result.deretLive), item.scanMode);
}

export function predictionResult(item: ScanItem) {
  return joinValues(predictionValues(item), item.scanMode);
}

export function target3DOf(value?: Target3D) {
  return value === "depan" || value === "belakang" ? value : "belakang";
}

export function analysisTitle(mode: ScanMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D = "belakang") {
  if (isPositionMode(mode)) return `${ANALYSIS_LABEL[mode]} ${LABEL[targetPos]}`;
  if (is3DMode(mode)) return `${ANALYSIS_LABEL[mode]} ${TARGET_3D_LABEL[target3D]}`;
  return `${ANALYSIS_LABEL[mode]} ${TARGET_2D_LABEL[target2D]}`;
}

export function scanDescription(mode: ScanMode, targetPos: Posisi, target2D: Target2D, count: number, target3D: Target3D = "belakang") {
  const unit = isShioMode(mode) ? "shio" : "digit";
  return `${analysisTitle(mode, targetPos, target2D, target3D)} ${count} ${unit}`;
}

export function savedDescription(saved: SavedTrek) {
  return `${scanDescription(saved.scanMode, saved.targetPos, saved.target2D, saved.digitCount, target3DOf(saved.target3D))} · ${saved.L} data · kolom ${saved.activeColumns}`;
}

export function detailHeaderTitle(marketName: string, selectedMarket: Market | null) {
  return (marketName || (selectedMarket ? marketTitle(selectedMarket) : "Pasaran")).toUpperCase();
}

export function buildCopyText(item: ScanItem, rows: ScanRow[], nextPrediction: string, title: string, description: string) {
  const header = [`*${title}*`, description];
  const history = rows.map((row) => `${row.displayDraw} ➜ ${rowText(item, row)} ${rowStatus(item, row)}`);
  const next = `${item.result.latestDraw} ➜ ${nextPrediction} ??`;
  return [...header, "", ...history, next].join("\n");
}

export function savedSignature(item: ScanItem, marketId: string) {
  return `${marketId}:${item.result.latestDraw}:${item.scanMode}:${item.targetPos}:${item.target2D}:${item.target3D}:${item.formula}`;
}

export function buildSavedGroups(savedTreks: SavedTrek[]): SavedGroup[] {
  const groups: SavedGroup[] = [];
  for (const item of savedTreks) {
    const target3D = target3DOf(item.target3D);
    const key = `${item.marketName}:${item.scanMode}:${item.targetPos}:${item.target2D}:${target3D}:${item.digitCount}:${item.L}`;
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.push({
      key,
      marketName: item.marketName,
      scanMode: item.scanMode,
      targetPos: item.targetPos,
      target2D: item.target2D,
      target3D,
      digitCount: item.digitCount,
      L: item.L,
      items: [item],
    });
  }
  return groups;
}
