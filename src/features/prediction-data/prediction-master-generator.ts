import { sortPredictionMasterBundle } from "./prediction-master-contract";
import { extractPredictionMasters } from "./prediction-master-extractor";
import {
  validateExtractedModelConsistency,
  validatePredictionMasters,
} from "./prediction-master-validator";
import type {
  LegacyPredictionSheet,
  PredictionMasterBundle,
} from "./prediction-master.types";

export const generatePredictionMasters = (
  sheets: readonly LegacyPredictionSheet[],
  dataVersion: string,
  generatedAt: string,
): PredictionMasterBundle => {
  const extracted = extractPredictionMasters(sheets, dataVersion, generatedAt);
  validateExtractedModelConsistency(extracted.models);
  const models = [
    ...new Map(
      extracted.models.map((model) => [model.predictionModel, model]),
    ).values(),
  ];
  const bundle = sortPredictionMasterBundle({
    models,
    coefficients: extracted.coefficients,
  });
  validatePredictionMasters(bundle, dataVersion);
  return bundle;
};
