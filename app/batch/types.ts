export type BatchResult = {
  title: string;
  copyText: string;
  stopScan?: number;
  secondary?: boolean;
  results: {
    id: string;
    name: string;
    digits: string;
  }[];
};