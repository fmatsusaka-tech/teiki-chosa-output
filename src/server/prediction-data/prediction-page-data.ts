import type { PredictionMasterBundle } from "../../features/prediction-data/prediction-master.types";
import { createGoogleSheetsPredictionMasterRepository } from "./google-sheets-prediction-master-repository";
import type { PredictionMasterRepository } from "./google-sheets-prediction-master-repository";

export class PredictionPageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionPageConfigurationError";
  }
}

export const createPredictionPageDataLoader = (dependencies: {
  masterRepository: PredictionMasterRepository;
  spreadsheetId: string | undefined;
  expectedDataVersion: string | undefined;
}) => async (): Promise<{ bundle: PredictionMasterBundle; expectedDataVersion: string }> => {
  const { masterRepository, spreadsheetId, expectedDataVersion } = dependencies;
  if (!spreadsheetId || !expectedDataVersion) {
    throw new PredictionPageConfigurationError(
      "予測マスタの接続設定または期待データ版が設定されていません。",
    );
  }

  const bundle = await masterRepository.read({ spreadsheetId, expectedDataVersion });
  return { bundle, expectedDataVersion };
};

export const loadPredictionPageData = (): Promise<{ bundle: PredictionMasterBundle; expectedDataVersion: string }> =>
  createPredictionPageDataLoader({
    masterRepository: createGoogleSheetsPredictionMasterRepository(),
    spreadsheetId: process.env.PREDICTION_MASTER_SPREADSHEET_ID,
    expectedDataVersion: process.env.PREDICTION_MASTER_DATA_VERSION,
  })();
