export type BatchResult = {
  title: string;
  copyText: string;
  topRanks?: number[];
  secondary?: boolean;
  results: {
    id: string;
    name: string;
    digits: string;
  }[];
};