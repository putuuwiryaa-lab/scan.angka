export type BatchResult = {
  title: string;
  copyText: string;
  stopScan?: number;
  results: {
    id: string;
    name: string;
    digits: string;
  }[];
};