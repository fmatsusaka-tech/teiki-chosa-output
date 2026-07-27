"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildPeriodicAnalysis } from "../../features/periodic-analysis/periodic-analysis";
import type { PeriodicAnalysisQuery, PeriodicAnalysisRow } from "../../features/periodic-analysis/periodic-analysis.types";
import { getVarietyCategory } from "../../features/periodic-analysis/variety-category";

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

type ColumnKey = "diameter" | "diameterDifference" | "brix" | "brixDifference" | "acidity" | "acidityDifference";
const columns: Record<ColumnKey, { label: string; width: number; value: (record: PeriodicAnalysisRow) => string }> = {
  diameter: { label: "横径", width: 62, value: (record) => displayNumber(record.diameterAverage, 1) },
  diameterDifference: { label: "Δ", width: 52, value: (record) => displayDifference(record.previousDifference.diameterAverage, 1) },
  brix: { label: "糖度", width: 58, value: (record) => displayNumber(record.brix, 1) },
  brixDifference: { label: "Δ", width: 52, value: (record) => displayDifference(record.previousDifference.brix, 1) },
  acidity: { label: "酸度", width: 58, value: (record) => displayNumber(record.acidity, 2) },
  acidityDifference: { label: "Δ", width: 58, value: (record) => displayDifference(record.previousDifference.acidity, 2) },
};
const initialColumns: Record<ColumnKey, boolean> = { diameter: true, diameterDifference: true, brix: true, brixDifference: true, acidity: true, acidityDifference: true };

const row = (record: PeriodicAnalysisRow, visibleColumns: ColumnKey[]) => (
  <div className="analysis-row" key={record.registrationId}>
    <div className="analysis-identity" title={record.orchard ?? ""}>
      <span>{displayDate(record.measuredAt)}</span><span>{record.orchard ?? "—"}</span>
    </div>
    <div className="analysis-scroll-area">
      <div className="analysis-values" style={{ gridTemplateColumns: visibleColumns.map((column) => `${columns[column].width}px`).join(" ") }}>
        {visibleColumns.map((column) => <span key={column}>{columns[column].value(record)}</span>)}
      </div>
    </div>
  </div>
);

export function PeriodicAnalysisClient({ dataError, records }: { dataError: string | null; records: readonly AnalysisDataRecord[] }) {
  const availableCategories = useMemo(() => [...new Set(records.map((record) => getVarietyCategory(record.variety)).filter((category): category is string => category !== null))], [records]);
  const categoryOptions = availableCategories.length > 0 ? availableCategories : categories;
  const initialRecord = records.find((record) => getVarietyCategory(record.variety) !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(record.surveyMonth) && (record.surveyPeriod === "前半" || record.surveyPeriod === "後半"));
  const initialQuery: PeriodicAnalysisQuery = initialRecord ? {
    varietyCategory: getVarietyCategory(initialRecord.variety)!,
    month: Number(initialRecord.surveyMonth.slice(5)),
    half: initialRecord.surveyPeriod as "前半" | "後半",
  } : { varietyCategory: categoryOptions[0], month: 7, half: "前半" };
  const [query, setQuery] = useState<PeriodicAnalysisQuery>(initialQuery);
  const groups = useMemo(() => buildPeriodicAnalysis(records, query), [records, query]);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [visible, setVisible] = useState(initialColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const visibleColumns = (Object.keys(visible) as ColumnKey[]).filter((column) => visible[column]);
  const total = groups.reduce((count, group) => count + group.rows.length, 0);

  useEffect(() => setExpandedYears(new Set(groups.map((group) => group.year))), [groups]);

  return <main className="analysis-page">
    <header className="analysis-title"><p className="eyebrow">ANALYSIS</p><h1>定期調査分析</h1></header>
    <section className="analysis-filters" aria-label="検索条件">
      <label>品種<select value={query.varietyCategory} onChange={(event) => setQuery({ ...query, varietyCategory: event.target.value })}>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>月<select value={query.month} onChange={(event) => setQuery({ ...query, month: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}月</option>)}</select></label>
      <fieldset><legend>区分</legend><label><input checked={query.half === "前半"} name="half" type="radio" value="前半" onChange={() => setQuery({ ...query, half: "前半" })} />前半</label><label><input checked={query.half === "後半"} name="half" type="radio" value="後半" onChange={() => setQuery({ ...query, half: "後半" })} />後半</label></fieldset>
    </section>
    <section className="analysis-results" aria-label="定期調査一覧">
      <div className="analysis-result-summary"><span>検索結果</span><strong>{total}件</strong>{groups.length > 0 && <small>（{groups[0].year}〜{groups[groups.length - 1].year}）</small>}<button type="button" onClick={() => setShowColumnPicker(!showColumnPicker)}>表示項目</button></div>
      {showColumnPicker && <div className="analysis-column-picker" aria-label="表示項目">
        {(Object.keys(columns) as ColumnKey[]).map((column) => <label key={column}><input checked={visible[column]} type="checkbox" onChange={() => setVisible({ ...visible, [column]: !visible[column] })} />{columns[column].label === "Δ" ? `${column.includes("diameter") ? "横径" : column.includes("brix") ? "糖度" : "酸度"}前回差` : columns[column].label}</label>)}
        <label className="analysis-future-option"><input disabled type="checkbox" />予測横径</label><label className="analysis-future-option"><input disabled type="checkbox" />予測糖度</label><label className="analysis-future-option"><input disabled type="checkbox" />予測酸度</label><label className="analysis-future-option"><input disabled type="checkbox" />30日雨量</label><label className="analysis-future-option"><input disabled type="checkbox" />積算温度</label>
      </div>}
      {dataError ? <p className="analysis-empty">{dataError}</p> : groups.length === 0 ? <p className="analysis-empty">条件に一致する調査データはありません。</p> : groups.map((group) => {
        const expanded = expandedYears.has(group.year);
        return <section className="analysis-year" key={group.year}>
          <button className="analysis-year-heading" type="button" onClick={() => setExpandedYears((years) => { const next = new Set(years); if (expanded) next.delete(group.year); else next.add(group.year); return next; })}>
            <span aria-hidden="true">{expanded ? "▼" : "▶"}</span> {group.year}年（{group.rows.length}件）
          </button>
          {expanded && <div className="analysis-table">
            <div className="analysis-column-headings"><div className="analysis-identity"><span>日付</span><span>園地</span></div><div className="analysis-scroll-area"><div className="analysis-values" style={{ gridTemplateColumns: visibleColumns.map((column) => `${columns[column].width}px`).join(" ") }}>{visibleColumns.map((column) => <span key={column}>{columns[column].label}</span>)}</div></div></div>
            {group.rows.map((record) => row(record, visibleColumns))}
          </div>}
        </section>;
      })}
    </section>
  </main>;
}
