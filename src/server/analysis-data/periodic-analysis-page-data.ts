import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildPredictionResults } from "../../features/prediction-integration/prediction-integration";
import type { PredictionMasterBundle } from "../../features/prediction-data/prediction-master.types";
import type { PredictionRecordResult } from "../../features/prediction-integration/prediction-integration.types";

export type PeriodicAnalysisPageData = {
  records: AnalysisDataRecord[];
  predictions: PredictionRecordResult[];
  dataError: string | null;
  predictionError: string | null;
};

export const loadPeriodicAnalysisPageData = async ({
  loadRecords,
  loadPredictionMaster,
  buildPredictions = (records, bundle, expectedDataVersion) => buildPredictionResults(records, bundle, expectedDataVersion).records,
  logError = console.error,
}: {
  loadRecords: () => Promise<AnalysisDataRecord[]>;
  loadPredictionMaster: () => Promise<{ bundle: PredictionMasterBundle; expectedDataVersion: string }>;
  buildPredictions?: (records: readonly AnalysisDataRecord[], bundle: PredictionMasterBundle, expectedDataVersion: string) => PredictionRecordResult[];
  logError?: (message: string, error: unknown) => void;
}): Promise<PeriodicAnalysisPageData> => {
  let records: AnalysisDataRecord[];
  try {
    records = await loadRecords();
  } catch (error) {
    logError("Failed to load analysis data", error);
    return {
      records: [], predictions: [], predictionError: null,
      dataError: "調査データを取得できませんでした。接続設定を確認してください。",
    };
  }

  try {
    const masterData = await loadPredictionMaster();
    const predictions = buildPredictions(records, masterData.bundle, masterData.expectedDataVersion);
    return { records, predictions, dataError: null, predictionError: null };
  } catch (error) {
    logError("Failed to load prediction data for analysis", error);
    return {
      records, predictions: [], dataError: null,
      predictionError: "予測データを取得できませんでした。現在値と前回差は引き続き確認できます。",
    };
  }
};
