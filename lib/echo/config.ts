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
  maximumNeighbors: number;
  halfLives: number[];
}

export const ECHO_STATE_WINDOW = 5;
export const ECHO_MIN_HISTORY = 40;
export const ECHO_MIN_TOTAL_DATA = 80;
export const ECHO_MIN_NEIGHBORS = 7;
export const ECHO_MAX_NEIGHBORS = 14;
export const ECHO_RECENT_SIZE = 5;

export function buildEchoEvaluationPlan(totalData: number): EchoEvaluationPlan {
  if (totalData >= 220) {
    return {
      discoveryWindows: [
        { size: 16, weight: 0.4 },
        { size: 32, weight: 0.35 },
        { size: 48, weight: 0.25 },
      ],
      discoverySize: 48,
      validationSize: 16,
      holdoutSize: 16,
      totalRows: 80,
      maximumNeighbors: 14,
      halfLives: [55, 85, 125],
    };
  }

  if (totalData >= 150) {
    return {
      discoveryWindows: [
        { size: 12, weight: 0.4 },
        { size: 24, weight: 0.35 },
        { size: 36, weight: 0.25 },
      ],
      discoverySize: 36,
      validationSize: 12,
      holdoutSize: 12,
      totalRows: 60,
      maximumNeighbors: 14,
      halfLives: [45, 70, 105],
    };
  }

  if (totalData >= 120) {
    return {
      discoveryWindows: [
        { size: 10, weight: 0.4 },
        { size: 20, weight: 0.35 },
        { size: 30, weight: 0.25 },
      ],
      discoverySize: 30,
      validationSize: 10,
      holdoutSize: 10,
      totalRows: 50,
      maximumNeighbors: 12,
      halfLives: [40, 65, 95],
    };
  }

  if (totalData >= 95) {
    return {
      discoveryWindows: [
        { size: 8, weight: 0.4 },
        { size: 16, weight: 0.35 },
        { size: 24, weight: 0.25 },
      ],
      discoverySize: 24,
      validationSize: 8,
      holdoutSize: 8,
      totalRows: 40,
      maximumNeighbors: 11,
      halfLives: [35, 55, 80],
    };
  }

  return {
    discoveryWindows: [
      { size: 6, weight: 0.4 },
      { size: 12, weight: 0.35 },
      { size: 18, weight: 0.25 },
    ],
    discoverySize: 18,
    validationSize: 6,
    holdoutSize: 6,
    totalRows: 30,
    maximumNeighbors: 10,
    halfLives: [30, 48, 70],
  };
}
