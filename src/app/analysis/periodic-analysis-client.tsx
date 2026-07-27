"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildPeriodicAnalysis } from "../../features/periodic-analysis/periodic-analysis";
import type { PeriodicAnalysisQuery, PeriodicAnalysisRow } from "../../features/periodic-analysis/periodic-analysis.types";

const categories = ["ゆら早生", "早生(宮川・興津 等、又は山下紅)", "田口", "中生(向山など)", "晩生", "丹生系"];

const displayNumber = (value: number | null, digits: number): string => value === null ? "—" : value.toFixed(digits);
const displayDifference = (value: number | null, digits: number): string => {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
};
const displayDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : `${date.getMonth() + 1}/${date.getDate()}`;
};

const row = (record: PeriodicAnalysisRow) => (
  <div className="analysis-row" key={record.registrationId}>
    <div className="analysis-identity" title={record.orchard ?? ""}>
      <span>{displayDate(record.measuredAt)}</span><span>{record.orchard ?? "—"}</span>
    </div>
    <div className="analysis-scroll-area">
      <div className="analysis-values">
        <span>{displayNumber(record.diameterAverage, 1)}</span><span>{displayDifference(record.previousDifference.diameterAverage, 1)}</span>
        <span>{displayNumber(record.brix, 1)}</span><span>{displayDifference(record.previousDifference.brix, 1)}</span>
        <span>{displayNumber(record.acidity, 2)}</span><span>{displayDifference(record.previousDifference.acidity, 2)}</span>
      </div>
    </div>
  </div>
);

export function PeriodicAnalysisClient({ records }: { records: readonly AnalysisDataRecord[] }) {
  const [query, setQuery] = useState<PeriodicAnalysisQuery>({ varietyCategory: categories[0], month: 7, half: "前半" });
  const groups = useMemo(() => buildPeriodicAnalysis(records, query), [records, query]);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  useEffect(() => setExpandedYears(new Set(groups.map((group) => group.year))), [groups]);

  return <main className="analysis-page">
    <header className="analysis-title"><p className="eyebrow">ANALYSIS</p><h1>定期調査分析</h1></header>
    <section className="analysis-filters" aria-label="検索条件">
      <label>品種<select value={query.varietyCategory} onChange={(event) => setQuery({ ...query, varietyCategory: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>月<select value={query.month} onChange={(event) => setQuery({ ...query, month: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}月</option>)}</select></label>
      <fieldset><legend>区分</legend><label><input checked={query.half === "前半"} name="half" type="radio" value="前半" onChange={() => setQuery({ ...query, half: "前半" })} />前半</label><label><input checked={query.half === "後半"} name="half" type="radio" value="後半" onChange={() => setQuery({ ...query, half: "後半" })} />後半</label></fieldset>
    </section>
    <section className="analysis-results" aria-label="定期調査一覧">
      {groups.length === 0 ? <p className="analysis-empty">条件に一致する調査データはありません。</p> : groups.map((group) => {
        const expanded = expandedYears.has(group.year);
        return <section className="analysis-year" key={group.year}>
          <button className="analysis-year-heading" type="button" onClick={() => setExpandedYears((years) => { const next = new Set(years); if (expanded) next.delete(group.year); else next.add(group.year); return next; })}>
            <span aria-hidden="true">{expanded ? "▼" : "▶"}</span> {group.year}年（{group.rows.length}件）
          </button>
          {expanded && <div className="analysis-table">
            <div className="analysis-column-headings"><div className="analysis-identity"><span>日付</span><span>園地</span></div><div className="analysis-scroll-area"><div className="analysis-values"><span>横径</span><span>Δ</span><span>糖度</span><span>Δ</span><span>酸度</span><span>Δ</span></div></div></div>
            {group.rows.map(row)}
          </div>}
        </section>;
      })}
    </section>
  </main>;
}
