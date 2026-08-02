import { createAuthenticatedAnalysisDataRepository } from "../../server/analysis-data/authenticated-analysis-data-repository";
import { loadPeriodicAnalysisPageData } from "../../server/analysis-data/periodic-analysis-page-data";
import { loadPredictionPageData } from "../../server/prediction-data/prediction-page-data";
import { PeriodicAnalysisClient } from "./periodic-analysis-client";

export const dynamic = "force-dynamic";

const getRecords = async () => {
  return loadPeriodicAnalysisPageData({
    loadRecords: () => createAuthenticatedAnalysisDataRepository().getAll(),
    loadPredictionMaster: loadPredictionPageData,
  });
};

export default async function AnalysisPage() {
  const { records, predictions, dataError, predictionError } = await getRecords();
  return <PeriodicAnalysisClient dataError={dataError} predictionError={predictionError} predictions={predictions} records={records} />;
}
