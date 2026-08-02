import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import type { PredictionMetric } from "../prediction-data/prediction-master.types";

export type PredictionNonCalculationCode =
  | "EMPTY_VARIETY"
  | "UNREGISTERED_VARIETY"
  | "MODEL_NOT_FOUND"
  | "INACTIVE_MODEL"
  | "MISSING_MEASURED_AT"
  | "TARGET_DATE_EXCEEDED"
  | "INVALID_MEASURED_VALUE"
  | "MEASURED_COEFFICIENT_NOT_FOUND"
  | "TARGET_COEFFICIENT_NOT_FOUND"
  | "CALCULATION_FAILED";

export type PredictionMetricResult =
  | {
      ok: true;
      metric: PredictionMetric;
      measuredValue: number;
      predictedValue: number;
      rawPrediction: number;
      measuredSourceSheet: string;
      measuredSourceCell: string;
      targetSourceSheet: string;
      targetSourceCell: string;
    }
  | {
      ok: false;
      metric: PredictionMetric;
      reason: PredictionNonCalculationCode;
      message: string;
    };

export type PredictionRecordResult = {
  id: string;
  fiscalYear: number;
  measuredYear: number;
  orchard: string | null;
  variety: string | null;
  treatment: string | null;
  measuredAt: string | null;
  predictionModel: string | null;
  targetMonthDay: string | null;
  dataVersion: string;
  metrics: Record<PredictionMetric, PredictionMetricResult>;
};

export type PredictionIntegrationSummary = {
  inputCount: number;
  selectableModelCount: number;
  unregisteredVarietyCount: number;
  emptyVarietyCount: number;
  targetDateExceededCount: number;
  calculableByMetric: Record<PredictionMetric, number>;
  missingMeasuredCoefficientByMetric: Record<PredictionMetric, number>;
};

export type PredictionIntegrationResult = {
  records: PredictionRecordResult[];
  summary: PredictionIntegrationSummary;
};

export type PredictionInputRecord = Readonly<AnalysisDataRecord>;
