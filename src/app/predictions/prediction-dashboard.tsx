import Link from "next/link";
import type {
  PredictionIntegrationResult,
  PredictionMetricResult,
  PredictionRecordResult,
} from "../../features/prediction-integration/prediction-integration.types";
import type { PredictionMetric } from "../../features/prediction-data/prediction-master.types";

type SearchValues = {
  year?: string;
  orchard?: string;
  variety?: string;
  record?: string;
};

const text = (value: string | null): string => value ?? "（未入力）";

const metricCard = (
  metric: PredictionMetric,
  result: PredictionMetricResult,
) => (
  <article className="prediction-metric" key={metric}>
    <h2>{metric}</h2>
    {result.ok ? (
      <dl>
        <div><dt>実測値</dt><dd>{result.measuredValue}</dd></div>
        <div><dt>予測値</dt><dd className="prediction-value">{result.predictedValue}</dd></div>
      </dl>
    ) : (
      <p className="prediction-unavailable"><strong>計算対象外</strong><br />{result.message}</p>
    )}
  </article>
);

const selectedValue = (
  requested: string | undefined,
  values: readonly string[],
): string => requested && values.includes(requested) ? requested : values[0] ?? "";

export const PredictionDashboard = ({
  data,
  search,
}: {
  data: PredictionIntegrationResult;
  search: SearchValues;
}) => {
  const years = [...new Set(data.records.map((record) => String(record.measuredYear)))].sort().reverse();
  const year = selectedValue(search.year, years);
  const byYear = data.records.filter((record) => String(record.measuredYear) === year);
  const orchards = [...new Set(byYear.map((record) => text(record.orchard)))].sort();
  const orchard = selectedValue(search.orchard, orchards);
  const byOrchard = byYear.filter((record) => text(record.orchard) === orchard);
  const varieties = [...new Set(byOrchard.map((record) => text(record.variety)))].sort();
  const variety = selectedValue(search.variety, varieties);
  const candidates = byOrchard
    .filter((record) => text(record.variety) === variety)
    .sort((left, right) => (right.measuredAt ?? "").localeCompare(left.measuredAt ?? ""));
  const recordId = selectedValue(search.record, candidates.map((record) => record.id));
  const selected = candidates.find((record) => record.id === recordId) ?? null;

  return (
    <main className="prediction-page">
      <header className="prediction-title">
        <p className="eyebrow">PREDICTION</p>
        <h1>収穫時予測</h1>
        <p>計測値と予測係数から、横径・糖度・クエン酸を独立して計算します。</p>
      </header>

      <form className="prediction-filters" action="/predictions" method="get">
        <label>計測年<select name="year" defaultValue={year}>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>園地<select name="orchard" defaultValue={orchard}>{orchards.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>品種<select name="variety" defaultValue={variety}>{varieties.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>対象レコード<select name="record" defaultValue={recordId}>{candidates.map((record) => <option key={record.id} value={record.id}>{record.measuredAt ?? "計測日なし"} / {record.treatment ?? "処理区なし"}</option>)}</select></label>
        <button type="submit">表示する</button>
      </form>

      {selected ? <PredictionRecord record={selected} /> : <p className="prediction-empty">条件に一致する調査レコードがありません。</p>}

      <p className="prediction-version">データ版 {selected?.dataVersion ?? "-"}</p>
      <Link className="back-link" href="/">ホームへ戻る</Link>
    </main>
  );
};

const PredictionRecord = ({ record }: { record: PredictionRecordResult }) => (
  <section className="prediction-result" aria-label="予測結果">
    <dl className="prediction-context">
      <div><dt>計測日</dt><dd>{record.measuredAt ?? "計測日なし"}</dd></div>
      <div><dt>園地</dt><dd>{text(record.orchard)}</dd></div>
      <div><dt>品種</dt><dd>{text(record.variety)}</dd></div>
      <div><dt>選択モデル</dt><dd>{record.predictionModel ?? "対象モデルなし"}</dd></div>
      <div><dt>目標日</dt><dd>{record.targetMonthDay ?? "-"}</dd></div>
    </dl>
    <div className="prediction-metrics">
      {(["横径", "糖度", "クエン酸"] as const).map((metric) => metricCard(metric, record.metrics[metric]))}
    </div>
  </section>
);
