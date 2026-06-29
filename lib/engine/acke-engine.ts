import type {
  AckeResult,
  AuditRow,
  ColumnLabel,
  ColumnResult,
  FormulaCode,
  Market,
  PositionCode,
} from "./types";

export const POSITION_LABEL: Record<PositionCode, string> = {
  A: "AS",
  C: "COP",
  K: "KPL",
  E: "EKR",
};

export const POSITION_INDEX: Record<PositionCode, number> = {
  A: 0,
  C: 1,
  K: 2,
  E: 3,
};

export const COLUMN_LABELS: ColumnLabel[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export function parseHistoryData(historyData: string | null | undefined): string[] {
  return String(historyData || "")
    .trim()
    .split(/[\s,;|]+/)
    .map((token) => token.trim())
    .filter((token) => /^\d{4}$/.test(token));
}

export function parseFormula(formula: string): { source: PositionCode; lag: number } {
  const match = /^([ACKE])([1-9])$/.exec(formula.trim().toUpperCase());

  if (!match) {
    throw new Error("Rumus harus berformat A1-A9, C1-C9, K1-K9, atau E1-E9.");
  }

  return {
    source: match[1] as PositionCode,
    lag: Number(match[2]),
  };
}

export function clampRounds(value: unknown): number {
  const numberValue = Number(value || 15);
  if (!Number.isFinite(numberValue)) return 15;
  return Math.max(1, Math.min(100, Math.trunc(numberValue)));
}

export function digitAt(result: string, position: PositionCode): number {
  const digit = Number(result[POSITION_INDEX[position]]);
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    throw new Error(`Result ${result} tidak valid untuk posisi ${position}.`);
  }
  return digit;
}

export function columnFromDigits(sourceDigit: number, targetDigit: number): ColumnLabel {
  const index = (targetDigit - sourceDigit + 10) % 10;
  return COLUMN_LABELS[index];
}

export function digitFromColumn(sourceDigit: number, columnIndex: number): number {
  return (sourceDigit + columnIndex) % 10;
}

export function normalizeMarketCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

export function makeFormulaOptions(): FormulaCode[] {
  const positions: PositionCode[] = ["A", "C", "K", "E"];
  return positions.flatMap((position) =>
    Array.from({ length: 9 }, (_, index) => `${position}${index + 1}` as FormulaCode),
  );
}

export function runAckeAnalysis(params: {
  market: Market;
  target: PositionCode;
  formula: FormulaCode;
  rounds: number;
}): AckeResult {
  const { market, target, formula } = params;
  const rounds = clampRounds(params.rounds);
  const { source, lag } = parseFormula(formula);
  const results = parseHistoryData(market.history_data);

  if (results.length === 0) {
    throw new Error("Data result kosong.");
  }

  const needed = rounds + lag;
  if (results.length < needed) {
    throw new Error(`Data result kurang. Butuh minimal ${needed} result untuk ${formula} L${rounds}.`);
  }

  const hitMap = new Map<ColumnLabel, number>(COLUMN_LABELS.map((label) => [label, 0]));
  const rows: AuditRow[] = [];
  const startTargetIndex = results.length - rounds;

  for (let targetIndex = startTargetIndex; targetIndex < results.length; targetIndex += 1) {
    const sourceIndex = targetIndex - lag;
    const targetResult = results[targetIndex];
    const sourceResult = results[sourceIndex];
    const sourceDigit = digitAt(sourceResult, source);
    const targetDigit = digitAt(targetResult, target);
    const column = columnFromDigits(sourceDigit, targetDigit);

    hitMap.set(column, (hitMap.get(column) || 0) + 1);
    rows.push({
      no: rows.length + 1,
      targetResult,
      sourceResult,
      sourceDigit,
      targetDigit,
      column,
    });
  }

  const predictionSourceIndex = results.length - lag;
  const sourceLatestResult = results[predictionSourceIndex];
  const sourceLatestDigit = digitAt(sourceLatestResult, source);

  const columns: ColumnResult[] = COLUMN_LABELS.map((label, index) => {
    const hits = hitMap.get(label) || 0;
    return {
      label,
      index,
      hits,
      currentDigit: digitFromColumn(sourceLatestDigit, index),
      weak: hits === 0,
    };
  });

  const weakColumns = columns.filter((column) => column.weak).map((column) => column.label);
  const weakDigits = columns
    .filter((column) => column.weak && column.currentDigit !== null)
    .map((column) => Number(column.currentDigit));
  const activeColumns = columns
    .filter((column) => !column.weak)
    .map((column) => column.label)
    .join("");
  const marketCode = normalizeMarketCode(market.id || market.name || "MARKET");
  const targetCode = target.toLowerCase();
  const code = `#${marketCode}_${targetCode}_${formula}_L${rounds}-P0-D0_${activeColumns || "-"}`;

  return {
    marketId: market.id,
    marketName: market.name || market.id,
    target,
    formula,
    rounds,
    totalResults: results.length,
    latestResult: results[results.length - 1],
    sourceLatestResult,
    sourceLatestDigit,
    activeColumns,
    weakColumns,
    weakDigits,
    code,
    columns,
    rows,
  };
}
