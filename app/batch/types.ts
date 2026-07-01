export type BatchResult = {
  title: string;
  copyText: string;
  results: {
    id: string;
    name: string;
    digits: string;
  }[];
};
