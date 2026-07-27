import Link from "next/link";

export default function AcidityPredictionPage() {
  return <main className="page-shell"><p className="eyebrow">PREDICTION</p><h1>クエン酸予測</h1><p className="placeholder">収穫時の酸度を予測します。</p><Link className="back-link" href="/predictions">各種予測へ戻る</Link></main>;
}
