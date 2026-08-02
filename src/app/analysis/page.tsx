import { createAuthenticatedAnalysisDataRepository } from "../../server/analysis-data/authenticated-analysis-data-repository";
import { loadPeriodicAnalysisPageData } from "../../server/analysis-data/periodic-analysis-page-data";
import { loadNormalizedAnalysisRecords } from "../../server/orchard-master/normalized-analysis-records";
import { loadPredictionPageData } from "../../server/prediction-data/prediction-page-data";
import { loadKishoWeatherRecords } from "../../server/weather/kisho-weather-repository";
import type { DailyWeatherRecord } from "../../features/weather/weather-30-day";
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
  const normalized = dataError ? { records, orchardMasterWarning: null } : await loadNormalizedAnalysisRecords(records);
  let weatherRecords: DailyWeatherRecord[] = [];
  let weatherWarning: string | null = null;
  try {
    weatherRecords = await loadKishoWeatherRecords();
  } catch (error) {
    console.error("Failed to load weather data for analysis", error);
    weatherWarning = "気象データを取得できませんでした。調査値と予測値は引き続き確認できます。";
  }
  return <PeriodicAnalysisClient dataError={dataError} orchardMasterWarning={normalized.orchardMasterWarning} predictionError={predictionError} predictions={predictions} records={normalized.records} weatherRecords={weatherRecords} weatherWarning={weatherWarning} />;
}
