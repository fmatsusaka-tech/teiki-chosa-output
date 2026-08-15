"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  filterAnalysisDataInventoryEntries,
  type AnalysisDataInventory,
  type AnalysisDataInventoryFilter,
  type AnalysisDataInventoryState,
} from "../../features/data-diagnostics/analysis-data-inventory";
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
const emptyFilter: AnalysisDataInventoryFilter = {
  registrationId: "", orchard: "", variety: "", year: "", month: "", period: "all", state: "all", dataStatus: "all",
};

export function DataManagementClient({ dataError, inventory, visibilitySummary }: {
  dataError: string | null;
  inventory: AnalysisDataInventory | null;
  visibilitySummary: AnalysisDataVisibilitySummary | null;
}) {
  const [showRecords, setShowRecords] = useState(false);
  const [draftFilter, setDraftFilter] = useState<AnalysisDataInventoryFilter>(emptyFilter);
  const [appliedFilter, setAppliedFilter] = useState<AnalysisDataInventoryFilter | null>(null);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => appliedFilter && inventory
    ? filterAnalysisDataInventoryEntries(inventory.entries, appliedFilter)
    : [], [appliedFilter, inventory]);
  const orchards = useMemo(() => [...new Set(inventory?.entries.flatMap((entry) => entry.orchard ? [entry.orchard] : []) ?? [])].sort((a, b) => a.localeCompare(b, "ja")), [inventory]);
  const varieties = useMemo(() => [...new Set(inventory?.entries.flatMap((entry) => entry.variety ? [entry.variety] : []) ?? [])].sort((a, b) => a.localeCompare(b, "ja")), [inventory]);
  const years = useMemo(() => [...new Set(inventory?.entries.flatMap((entry) => entry.measuredAt ? [entry.measuredAt.slice(0, 4)] : []) ?? [])].sort((a, b) => b.localeCompare(a)), [inventory]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const updateDraft = <K extends keyof AnalysisDataInventoryFilter>(key: K, value: AnalysisDataInventoryFilter[K]) => {
    setDraftFilter((current) => ({ ...current, [key]: value }));
  };

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

        <form className="inventory-filters" onSubmit={(event) => { event.preventDefault(); setAppliedFilter({ ...draftFilter }); setPage(1); }}>
          <label>登録ID<input value={draftFilter.registrationId} onChange={(event) => updateDraft("registrationId", event.target.value)} placeholder="登録IDを入力" type="search" /></label>
          <label>園地<select value={draftFilter.orchard} onChange={(event) => updateDraft("orchard", event.target.value)}>
            <option value="">すべて</option>{orchards.map((value) => <option key={value} value={value}>{value}</option>)}
          </select></label>
          <label>品種<select value={draftFilter.variety} onChange={(event) => updateDraft("variety", event.target.value)}>
            <option value="">すべて</option>{varieties.map((value) => <option key={value} value={value}>{value}</option>)}
          </select></label>
          <label>年<select value={draftFilter.year} onChange={(event) => updateDraft("year", event.target.value)}>
            <option value="">すべて</option>{years.map((value) => <option key={value} value={value}>{value}年</option>)}
          </select></label>
          <label>月<select value={draftFilter.month} onChange={(event) => updateDraft("month", event.target.value)}>
            <option value="">すべて</option>{Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((value) => <option key={value} value={value}>{Number(value)}月</option>)}
          </select></label>
          <label>前半・後半<select value={draftFilter.period} onChange={(event) => updateDraft("period", event.target.value as AnalysisDataInventoryFilter["period"])}>
            <option value="all">すべて</option><option value="first">前半（1〜15日）</option><option value="second">後半（16日〜月末）</option>
          </select></label>
          <label>採用状態<select value={draftFilter.state} onChange={(event) => updateDraft("state", event.target.value as AnalysisDataInventoryFilter["state"])}>
            <option value="all">すべて</option><option value="included">分析対象</option><option value="excluded">状態対象外</option><option value="disabled">無効</option>
          </select></label>
          <label>データ状態<select value={draftFilter.dataStatus} onChange={(event) => updateDraft("dataStatus", event.target.value)}>
            <option value="all">すべて</option>{inventory.dataStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </select></label>
          <div className="inventory-filter-actions">
            <button type="submit">検索する</button>
            <button type="button" onClick={() => { setDraftFilter(emptyFilter); setAppliedFilter(null); setPage(1); }}>条件をクリア</button>
          </div>
        </form>

        {!appliedFilter ? <p className="inventory-search-guide">条件を選んで「検索する」を押すとデータを表示します。</p> : <>
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
        </>}
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
