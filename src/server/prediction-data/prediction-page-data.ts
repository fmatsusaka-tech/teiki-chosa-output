import { createAuthenticatedAnalysisDataRepository } from "../analysis-data/authenticated-analysis-data-repository";
import { buildPredictionResults } from "../../features/prediction-integration/prediction-integration";
import type { PredictionIntegrationResult } from "../../features/prediction-integration/prediction-integration.types";
import { createGoogleSheetsPredictionMasterRepository } from "./google-sheets-prediction-master-repository";
import type { AnalysisDataRepository } from "../../repositories/analysis-data-repository";
import type { PredictionMasterRepository } from "./google-sheets-prediction-master-repository";

export class PredictionPageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionPageConfigurationError";
  }
}

export const createPredictionPageDataLoader = (dependencies: {
  inputRepository: Pick<AnalysisDataRepository, "getAll">;
  masterRepository: PredictionMasterRepository;
  spreadsheetId: string | undefined;
  expectedDataVersion: string | undefined;
}) => async (): Promise<PredictionIntegrationResult> => {
  const { inputRepository, masterRepository, spreadsheetId, expectedDataVersion } = dependencies;
  if (!spreadsheetId || !expectedDataVersion) {
    throw new PredictionPageConfigurationError(
      "予測マスタの接続設定または期待データ版が設定されていません。",
    );
  }

  const [records, bundle] = await Promise.all([
    inputRepository.getAll(),
    masterRepository.read({ spreadsheetId, expectedDataVersion }),
  ]);
  return buildPredictionResults(records, bundle, expectedDataVersion);
};

export const loadPredictionPageData = (): Promise<PredictionIntegrationResult> =>
  createPredictionPageDataLoader({
    inputRepository: createAuthenticatedAnalysisDataRepository(),
    masterRepository: createGoogleSheetsPredictionMasterRepository(),
    spreadsheetId: process.env.PREDICTION_MASTER_SPREADSHEET_ID,
    expectedDataVersion: process.env.PREDICTION_MASTER_DATA_VERSION,
  })();
