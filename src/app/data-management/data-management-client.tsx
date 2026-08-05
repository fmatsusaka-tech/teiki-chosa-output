"use client";

import Link from "next/link";
import { useState } from "react";
import type { AnalysisDataVisibilityReason, AnalysisDataVisibilitySummary } from "../../features/data-diagnostics/analysis-data-visibility";

const reasonLabels: Record<AnalysisDataVisibilityReason, string> = {
  non_standard_status: "データ状態が分析対象外(取消・削除・未知など)",
  missing_variety: "品種が空欄",
  missing_measured_at: "計測日が空欄または不正",
  missing_orchard: "園地名が空欄",
  invalid_survey_month: "調査基準月が不正",
};

const reasonOrder: AnalysisDataVisibilityReason[] = [
  "non_standard_status",
  "missing_variety",
  "missing_measured_at",
  "missing_orchard",
  "invalid_survey_month",
];

export function DataManagementClient({ dataError, visibilitySummary }: {
  dataError: string | null;
  visibilitySummary: AnalysisDataVisibilitySummary | null;
}) {
  const [showRecords, setShowRecords] = useState(false);

  return <main className="page-shell">
    <Link className="home-link" href="/">← ホーム</Link>
    <p className="eyebrow">DATA MANAGEMENT</p>
    <h1>データ管理</h1>
    <p className="placeholder">Outputで利用する読取データを検索・確認します。Inputのデータは更新しません。</p>

    <section className="diagnostics-section" aria-label="開発者用データチェック">
      <h2>開発者用データチェック</h2>
      <p className="diagnostics-description">有効な調査データのうち、定期調査分析・園地分析のどちらにも表示されないデータの件数を確認します。</p>
      {dataError ? <p className="diagnostics-empty">{dataError}</p> : visibilitySummary && <>
        <div className="diagnostics-summary">
          <div><span>有効データ件数</span><strong>{visibilitySummary.totalEnabledRecords}件</strong></div>
          <div><span>どちらの画面にも非表示</span><strong>{visibilitySummary.hiddenFromEveryScreen.length}件</strong></div>
        </div>
        {visibilitySummary.hiddenFromEveryScreen.length > 0 && <>
          <table className="diagnostics-reason-table">
            <thead><tr><th scope="col">理由</th><th scope="col">件数</th></tr></thead>
            <tbody>
              {reasonOrder.filter((reason) => visibilitySummary.reasonCounts[reason] > 0).map((reason) => (
                <tr key={reason}><td>{reasonLabels[reason]}</td><td>{visibilitySummary.reasonCounts[reason]}件</td></tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setShowRecords(!showRecords)}>{showRecords ? "対象データを隠す" : "対象データの登録IDを表示"}</button>
          {showRecords && <ul className="diagnostics-record-list">
            {visibilitySummary.hiddenFromEveryScreen.map((entry) => (
              <li key={entry.id}>
                <code>{entry.id}</code>
                <span>{entry.orchard ?? "（園地名なし）"} / {entry.variety ?? "（品種なし）"} / {entry.measuredAt ?? "（計測日なし）"}</span>
                <span className="diagnostics-record-reasons">{entry.reasons.map((reason) => reasonLabels[reason]).join("、")}</span>
              </li>
            ))}
          </ul>}
        </>}
      </>}
    </section>
  </main>;
}
