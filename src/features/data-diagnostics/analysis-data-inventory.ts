import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { isEnabledAnalysisRecord, isIncludedInAnalysis } from "../../contracts/analysis-data";

export type AnalysisDataInventoryState = "included" | "disabled" | "excluded";

export type AnalysisDataInventoryEntry = {
  id: string;
  measuredAt: string | null;
  orchard: string | null;
  variety: string | null;
  treatment: string | null;
  dataStatus: string;
  activationStatus: string | null;
  state: AnalysisDataInventoryState;
  reason: string;
};

export type AnalysisDataInventory = {
  totalRecords: number;
  enabledRecords: number;
  disabledRecords: number;
  includedRecords: number;
  excludedRecords: number;
  dataStatuses: string[];
  entries: AnalysisDataInventoryEntry[];
};

const inventoryState = (record: AnalysisDataRecord): AnalysisDataInventoryState => {
  if (!isEnabledAnalysisRecord(record)) return "disabled";
  return isIncludedInAnalysis(record) ? "included" : "excluded";
};

const inventoryReason = (record: AnalysisDataRecord, state: AnalysisDataInventoryState): string => {
  if (state === "disabled") return "有効状態が「無効」";
  if (state === "excluded") return `データ状態が分析対象外（${record.dataStatus}）`;
  return "標準分析対象";
};

export const buildAnalysisDataInventory = (
  records: readonly AnalysisDataRecord[],
): AnalysisDataInventory => {
  const entries = records.map((record) => {
    const state = inventoryState(record);
    return {
      id: record.id,
      measuredAt: record.measuredAt,
      orchard: record.orchard,
      variety: record.variety,
      treatment: record.treatment,
      dataStatus: record.dataStatus,
      activationStatus: record.activationStatus,
      state,
      reason: inventoryReason(record, state),
    };
  });

  return {
    totalRecords: entries.length,
    enabledRecords: entries.filter((entry) => entry.state !== "disabled").length,
    disabledRecords: entries.filter((entry) => entry.state === "disabled").length,
    includedRecords: entries.filter((entry) => entry.state === "included").length,
    excludedRecords: entries.filter((entry) => entry.state === "excluded").length,
    dataStatuses: [...new Set(entries.map((entry) => entry.dataStatus))].sort((a, b) => a.localeCompare(b, "ja")),
    entries,
  };
};
