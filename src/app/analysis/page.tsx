import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildPredictionResults } from "../../features/prediction-integration/prediction-integration";
import type { PredictionRecordResult } from "../../features/prediction-integration/prediction-integration.types";
import { createAuthenticatedAnalysisDataRepository } from "../../server/analysis-data/authenticated-analysis-data-repository";
import { loadPredictionPageData } from "../../server/prediction-data/prediction-page-data";
import { PeriodicAnalysisClient } from "./periodic-analysis-client";

export const dynamic = "force-dynamic";

const getRecords = async (): Promise<{
  records: AnalysisDataRecord[];
  predictions: PredictionRecordResult[];
  error: string | null;
}> => {
  try {
    const repository = createAuthenticatedAnalysisDataRepository();
    const [records, masterData] = await Promise.all([repository.getAll(), loadPredictionPageData()]);
    const predictions = buildPredictionResults(records, masterData.bundle, masterData.expectedDataVersion).records;
    return { records, predictions, error: null };
  } catch (error) {
    console.error("Failed to load analysis data", error);
    return {
      records: [],
      predictions: [],
      error: "調査データまたは予測マスタを取得できませんでした。接続設定とデータ版を確認してください。",
    };
  }
};

export default async function AnalysisPage() {
  const { records, predictions, error } = await getRecords();
  return <PeriodicAnalysisClient dataError={error} predictions={predictions} records={records} />;
}
