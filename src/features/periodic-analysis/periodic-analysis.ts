import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { getVarietyCategory } from "./variety-category";
import type { PeriodicAnalysisQuery, PeriodicAnalysisRow, PeriodicAnalysisYearGroup, PreviousDifference } from "./periodic-analysis.types";

type PreparedRecord = {
  record: AnalysisDataRecord;
  periodYear: number;
  periodMonth: number;
  varietyCategory: string;
  measuredTimestamp: number;
  registeredTimestamp: number;
};

const displayableStatuses = new Set(["正常", "横径なし", "糖度なし", "酸度なし"]);

const parsePeriodMonth = (value: string): { year: number; month: number } | null => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
};

const toTimestamp = (value: string): number | null => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isDisplayable = (status: string, includeNeedsReview: boolean): boolean =>
  displayableStatuses.has(status) || (includeNeedsReview && status === "要確認");

const prepareRecords = (records: readonly AnalysisDataRecord[], includeNeedsReview: boolean): PreparedRecord[] =>
  records.flatMap((record) => {
    const period = parsePeriodMonth(record.surveyMonth);
    const category = getVarietyCategory(record.variety);
    const measuredTimestamp = toTimestamp(record.measuredAt);
    if (!period || !category || measuredTimestamp === null || !isDisplayable(record.dataStatus, includeNeedsReview)) {
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
  if (!current.record.orchard) {
    return { diameterAverage: null, brix: null, acidity: null };
  }
  const previous = candidates
    .filter((candidate) => candidate.periodYear === current.periodYear
      && candidate.record.orchard === current.record.orchard
      && candidate.varietyCategory === current.varietyCategory
      && candidate.record.treatment === current.record.treatment
      && candidate.measuredTimestamp < current.measuredTimestamp)
    .sort((left, right) => right.measuredTimestamp - left.measuredTimestamp
      || right.registeredTimestamp - left.registeredTimestamp
      || left.record.id.localeCompare(right.record.id))[0];

  const subtract = (currentValue: number | null, previousValue: number | null): number | null =>
    currentValue === null || previousValue === null ? null : currentValue - previousValue;

  return {
    diameterAverage: subtract(current.record.averageDiameter ?? null, previous?.record.averageDiameter ?? null),
    brix: subtract(current.record.brix, previous?.record.brix ?? null),
    acidity: subtract(current.record.acidity, previous?.record.acidity ?? null),
  };
};

const toRow = (prepared: PreparedRecord, candidates: readonly PreparedRecord[]): PeriodicAnalysisRow => ({
  registrationId: prepared.record.id,
  periodYear: prepared.periodYear,
  measuredAt: prepared.record.measuredAt,
  orchard: prepared.record.orchard || null,
  rawVariety: prepared.record.variety,
  varietyCategory: prepared.varietyCategory,
  treatment: prepared.record.treatment,
  notes: prepared.record.notes,
  diameterAverage: prepared.record.averageDiameter ?? null,
  brix: prepared.record.brix,
  acidity: prepared.record.acidity,
  previousDifference: previousDifference(prepared, candidates),
});

export const buildPeriodicAnalysis = (
  records: readonly AnalysisDataRecord[],
  query: PeriodicAnalysisQuery,
): PeriodicAnalysisYearGroup[] => {
  const prepared = prepareRecords(records, query.includeNeedsReview ?? false);
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
    rows.push(toRow(item, prepared));
    groups.set(item.periodYear, rows);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, rows]) => ({ year, rows }));
};
