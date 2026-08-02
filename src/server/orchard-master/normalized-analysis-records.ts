import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { applyOrchardNameMaster, type NormalizedAnalysisDataRecord } from "../../features/orchard-master/orchard-name-master";
import { createGoogleSheetsOrchardNameMasterRepository } from "./google-sheets-orchard-name-master-repository";
import { OrchardMasterRepositoryError } from "./google-sheets-orchard-name-master-repository";

export const loadNormalizedAnalysisRecords = async (
  records: readonly AnalysisDataRecord[],
  { loadMappings = () => createGoogleSheetsOrchardNameMasterRepository().read(), logError = console.error } = {},
): Promise<{ records: NormalizedAnalysisDataRecord[]; orchardMasterWarning: string | null }> => {
  try {
    return { records: applyOrchardNameMaster(records, await loadMappings()), orchardMasterWarning: null };
  } catch (error) {
    logError("Failed to apply orchard name master", error instanceof OrchardMasterRepositoryError ? error.code : "CONTRACT_ERROR");
    return {
      records: records.map((record) => ({ ...record, originalOrchard: record.orchard })),
      orchardMasterWarning: "園地名整理を適用できませんでした。Inputの園地名をそのまま表示しています。",
    };
  }
};
