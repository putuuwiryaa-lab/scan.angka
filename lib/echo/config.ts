export interface EchoWindowSpec {
  size: number;
  weight: number;
}

export interface EchoEvaluationPlan {
  discoveryWindows: EchoWindowSpec[];
  discoverySize: number;
  validationSize: number;
  holdoutSize: number;
  totalRows: number;
  referenceWindow: number;
  maximumNeighbors: number;
  halfLives: number[];
}

export const ECHO_STATE_WINDOW = 5;
export const ECHO_MIN_HISTORY = 30;
export const ECHO_MIN_TOTAL_DATA = 80;
export const ECHO_MIN_NEIGHBORS = 7;
export const ECHO_MAX_NEIGHBORS = 12;
export const ECHO_RECENT_SIZE = 5;

export function buildEchoEvaluationPlan(totalData: number): EchoEvaluationPlan {
  if (totalData >= 150) {
    return {
      discoveryWindows: [
        { size: 12, weight: 0.5 },
        { size: 24, weight: 0.3 },
        { size: 36, weight: 0.2 },
      ],
      discoverySize: 36,
      validationSize: 12,
      holdoutSize: 12,
      totalRows: 60,
      referenceWindow: 60,
      maximumNeighbors: 12,
      halfLives: [10, 18, 30],
    };
  }

  if (totalData >= 120) {
    return {
      discoveryWindows: [
        { size: 10, weight: 0.5 },
        { size: 20, weight: 0.3 },
        { size: 30, weight: 0.2 },
      ],
      discoverySize: 30,
      validationSize: 10,
      holdoutSize: 10,
      totalRows: 50,
      referenceWindow: 54,
      maximumNeighbors: 11,
      halfLives: [9, 16, 26],
    };
  }

  if (totalData >= 95) {
    return {
      discoveryWindows: [
        { size: 8, weight: 0.5 },
        { size: 16, weight: 0.3 },
        { size: 24, weight: 0.2 },
      ],
      discoverySize: 24,
      validationSize: 8,
      holdoutSize: 8,
      totalRows: 40,
      referenceWindow: 45,
      maximumNeighbors: 10,
      halfLives: [8, 14, 22],
    };
  }

  return {
    discoveryWindows: [
      { size: 6, weight: 0.5 },
      { size: 12, weight: 0.3 },
      { size: 18, weight: 0.2 },
    ],
    discoverySize: 18,
    validationSize: 6,
    holdoutSize: 6,
    totalRows: 30,
    referenceWindow: 36,
    maximumNeighbors: 9,
    halfLives: [7, 12, 18],
  };
}
