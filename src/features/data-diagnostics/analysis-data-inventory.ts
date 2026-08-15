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

export type AnalysisDataInventoryPeriod = "all" | "first" | "second";

export type AnalysisDataInventoryFilter = {
  registrationId: string;
  orchard: string;
  variety: string;
  year: string;
  month: string;
  period: AnalysisDataInventoryPeriod;
  state: "all" | AnalysisDataInventoryState;
  dataStatus: string;
};

export const filterAnalysisDataInventoryEntries = (
  entries: readonly AnalysisDataInventoryEntry[],
  filter: AnalysisDataInventoryFilter,
): AnalysisDataInventoryEntry[] => {
  const registrationId = filter.registrationId.trim().toLocaleLowerCase("ja");

  return entries.filter((entry) => {
    if (registrationId && !entry.id.toLocaleLowerCase("ja").includes(registrationId)) return false;
    if (filter.orchard && entry.orchard !== filter.orchard) return false;
    if (filter.variety && entry.variety !== filter.variety) return false;
    if (filter.state !== "all" && entry.state !== filter.state) return false;
    if (filter.dataStatus !== "all" && entry.dataStatus !== filter.dataStatus) return false;

    if (filter.year || filter.month || filter.period !== "all") {
      const matched = entry.measuredAt?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!matched) return false;
      const [, year, month, dayText] = matched;
      const day = Number(dayText);
      if (filter.year && year !== filter.year) return false;
      if (filter.month && month !== filter.month) return false;
      if (filter.period === "first" && day > 15) return false;
      if (filter.period === "second" && day <= 15) return false;
    }

    return true;
  });
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
