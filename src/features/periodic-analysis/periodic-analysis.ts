import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { isIncludedInAnalysis } from "../../contracts/analysis-data";
import { getVarietyCategory } from "../shared/variety-category";
import type { PeriodicAnalysisQuery, PeriodicAnalysisRow, PeriodicAnalysisYearGroup, PreviousDifference } from "./periodic-analysis.types";
import type { PredictionRecordResult } from "../prediction-integration/prediction-integration.types";

type PreparedRecord = {
  record: AnalysisDataRecord;
  periodYear: number;
  periodMonth: number;
  varietyCategory: string;
  measuredTimestamp: number;
  registeredTimestamp: number;
};

const parsePeriodMonth = (value: string): { year: number; month: number } | null => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
};

const toTimestamp = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const prepareRecords = (records: readonly AnalysisDataRecord[], includeNeedsReview: boolean): PreparedRecord[] =>
  records.flatMap((record) => {
    const period = parsePeriodMonth(record.surveyMonth);
    const category = getVarietyCategory(record.variety);
    const measuredTimestamp = toTimestamp(record.measuredAt);
    if (!period || !category || measuredTimestamp === null || !isIncludedInAnalysis(record, { includeNeedsReview })) {
      return [];
    }
    return [{
      record,
      periodYear: period.year,
      periodMonth: period.month,
      varietyCategory: category,
      measuredTimestamp,
      registeredTimestamp: toTimestamp(record.registeredAt) ?? Number.NEGATIVE_INFINITY,
    }];
  });

const compareNewestFirst = (left: PreparedRecord, right: PreparedRecord): number =>
  right.periodYear - left.periodYear
  || right.measuredTimestamp - left.measuredTimestamp
  || right.registeredTimestamp - left.registeredTimestamp
  || left.record.id.localeCompare(right.record.id);

const previousDifference = (current: PreparedRecord, candidates: readonly PreparedRecord[]): PreviousDifference => {
  const empty = (): PreviousDifference => ({
    diameterAverage: null,
    diameterMinimum: null,
    diameterMaximum: null,
    brix: null,
    acidity: null,
    brixAcidityRatio: null,
  });
  if (!current.record.orchard || !current.record.variety) {
    return empty();
  }
  const priorCandidates = candidates
    .filter((candidate) => candidate.record.year === current.record.year
      && candidate.record.orchard === current.record.orchard
      && candidate.record.variety === current.record.variety
      && candidate.record.treatment === current.record.treatment
      && (candidate.record.surveyMonth !== current.record.surveyMonth
        || candidate.record.surveyPeriod !== current.record.surveyPeriod)
      && candidate.measuredTimestamp < current.measuredTimestamp);
  if (priorCandidates.length === 0) {
    return empty();
  }
  const previousTimestamp = Math.max(...priorCandidates.map((candidate) => candidate.measuredTimestamp));
  const previousCandidates = priorCandidates.filter((candidate) => candidate.measuredTimestamp === previousTimestamp);
  if (previousCandidates.length !== 1) {
    return empty();
  }
  const previous = previousCandidates[0];

  const subtract = (currentValue: number | null, previousValue: number | null): number | null =>
    currentValue === null || previousValue === null ? null : currentValue - previousValue;

  return {
    diameterAverage: subtract(current.record.averageDiameter ?? null, previous?.record.averageDiameter ?? null),
    diameterMinimum: subtract(current.record.minimumDiameter ?? null, previous?.record.minimumDiameter ?? null),
    diameterMaximum: subtract(current.record.maximumDiameter ?? null, previous?.record.maximumDiameter ?? null),
    brix: subtract(current.record.brix, previous?.record.brix ?? null),
    acidity: subtract(current.record.acidity, previous?.record.acidity ?? null),
    brixAcidityRatio: subtract(current.record.brixAcidityRatio, previous?.record.brixAcidityRatio ?? null),
  };
};

const toRow = (
  prepared: PreparedRecord,
  candidates: readonly PreparedRecord[],
  predictionIndex: ReadonlyMap<string, PredictionRecordResult>,
): PeriodicAnalysisRow => ({
  registrationId: prepared.record.id,
  periodYear: prepared.periodYear,
  measuredAt: prepared.record.measuredAt ?? "",
  orchard: prepared.record.orchard || null,
  originalOrchard: "originalOrchard" in prepared.record && typeof prepared.record.originalOrchard === "string" ? prepared.record.originalOrchard : prepared.record.orchard || null,
  rawVariety: prepared.record.variety ?? "",
  varietyCategory: prepared.varietyCategory,
  treatment: prepared.record.treatment,
  notes: prepared.record.notes,
  diameterAverage: prepared.record.averageDiameter ?? null,
  diameterMinimum: prepared.record.minimumDiameter ?? null,
  diameterMaximum: prepared.record.maximumDiameter ?? null,
  brix: prepared.record.brix,
  acidity: prepared.record.acidity,
  brixAcidityRatio: prepared.record.brixAcidityRatio,
  previousDifference: previousDifference(prepared, candidates),
  prediction: predictionIndex.get(prepared.record.id) ?? null,
});

export const buildPeriodicAnalysis = (
  records: readonly AnalysisDataRecord[],
  query: PeriodicAnalysisQuery,
  predictions: readonly PredictionRecordResult[] = [],
): PeriodicAnalysisYearGroup[] => {
  const prepared = prepareRecords(records, query.includeNeedsReview ?? false);
  const predictionIndex = new Map(predictions.map((prediction) => [prediction.id, prediction] as const));
  const visible = prepared
    .filter((item) => item.varietyCategory === query.varietyCategory
      && item.periodMonth === query.month
      && item.record.surveyPeriod === query.half
      && (query.orchard === undefined || item.record.orchard === query.orchard)
      && (query.treatment === undefined || item.record.treatment === query.treatment))
    .sort(compareNewestFirst);

  const groups = new Map<number, PeriodicAnalysisRow[]>();
  for (const item of visible) {
    const rows = groups.get(item.periodYear) ?? [];
    rows.push(toRow(item, prepared, predictionIndex));
    groups.set(item.periodYear, rows);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, rows]) => ({ year, rows }));
};
