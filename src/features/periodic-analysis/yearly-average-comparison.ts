import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { isEnabledAnalysisRecord, isIncludedInAnalysis } from "../../contracts/analysis-data";
import { normalizeTreatment } from "../shared/treatment";
import { getVarietyCategory } from "../shared/variety-category";
import type { SurveyHalf } from "./periodic-analysis.types";

export type YearlyAverageMetric = "averageDiameter" | "brix" | "acidity";
export type YearlyAveragePoint = { year: number; value: number; count: number };

export const buildYearlyAveragePoints = (
  records: readonly AnalysisDataRecord[],
  selection: { orchard: string | null; varietyCategory: string; treatment: string | null; month: number; half: SurveyHalf },
  metric: YearlyAverageMetric,
): YearlyAveragePoint[] => {
  const valuesByYear = new Map<number, number[]>();
  const month = String(selection.month).padStart(2, "0");

  for (const record of records) {
    const value = record[metric];
    const surveyYear = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(record.surveyMonth);
    if (!isEnabledAnalysisRecord(record)
      || !isIncludedInAnalysis(record)
      || surveyYear === null
      || record.orchard !== selection.orchard
      || getVarietyCategory(record.variety) !== selection.varietyCategory
      || normalizeTreatment(record.treatment) !== normalizeTreatment(selection.treatment)
      || record.surveyMonth.slice(5) !== month
      || record.surveyPeriod !== selection.half
      || value === null
      || !Number.isFinite(value)) continue;

    const year = Number(surveyYear[1]);
    const values = valuesByYear.get(year) ?? [];
    values.push(value);
    valuesByYear.set(year, values);
  }

  return [...valuesByYear.entries()]
    .map(([year, values]) => ({ year, value: values.reduce((sum, value) => sum + value, 0) / values.length, count: values.length }))
    .sort((left, right) => right.year - left.year);
};
