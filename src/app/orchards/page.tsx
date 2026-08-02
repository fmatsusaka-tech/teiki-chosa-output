import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { createAuthenticatedAnalysisDataRepository } from "../../server/analysis-data/authenticated-analysis-data-repository";
import { loadNormalizedAnalysisRecords } from "../../server/orchard-master/normalized-analysis-records";
import { OrchardAnalysisClient } from "./orchard-analysis-client";

export const dynamic = "force-dynamic";

const getRecords = async (): Promise<{ records: AnalysisDataRecord[]; error: string | null; orchardMasterWarning: string | null }> => {
  try {
    const repository = createAuthenticatedAnalysisDataRepository();
    const normalized = await loadNormalizedAnalysisRecords(await repository.getAll());
    return { ...normalized, error: null };
  } catch (error) {
    console.error("Failed to load orchard analysis data", error);
    return { records: [], error: "調査データを取得できませんでした。共有設定と接続設定を確認してください。", orchardMasterWarning: null };
  }
};

export default async function OrchardsPage() {
  const { records, error, orchardMasterWarning } = await getRecords();
  return <OrchardAnalysisClient dataError={error} orchardMasterWarning={orchardMasterWarning} records={records} />;
}
