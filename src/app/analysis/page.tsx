import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { AnalysisDataRepository } from "../../repositories/analysis-data-repository";
import { GoogleSheetsAnalysisDataSource } from "../../repositories/google-sheets-analysis-data-source";
import { PeriodicAnalysisClient } from "./periodic-analysis-client";

export const dynamic = "force-dynamic";

const getRecords = async (): Promise<{ records: AnalysisDataRecord[]; error: string | null }> => {
  try {
    const repository = new AnalysisDataRepository(new GoogleSheetsAnalysisDataSource());
    return { records: await repository.getAll(), error: null };
  } catch (error) {
    console.error("Failed to load analysis data", error);
    return { records: [], error: "調査データを取得できませんでした。共有設定と接続設定を確認してください。" };
  }
};

export default async function AnalysisPage() {
  const { records, error } = await getRecords();
  return <PeriodicAnalysisClient dataError={error} records={records} />;
}
