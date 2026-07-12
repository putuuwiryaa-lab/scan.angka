export type { BatchAnalysisMode } from "../../lib/shared/batch-analysis";

export type BatchResult = {
  title: string;
  copyText: string;
  lineSeparator?: string;
  topRanks?: number[];
  secondary?: boolean;
  adaptive?: boolean;
  limit?: number;
  results: {
    id: string;
    name: string;
    digits: string;
    released?: boolean;
    method?: string;
    window?: number;
    validation?: string;
  }[];
};
