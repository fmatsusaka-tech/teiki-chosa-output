import type { PredictionRecordResult } from "../prediction-integration/prediction-integration.types";

export type SurveyHalf = "前半" | "後半";

export type PeriodicAnalysisQuery = {
  varietyCategory: string;
  month: number;
  half: SurveyHalf;
  orchard?: string;
  treatment?: string;
  includeNeedsReview?: boolean;
};

export type PreviousDifference = {
  diameterAverage: number | null;
  diameterMinimum: number | null;
  diameterMaximum: number | null;
  brix: number | null;
  acidity: number | null;
  brixAcidityRatio: number | null;
};

export type PeriodicAnalysisRow = {
  registrationId: string;
  periodYear: number;
  measuredAt: string;
  orchard: string | null;
  originalOrchard: string | null;
  rawVariety: string;
  varietyCategory: string;
  treatment: string | null;
  notes: string | null;
  diameterAverage: number | null;
  diameterMinimum: number | null;
  diameterMaximum: number | null;
  brix: number | null;
  acidity: number | null;
  brixAcidityRatio: number | null;
  previousDifference: PreviousDifference;
  prediction: PredictionRecordResult | null;
};

export type PeriodicAnalysisYearGroup = {
  year: number;
  rows: PeriodicAnalysisRow[];
};
