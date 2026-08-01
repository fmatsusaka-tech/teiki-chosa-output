import type {
  PredictionCoefficientMaster,
  PredictionMetric,
  PredictionModelMaster,
} from "../prediction-data/prediction-master.types";

export type PredictionCalculationInput = {
  readonly metric: PredictionMetric;
  readonly predictionModel: string;
  readonly measuredValue: number;
  readonly measuredMonthDay: string;
  readonly targetMonthDay: string;
  readonly model: Readonly<PredictionModelMaster>;
  readonly measuredCoefficient: Readonly<PredictionCoefficientMaster>;
  readonly targetCoefficient: Readonly<PredictionCoefficientMaster>;
  readonly expectedDataVersion: string;
};

export type PredictionCalculationResult = {
  metric: PredictionMetric;
  predictionModel: string;
  measuredValue: number;
  measuredMonthDay: string;
  measuredCoefficient: number;
  measuredSourceSheet: string;
  measuredSourceCell: string;
  targetMonthDay: string;
  targetCoefficient: number;
  targetSourceSheet: string;
  targetSourceCell: string;
  rawPrediction: number;
  dataVersion: string;
};

export type PredictionCalculationErrorCode =
  | "INVALID_MEASURED_VALUE"
  | "INVALID_MEASURED_COEFFICIENT"
  | "INVALID_TARGET_COEFFICIENT"
  | "INACTIVE_MODEL"
  | "MODEL_MISMATCH"
  | "METRIC_MISMATCH"
  | "MEASURED_MONTH_DAY_MISMATCH"
  | "TARGET_MONTH_DAY_MISMATCH"
  | "DATA_VERSION_MISMATCH"
  | "INVALID_PREDICTION_RESULT";

export type PredictionCalculationError = {
  code: PredictionCalculationErrorCode;
  message: string;
};

export type PredictionCalculationOutcome =
  | { ok: true; result: PredictionCalculationResult }
  | { ok: false; error: PredictionCalculationError };
