"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AnalysisDataInventory, AnalysisDataInventoryState } from "../../features/data-diagnostics/analysis-data-inventory";
import type { AnalysisDataVisibilityReason, AnalysisDataVisibilitySummary } from "../../features/data-diagnostics/analysis-data-visibility";

const pageSize = 50;
const reasonLabels: Record<AnalysisDataVisibilityReason, string> = {
  non_standard_status: "データ状態が分析対象外(取消・削除・未知など)",
  missing_variety: "品種が空欄",
  missing_measured_at: "計測日が空欄または不正",
  missing_orchard: "園地名が空欄",
  invalid_survey_month: "調査基準月が不正",
};
const reasonOrder: AnalysisDataVisibilityReason[] = ["non_standard_status", "missing_variety", "missing_measured_at", "missing_orchard", "invalid_survey_month"];
const stateLabels: Record<AnalysisDataInventoryState, string> = { included: "分析対象", excluded: "状態対象外", disabled: "無効" };

export function DataManagementClient({ dataError, inventory, visibilitySummary }: {
  dataError: string | null;
  inventory: AnalysisDataInventory | null;
  visibilitySummary: AnalysisDataVisibilitySummary | null;
}) {
  const [showRecords, setShowRecords] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"all" | AnalysisDataInventoryState>("all");
  const [dataStatus, setDataStatus] = useState("all");
  const [page, setPage] = useState(1);
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const filtered = useMemo(() => inventory?.entries.filter((entry) => {
    if (state !== "all" && entry.state !== state) return false;
    if (dataStatus !== "all" && entry.dataStatus !== dataStatus) return false;
    if (!normalizedQuery) return true;
    return [entry.id, entry.orchard, entry.variety, entry.treatment, entry.measuredAt]
      .some((value) => value?.toLocaleLowerCase("ja").includes(normalizedQuery));
  }) ?? [], [dataStatus, inventory, normalizedQuery, state]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const updateFilters = (action: () => void) => { action(); setPage(1); };

  return <main className="page-shell data-management-page">
    <Link className="home-link" href="/">← ホーム</Link>
    <p className="eyebrow">DATA MANAGEMENT</p>
    <h1>データ管理</h1>
    <p className="placeholder">Outputが読み取ったデータの採用状態を確認します。Inputのデータは更新しません。</p>

    {dataError ? <p className="diagnostics-empty">{dataError}</p> : inventory && <>
      <section className="inventory-section" aria-label="データ採用状態">
        <h2>データ採用状態</h2>
        <div className="inventory-summary">
          <div><span>全レコード</span><strong>{inventory.totalRecords}件</strong></div>
          <div><span>有効（空欄を含む）</span><strong>{inventory.enabledRecords}件</strong></div>
          <div><span>分析対象</span><strong>{inventory.includedRecords}件</strong></div>
          <div><span>状態対象外</span><strong>{inventory.excludedRecords}件</strong></div>
          <div><span>無効</span><strong>{inventory.disabledRecords}件</strong></div>
        </div>

        <div className="inventory-filters">
          <label>検索<input value={query} onChange={(event) => updateFilters(() => setQuery(event.target.value))} placeholder="登録ID・園地・品種・日付" type="search" /></label>
          <label>採用状態<select value={state} onChange={(event) => updateFilters(() => setState(event.target.value as typeof state))}>
            <option value="all">すべて</option><option value="included">分析対象</option><option value="excluded">状態対象外</option><option value="disabled">無効</option>
          </select></label>
          <label>データ状態<select value={dataStatus} onChange={(event) => updateFilters(() => setDataStatus(event.target.value))}>
            <option value="all">すべて</option>{inventory.dataStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </select></label>
        </div>

        <p className="inventory-result-count">該当 {filtered.length}件（{currentPage}/{pageCount}ページ）</p>
        <div className="inventory-list">
          {pageEntries.map((entry) => <article className="inventory-record" key={entry.id}>
            <div className="inventory-record-heading"><code>{entry.id}</code><span className={`inventory-state inventory-state-${entry.state}`}>{stateLabels[entry.state]}</span></div>
            <strong>{entry.orchard ?? "（園地名なし）"} / {entry.variety ?? "（品種なし）"}</strong>
            <span>{entry.measuredAt ?? "（計測日なし）"}　{entry.treatment ?? "（処理区なし）"}</span>
            <span>{entry.dataStatus} / 有効状態: {entry.activationStatus ?? "空欄（有効扱い）"}</span>
            <small>{entry.reason}</small>
          </article>)}
          {pageEntries.length === 0 && <p className="diagnostics-empty">条件に一致するデータはありません。</p>}
        </div>
        <div className="inventory-pagination">
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>前へ</button>
          <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>次へ</button>
        </div>
      </section>
    </>}

    <section className="diagnostics-section" aria-label="開発者用データチェック">
      <h2>非表示データ診断</h2>
      <p className="diagnostics-description">有効な調査データのうち、定期調査分析・園地分析のどちらにも表示されないデータを確認します。</p>
      {!dataError && visibilitySummary && <>
        <div className="diagnostics-summary"><div><span>どちらの画面にも非表示</span><strong>{visibilitySummary.hiddenFromEveryScreen.length}件</strong></div></div>
        {visibilitySummary.hiddenFromEveryScreen.length > 0 && <>
          <table className="diagnostics-reason-table"><thead><tr><th scope="col">理由</th><th scope="col">件数</th></tr></thead><tbody>
            {reasonOrder.filter((reason) => visibilitySummary.reasonCounts[reason] > 0).map((reason) => <tr key={reason}><td>{reasonLabels[reason]}</td><td>{visibilitySummary.reasonCounts[reason]}件</td></tr>)}
          </tbody></table>
          <button type="button" onClick={() => setShowRecords(!showRecords)}>{showRecords ? "対象データを隠す" : "対象データの登録IDを表示"}</button>
          {showRecords && <ul className="diagnostics-record-list">{visibilitySummary.hiddenFromEveryScreen.map((entry) => <li key={entry.id}>
            <code>{entry.id}</code><span>{entry.orchard ?? "（園地名なし）"} / {entry.variety ?? "（品種なし）"} / {entry.measuredAt ?? "（計測日なし）"}</span>
            <span className="diagnostics-record-reasons">{entry.reasons.map((reason) => reasonLabels[reason]).join("、")}</span>
          </li>)}</ul>}
        </>}
      </>}
    </section>
  </main>;
}
