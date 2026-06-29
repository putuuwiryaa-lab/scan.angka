export type PositionCode = "A" | "C" | "K" | "E";

export type FormulaCode = `${PositionCode}${number}`;

export type Market = {
  id: string;
  name: string | null;
  history_data: string | null;
  order: number | null;
  updated_at: string | null;
};

export type ColumnLabel = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";

export type ColumnResult = {
  label: ColumnLabel;
  index: number;
  hits: number;
  currentDigit: number | null;
  weak: boolean;
};

export type AuditRow = {
  no: number;
  targetResult: string;
  sourceResult: string;
  sourceDigit: number;
  targetDigit: number;
  column: ColumnLabel;
};

export type AckeRequest = {
  marketId: string;
  target: PositionCode;
  formula: FormulaCode;
  rounds: number;
};

export type AckeResult = {
  marketId: string;
  marketName: string;
  target: PositionCode;
  formula: FormulaCode;
  rounds: number;
  totalResults: number;
  latestResult: string;
  sourceLatestResult: string;
  sourceLatestDigit: number;
  activeColumns: string;
  weakColumns: ColumnLabel[];
  weakDigits: number[];
  code: string;
  columns: ColumnResult[];
  rows: AuditRow[];
};
