import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { createAuthenticatedAnalysisDataRepository } from "../../server/analysis-data/authenticated-analysis-data-repository";
import { OrchardAnalysisClient } from "./orchard-analysis-client";

export const dynamic = "force-dynamic";

const getRecords = async (): Promise<{ records: AnalysisDataRecord[]; error: string | null }> => {
  try {
    const repository = createAuthenticatedAnalysisDataRepository();
    return { records: await repository.getAll(), error: null };
  } catch (error) {
    console.error("Failed to load orchard analysis data", error);
    return { records: [], error: "調査データを取得できませんでした。共有設定と接続設定を確認してください。" };
  }
};

export default async function OrchardsPage() {
  const { records, error } = await getRecords();
  return <OrchardAnalysisClient dataError={error} records={records} />;
}
