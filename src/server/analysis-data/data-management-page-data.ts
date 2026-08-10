import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildAnalysisDataInventory, type AnalysisDataInventory } from "../../features/data-diagnostics/analysis-data-inventory";
import { buildAnalysisDataVisibilitySummary, type AnalysisDataVisibilitySummary } from "../../features/data-diagnostics/analysis-data-visibility";

export type DataManagementPageData = {
  inventory: AnalysisDataInventory | null;
  visibilitySummary: AnalysisDataVisibilitySummary | null;
  dataError: string | null;
};

export const loadDataManagementPageData = async ({
  loadRecords,
  logError = console.error,
}: {
  loadRecords: () => Promise<AnalysisDataRecord[]>;
  logError?: (message: string, error: unknown) => void;
}): Promise<DataManagementPageData> => {
  try {
    const records = await loadRecords();
    return {
      inventory: buildAnalysisDataInventory(records),
      visibilitySummary: buildAnalysisDataVisibilitySummary(records),
      dataError: null,
    };
  } catch (error) {
    logError("Failed to load analysis data for the data management diagnostics", error);
    return {
      inventory: null,
      visibilitySummary: null,
      dataError: "調査データを取得できませんでした。接続設定を確認してください。",
    };
  }
};
