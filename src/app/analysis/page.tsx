import Link from "next/link";

export default function AnalysisPage() {
  return <main className="page-shell"><p className="eyebrow">ANALYSIS</p><h1>定期調査分析</h1><p className="placeholder">園地・品種・処理区・年度・前半／後半を条件に、横径・糖度・酸度を分析します。</p><Link className="back-link" href="/">ホームへ戻る</Link></main>;
}
