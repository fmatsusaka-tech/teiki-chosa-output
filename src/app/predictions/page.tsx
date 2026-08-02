import { PredictionDashboard } from "./prediction-dashboard";
import { loadPredictionPageData } from "../../server/prediction-data/prediction-page-data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function PredictionsPage({ searchParams }: { searchParams: SearchParams }) {
  try {
    const [data, query] = await Promise.all([loadPredictionPageData(), searchParams]);
    return <PredictionDashboard data={data} search={{
      year: first(query.year),
      orchard: first(query.orchard),
      variety: first(query.variety),
      record: first(query.record),
    }} />;
  } catch (error) {
    console.error("Failed to load prediction data", error);
    return <main className="prediction-page"><header className="prediction-title"><p className="eyebrow">PREDICTION</p><h1>収穫時予測</h1></header><p className="prediction-error">予測データを取得できませんでした。接続設定とデータ版を確認してください。</p></main>;
  }
}
