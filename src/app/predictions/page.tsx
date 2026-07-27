import Link from "next/link";

const predictions = ["横径予測", "糖度予測", "クエン酸予測"];

export default function PredictionsPage() {
  return <main className="page-shell"><p className="eyebrow">PREDICTIONS</p><h1>各種予測</h1><div className="feature-grid">{predictions.map((prediction) => <article className="placeholder" key={prediction}><h2>{prediction}</h2><p>収穫時点の状態を予測します。</p></article>)}</div><Link className="back-link" href="/">ホームへ戻る</Link></main>;
}
