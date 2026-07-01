import { ANALYSIS_LABEL, COLS, LABEL, SHIO_COLS, TARGET_2D_LABEL } from "./constants";
import { isOffMode, isPositionMode, isShioMode, marketTitle } from "../shared/scan-utils";
import type { Market, Posisi, SavedGroup, SavedTrek, ScanItem, ScanMode, ScanRow, Target2D } from "./types";

export function pickColumns(columns: string[], deret: number[]) {
  const source = deret.length === 12 ? SHIO_COLS : COLS;
  return columns.map((column) => deret[source.indexOf(column)]).filter((digit) => Number.isFinite(digit));
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

export function statusFor(mode: ScanMode, targets: number[], values: number[]) {
  if (isOffMode(mode)) return values.some((digit) => targets.includes(digit)) ? "❌" : "✅";
  if (mode === "bbfs_2d_belakang") return targets.every((digit) => values.includes(digit)) ? "✅" : "❌";
  return values.some((digit) => targets.includes(digit)) ? "✅" : "❌";
}

export function rowStatus(item: ScanItem, row: ScanRow) {
  return statusFor(item.scanMode, targetDigits(row), rowValues(item, row).map(({ digit }) => digit));
}

export function savedRowStatus(saved: SavedTrek, row: ScanRow) {
  return statusFor(saved.scanMode, targetDigits(row), savedRowValues(saved, row).map(({ digit }) => digit));
}

export function predictionValues(item: ScanItem) {
  return pickColumns(item.kolomHidup, item.result.deretLive);
}

export function predictionResult(item: ScanItem) {
  return joinValues(predictionValues(item), item.scanMode);
}

export function analysisTitle(mode: ScanMode, targetPos: Posisi, target2D: Target2D) {
  if (isPositionMode(mode)) return `${ANALYSIS_LABEL[mode]} ${LABEL[targetPos]}`;
  return `${ANALYSIS_LABEL[mode]} ${TARGET_2D_LABEL[target2D]}`;
}

export function scanDescription(mode: ScanMode, targetPos: Posisi, target2D: Target2D, count: number) {
  const unit = isShioMode(mode) ? "shio" : "digit";
  return `${analysisTitle(mode, targetPos, target2D)} ${count} ${unit}`;
}

export function savedDescription(saved: SavedTrek) {
  return `${scanDescription(saved.scanMode, saved.targetPos, saved.target2D, saved.digitCount)} · ${saved.L} data · kolom ${saved.activeColumns}`;
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
  return `${marketId}:${item.result.latestDraw}:${item.scanMode}:${item.targetPos}:${item.target2D}:${item.formula}`;
}

export function buildSavedGroups(savedTreks: SavedTrek[]): SavedGroup[] {
  const groups: SavedGroup[] = [];
  for (const item of savedTreks) {
    const key = `${item.marketName}:${item.scanMode}:${item.targetPos}:${item.target2D}:${item.digitCount}:${item.L}`;
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
      digitCount: item.digitCount,
      L: item.L,
      items: [item],
    });
  }
  return groups;
}
