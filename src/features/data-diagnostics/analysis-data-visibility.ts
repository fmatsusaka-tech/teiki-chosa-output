import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { isEnabledAnalysisRecord, isIncludedInAnalysis } from "../../contracts/analysis-data";

const surveyMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export type AnalysisDataVisibilityReason =
  | "non_standard_status"
  | "missing_variety"
  | "missing_measured_at"
  | "missing_orchard"
  | "invalid_survey_month";

export type AnalysisDataVisibilityEntry = {
  id: string;
  orchard: string | null;
  variety: string | null;
  measuredAt: string | null;
  dataStatus: string;
  reasons: AnalysisDataVisibilityReason[];
};

export type AnalysisDataVisibilitySummary = {
  totalEnabledRecords: number;
  hiddenFromEveryScreen: AnalysisDataVisibilityEntry[];
  reasonCounts: Record<AnalysisDataVisibilityReason, number>;
};

const evaluateReasons = (record: AnalysisDataRecord): AnalysisDataVisibilityReason[] => {
  const reasons: AnalysisDataVisibilityReason[] = [];
  if (!isIncludedInAnalysis(record)) reasons.push("non_standard_status");
  if (record.variety === null) reasons.push("missing_variety");
  if (record.measuredAt === null) reasons.push("missing_measured_at");
  if (record.orchard === null) reasons.push("missing_orchard");
  if (!surveyMonthPattern.test(record.surveyMonth)) reasons.push("invalid_survey_month");
  return reasons;
};

/**
 * 定期調査分析・園地分析のどちらにも表示されない「有効」レコードを洗い出す。
 * 園地分析は品種・計測日・園地名・データ状態を、定期調査分析は品種・計測日・
 * 調査基準月・データ状態を必須とするため、片方だけの欠落は他方では表示され得る。
 */
export const buildAnalysisDataVisibilitySummary = (
  records: readonly AnalysisDataRecord[],
): AnalysisDataVisibilitySummary => {
  const enabled = records.filter(isEnabledAnalysisRecord);
  const reasonCounts: Record<AnalysisDataVisibilityReason, number> = {
    non_standard_status: 0,
    missing_variety: 0,
    missing_measured_at: 0,
    missing_orchard: 0,
    invalid_survey_month: 0,
  };
  const hiddenFromEveryScreen: AnalysisDataVisibilityEntry[] = [];

  for (const record of enabled) {
    const reasons = evaluateReasons(record);
    const blockedEverywhere = reasons.includes("non_standard_status")
      || reasons.includes("missing_variety")
      || reasons.includes("missing_measured_at");
    const visibleInPeriodicAnalysis = !blockedEverywhere && !reasons.includes("invalid_survey_month");
    const visibleInOrchardAnalysis = !blockedEverywhere && !reasons.includes("missing_orchard");

    if (!visibleInPeriodicAnalysis && !visibleInOrchardAnalysis) {
      for (const reason of reasons) reasonCounts[reason] += 1;
      hiddenFromEveryScreen.push({
        id: record.id,
        orchard: record.orchard,
        variety: record.variety,
        measuredAt: record.measuredAt,
        dataStatus: record.dataStatus,
        reasons,
      });
    }
  }

  return { totalEnabledRecords: enabled.length, hiddenFromEveryScreen, reasonCounts };
};
