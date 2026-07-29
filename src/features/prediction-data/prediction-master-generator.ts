import { extractPredictionMasters } from "./prediction-master-extractor";
import { validatePredictionMasters } from "./prediction-master-validator";
import type {
  LegacyPredictionSheet,
  PredictionMasterBundle,
} from "./prediction-master.types";

export const generatePredictionMasters = (
  sheets: readonly LegacyPredictionSheet[],
  dataVersion: string,
  generatedAt: string,
): PredictionMasterBundle => {
  const extracted = extractPredictionMasters(
    sheets,
    dataVersion,
    generatedAt,
  );
  const models = [
    ...new Map(
      extracted.models.map((model) => [model.predictionModel, model]),
    ).values(),
  ];
  const bundle = { models, coefficients: extracted.coefficients };
  validatePredictionMasters(bundle);
  return bundle;
};
