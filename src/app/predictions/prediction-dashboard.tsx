import Link from "next/link";
import type { PredictionMasterBundle, PredictionMetric } from "../../features/prediction-data/prediction-master.types";
import { simulatePrediction } from "../../features/prediction-integration/prediction-simulator";
import { getFruitSizeCategory } from "../../features/shared/fruit-size";

/** Displays a predicted diameter with its size category, classified from the unrounded prediction. */
const displayDiameterPredictionValue = (predictedValue: number, rawPrediction: number): string => {
  const category = getFruitSizeCategory(rawPrediction);
  return category ? `${predictedValue}mm（${category}）` : `${predictedValue}mm`;
};

type SearchValues = { model?: string; date?: string; diameter?: string; brix?: string; acidity?: string };
const parseValue = (value: string | undefined): number | null => {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const fields: readonly [PredictionMetric, keyof SearchValues, string, string][] = [
  ["横径", "diameter", "横径の仮定値", "例: 40.0"],
  ["糖度", "brix", "糖度の仮定値", "例: 9.0"],
  ["クエン酸", "acidity", "クエン酸の仮定値", "例: 1.20"],
];

export const PredictionDashboard = ({ bundle, expectedDataVersion, search }: { bundle: PredictionMasterBundle; expectedDataVersion: string; search: SearchValues }) => {
  const models = bundle.models;
  const predictionModel = models.some((model) => model.predictionModel === search.model) ? search.model! : models[0]?.predictionModel ?? "";
  const values = { 横径: parseValue(search.diameter), 糖度: parseValue(search.brix), クエン酸: parseValue(search.acidity) };
  const submitted = Boolean(search.model || search.date || search.diameter || search.brix || search.acidity);
  const result = submitted ? simulatePrediction(bundle, { predictionModel, assumedDate: search.date ?? "", values, expectedDataVersion }) : null;

  return <main className="prediction-page">
    <header className="prediction-title"><Link className="home-link" href="/">← ホーム</Link><p className="eyebrow">PREDICTION</p><h1>各種予測システム</h1><p>自由に入力した仮定日・仮定値による試算です。入力内容は保存されません。</p></header>
    <form className="prediction-simulator-form" action="/predictions" method="get">
      <label>品種<select name="model" defaultValue={predictionModel}>{models.map((model) => <option key={model.predictionModel} value={model.predictionModel}>{model.displayCategory}</option>)}</select></label>
      <label>仮定日<input name="date" type="date" required defaultValue={search.date ?? ""} /></label>
      {fields.map(([metric, name, label, placeholder]) => <label key={metric}>{label}<input name={name} type="number" min="0" step={metric === "クエン酸" ? "0.01" : "0.1"} inputMode="decimal" placeholder={placeholder} defaultValue={search[name] ?? ""} /></label>)}
      <button type="submit">仮定値で試算する</button>
    </form>
    {result ? <section className="prediction-result" aria-label="仮定値による予測結果">
      <dl className="prediction-context"><div><dt>品種・モデル</dt><dd>{models.find((model) => model.predictionModel === result.predictionModel)?.displayCategory ?? result.predictionModel}</dd></div><div><dt>仮定日</dt><dd>{result.assumedDate || "未入力"}</dd></div><div><dt>既定収穫目標日</dt><dd>{result.targetMonthDay ?? "—"}</dd></div></dl>
      <div className="prediction-metrics">{fields.map(([metric]) => { const metricResult = result.metrics[metric]; return <article className="prediction-metric" key={metric}><h2>{metric}</h2>{metricResult.ok ? <dl><div><dt>仮定値</dt><dd>{metricResult.measuredValue}</dd></div><div><dt>予測値</dt><dd className="prediction-value">{metric === "横径" ? displayDiameterPredictionValue(metricResult.predictedValue, metricResult.rawPrediction) : metricResult.predictedValue}</dd></div></dl> : <p className="prediction-unavailable"><strong>計算対象外</strong><br />{metricResult.reason}</p>}</article>; })}</div>
    </section> : <p className="prediction-empty">品種、仮定日、各指標の仮定値を入力して試算してください。</p>}
    <p className="prediction-version">データ版 {expectedDataVersion}</p>
  </main>;
};
