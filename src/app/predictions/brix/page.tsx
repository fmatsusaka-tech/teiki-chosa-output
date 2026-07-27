import Link from "next/link";

export default function BrixPredictionPage() {
  return <main className="page-shell"><p className="eyebrow">PREDICTION</p><h1>糖度予測</h1><p className="placeholder">収穫時の糖度を予測します。</p><Link className="back-link" href="/predictions">各種予測へ戻る</Link></main>;
}
