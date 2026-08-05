import type { PeriodicAnalysisRow } from "./periodic-analysis.types";
import { formatDifference } from "./periodic-analysis-display";
import type { PredictionMetricResult } from "../prediction-integration/prediction-integration.types";
import { aggregateWeather30Days, type DailyWeatherRecord, type WeatherMetricOutcome } from "../weather/weather-30-day";

export const displayNumber = (value: number | null, digits: number): string => value === null ? "—" : value.toFixed(digits);
export const displayPrediction = (result: PredictionMetricResult | undefined, digits: number): string => {
  if (!result) return "—";
  return result.ok ? result.predictedValue.toFixed(digits) : `— ${result.message}`;
};
export const displayDay = (value: string): string => {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${Number(match[2])}日` : "—";
};

export type ColumnKey = "diameter" | "diameterDifference" | "diameterPrediction"
  | "minimumDiameter" | "minimumDiameterDifference"
  | "maximumDiameter" | "maximumDiameterDifference"
  | "brix" | "brixDifference" | "brixPrediction"
  | "acidity" | "acidityDifference" | "acidityPrediction"
  | "brixAcidityRatio" | "brixAcidityRatioDifference"
  | "rainfall30Days" | "temperature30Days"
  | "notes";

export type RainfallStation = "yuasa" | "kawabe";
export type ColumnContext = { rainfallStation: RainfallStation; weatherRecords: readonly DailyWeatherRecord[] };
export type MetricTone = "diameter" | "brix" | "acidity";

export const displayWeather = (outcome: WeatherMetricOutcome, digits: number): string => outcome.ok ? outcome.value.toFixed(digits) : "—";

export const columns: Record<ColumnKey, { label: string; width: number; tone?: MetricTone; value: (record: PeriodicAnalysisRow, context: ColumnContext) => string; differenceValue?: (record: PeriodicAnalysisRow) => number | null }> = {
  diameter: { label: "平均横径", width: 70, tone: "diameter", value: (record) => displayNumber(record.diameterAverage, 1) },
  diameterDifference: { label: "前回差", width: 58, tone: "diameter", value: (record) => formatDifference(record.previousDifference.diameterAverage, 1).text, differenceValue: (record) => record.previousDifference.diameterAverage },
  diameterPrediction: { label: "収穫時予測", width: 96, tone: "diameter", value: (record) => displayPrediction(record.prediction?.metrics.横径, 1) },
  brix: { label: "糖度", width: 58, tone: "brix", value: (record) => displayNumber(record.brix, 1) },
  brixDifference: { label: "前回差", width: 58, tone: "brix", value: (record) => formatDifference(record.previousDifference.brix, 1).text, differenceValue: (record) => record.previousDifference.brix },
  brixPrediction: { label: "収穫時予測", width: 96, tone: "brix", value: (record) => displayPrediction(record.prediction?.metrics.糖度, 1) },
  acidity: { label: "クエン酸", width: 68, tone: "acidity", value: (record) => displayNumber(record.acidity, 2) },
  acidityDifference: { label: "前回差", width: 58, tone: "acidity", value: (record) => formatDifference(record.previousDifference.acidity, 2).text, differenceValue: (record) => record.previousDifference.acidity },
  acidityPrediction: { label: "収穫時予測", width: 96, tone: "acidity", value: (record) => displayPrediction(record.prediction?.metrics.クエン酸, 2) },
  brixAcidityRatio: { label: "糖酸比", width: 62, value: (record) => displayNumber(record.brixAcidityRatio, 1) },
  brixAcidityRatioDifference: { label: "前回差", width: 58, value: (record) => formatDifference(record.previousDifference.brixAcidityRatio, 1).text, differenceValue: (record) => record.previousDifference.brixAcidityRatio },
  rainfall30Days: { label: "30日降水量", width: 88, value: (record, context) => displayWeather(aggregateWeather30Days({ measuredAt: record.measuredAt, precipitationStationId: context.rainfallStation, temperatureStationId: "kawabe", records: context.weatherRecords }).precipitation, 1) },
  temperature30Days: { label: "30日平均気温", width: 96, value: (record, context) => displayWeather(aggregateWeather30Days({ measuredAt: record.measuredAt, precipitationStationId: context.rainfallStation, temperatureStationId: "kawabe", records: context.weatherRecords }).meanTemperature, 1) },
  minimumDiameter: { label: "最小横径", width: 70, tone: "diameter", value: (record) => displayNumber(record.diameterMinimum, 1) },
  minimumDiameterDifference: { label: "前回差", width: 58, tone: "diameter", value: (record) => formatDifference(record.previousDifference.diameterMinimum, 1).text, differenceValue: (record) => record.previousDifference.diameterMinimum },
  maximumDiameter: { label: "最大横径", width: 70, tone: "diameter", value: (record) => displayNumber(record.diameterMaximum, 1) },
  maximumDiameterDifference: { label: "前回差", width: 58, tone: "diameter", value: (record) => formatDifference(record.previousDifference.diameterMaximum, 1).text, differenceValue: (record) => record.previousDifference.diameterMaximum },
  notes: { label: "備考", width: 110, value: (record) => record.notes ?? "—" },
};

export const initialColumns = Object.fromEntries(
  (Object.keys(columns) as ColumnKey[]).map((column) => [column, true]),
) as Record<ColumnKey, boolean>;
