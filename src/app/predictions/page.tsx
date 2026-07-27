import Link from "next/link";

const predictions = [
  { href: "/predictions/diameter", title: "横径予測" },
  { href: "/predictions/brix", title: "糖度予測" },
  { href: "/predictions/acidity", title: "クエン酸予測" },
];

export default function PredictionsPage() {
  return <main className="page-shell"><p className="eyebrow">PREDICTIONS</p><h1>各種予測</h1><div className="feature-grid">{predictions.map((prediction) => <Link className="feature-card" href={prediction.href} key={prediction.href}><h2>{prediction.title}</h2><p>収穫時点の状態を予測します。</p><span aria-hidden="true">→</span></Link>)}</div><Link className="back-link" href="/">ホームへ戻る</Link></main>;
}
