import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { isIncludedInAnalysis } from "../../contracts/analysis-data";
import { getVarietyCategory } from "../shared/variety-category";
import type { OrchardAnalysisFilterOptions, OrchardAnalysisQuery, OrchardAnalysisRow, OrchardAnalysisTimelineEntry } from "./orchard-analysis.types";

type DatedRecord = {
  record: AnalysisDataRecord;
  measuredTimestamp: number;
  registeredTimestamp: number;
};

const toTimestamp = (value: string | null): number | null => {
  if (value === null) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const compareNewestFirst = (left: DatedRecord, right: DatedRecord): number =>
  right.measuredTimestamp - left.measuredTimestamp
  || right.registeredTimestamp - left.registeredTimestamp
  || left.record.id.localeCompare(right.record.id);

const toRow = (record: AnalysisDataRecord): OrchardAnalysisRow => ({
  registrationId: record.id,
  measuredAt: record.measuredAt ?? "",
  treatment: record.treatment,
  diameterAverage: record.averageDiameter,
  brix: record.brix,
  acidity: record.acidity,
});

const isEligible = (record: AnalysisDataRecord): boolean =>
  record.orchard !== null
  && record.measuredAt !== null
  && getVarietyCategory(record.variety) !== null
  && isIncludedInAnalysis(record);

/** Returns cascading search candidates from records that can appear in analysis. */
export const getOrchardAnalysisFilterOptions = (
  records: readonly AnalysisDataRecord[],
  orchard?: string,
  varietyCategory?: string,
): OrchardAnalysisFilterOptions => {
  const eligible = records.filter((record) => isEligible(record)
    && (orchard === undefined || record.orchard === orchard)
    && (varietyCategory === undefined || getVarietyCategory(record.variety) === varietyCategory));

  return {
    orchards: [...new Set(eligible.map((record) => record.orchard!))].sort((a, b) => a.localeCompare(b, "ja")),
    varietyCategories: [...new Set(eligible.map((record) => getVarietyCategory(record.variety)!))].sort((a, b) => a.localeCompare(b, "ja")),
    treatments: [...new Set(eligible.map((record) => record.treatment))],
  };
};

/**
 * Builds the orchard medical-chart timeline. It deliberately preserves one
 * source record per row and contains the ordering/year-boundary rules so that
 * the UI does not reimplement analysis behavior.
 */
export const buildOrchardAnalysis = (
  records: readonly AnalysisDataRecord[],
  query: OrchardAnalysisQuery,
): OrchardAnalysisTimelineEntry[] => {
  const visible = records.flatMap((record): DatedRecord[] => {
    const measuredTimestamp = toTimestamp(record.measuredAt);
    if (
      measuredTimestamp === null
      || record.orchard !== query.orchard
      || getVarietyCategory(record.variety) !== query.varietyCategory
      || !isEligible(record)
      || (query.treatment !== undefined && record.treatment !== query.treatment)
    ) {
      return [];
    }
    return [{
      record,
      measuredTimestamp,
      registeredTimestamp: toTimestamp(record.registeredAt) ?? Number.NEGATIVE_INFINITY,
    }];
  }).sort(compareNewestFirst);

  let previousYear: number | null = null;
  return visible.flatMap(({ record, measuredTimestamp }): OrchardAnalysisTimelineEntry[] => {
    const year = new Date(measuredTimestamp).getUTCFullYear();
    const entries: OrchardAnalysisTimelineEntry[] = [];
    if (year !== previousYear) {
      entries.push({ type: "year", year });
      previousYear = year;
    }
    entries.push({ type: "record", row: toRow(record) });
    return entries;
  });
};
