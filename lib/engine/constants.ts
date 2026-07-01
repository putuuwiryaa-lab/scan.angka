import type { Posisi } from "./types";

export const POSISI: Posisi[] = ["A", "C", "K", "E"];
export const OFFSET_LIST = [0, 1, 2, -1, -2, 3, 4, 5, -3, -4, -5];
export const EXTENDED_OFFSET_LIST = [1, 2, -1, -2];
export const CROSS_N_LIST = [1, 2, 3];
export const COMBO_PAIRS: [Posisi, Posisi][] = [["A", "C"], ["A", "K"], ["A", "E"], ["C", "K"], ["C", "E"], ["K", "E"]];
export const COMBO_TRIPLES: [Posisi, Posisi, Posisi][] = [["A", "C", "K"], ["A", "C", "E"], ["A", "K", "E"], ["C", "K", "E"]];
export const TREK_PAIRS: [Posisi, Posisi][] = [["A", "C"], ["C", "K"], ["K", "E"]];
export const TESSON_MAP = [7, 4, 9, 6, 1, 8, 3, 0, 5, 2];
export const MIRROR_MAP = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
export const DEFAULT_DIGIT_COUNT = 7;
