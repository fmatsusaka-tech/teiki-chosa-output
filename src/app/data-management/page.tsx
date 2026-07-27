import Link from "next/link";

export default function DataManagementPage() {
  return <main className="page-shell"><p className="eyebrow">DATA MANAGEMENT</p><h1>データ管理</h1><p className="placeholder">Outputで利用する読取データを検索・確認します。Inputのデータは更新しません。</p><Link className="back-link" href="/">ホームへ戻る</Link></main>;
}
