import Link from "next/link";

export default function DiameterPredictionPage() {
  return <main className="page-shell"><p className="eyebrow">PREDICTION</p><h1>横径予測</h1><p className="placeholder">収穫時の横径を予測します。</p><Link className="back-link" href="/predictions">各種予測へ戻る</Link></main>;
}
