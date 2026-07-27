import Link from "next/link";

export default function OrchardsPage() {
  return <main className="page-shell"><p className="eyebrow">ORCHARDS</p><h1>園地分析</h1><p className="placeholder">最大2園地を選択して、調査データを比較します。</p><Link className="back-link" href="/">ホームへ戻る</Link></main>;
}
