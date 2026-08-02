import Link from "next/link";
import { PredictionDashboard } from "./prediction-dashboard";
import { loadPredictionPageData } from "../../server/prediction-data/prediction-page-data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function PredictionsPage({ searchParams }: { searchParams: SearchParams }) {
  try {
    const [data, query] = await Promise.all([loadPredictionPageData(), searchParams]);
    return <PredictionDashboard bundle={data.bundle} expectedDataVersion={data.expectedDataVersion} search={{
      model: first(query.model), date: first(query.date), diameter: first(query.diameter), brix: first(query.brix), acidity: first(query.acidity),
    }} />;
  } catch (error) {
    console.error("Failed to load prediction data", error);
    return <main className="prediction-page"><header className="prediction-title"><Link className="home-link" href="/">← ホーム</Link><p className="eyebrow">PREDICTION</p><h1>各種予測システム</h1></header><p className="prediction-error">予測マスタを取得できませんでした。接続設定とデータ版を確認してください。</p></main>;
  }
}
