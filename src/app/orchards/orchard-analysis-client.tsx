"use client";

import { useMemo, useState } from "react";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildOrchardAnalysis, getOrchardAnalysisFilterOptions, getOrchardSelectionOptions, orchardSelectionKey } from "../../features/orchard-analysis/orchard-analysis";
import type { OrchardAnalysisQuery, OrchardAnalysisRow } from "../../features/orchard-analysis/orchard-analysis.types";

const displayNumber = (value: number | null, digits: number): string => value === null ? "—" : value.toFixed(digits);
const displayDate = (value: string): string => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : `${date.getMonth() + 1}/${date.getDate()}`; };

type ColumnKey = "diameter" | "brix" | "acidity" | "predictedDiameter" | "predictedBrix" | "predictedAcidity" | "rainfall30Days" | "averageTemperature30Days";
type ResultColumnKey = "treatment" | ColumnKey;
type Column = { label: string; width: number; value: (record: OrchardAnalysisRow) => string };
const columns: Record<ResultColumnKey, Column> = {
  treatment: { label: "処理区", width: 76, value: (record) => record.treatment ?? "（未設定）" },
  diameter: { label: "横径", width: 62, value: (record) => displayNumber(record.diameterAverage, 1) }, brix: { label: "糖度", width: 58, value: (record) => displayNumber(record.brix, 1) }, acidity: { label: "酸度", width: 58, value: (record) => displayNumber(record.acidity, 2) },
  predictedDiameter: { label: "予測横径", width: 76, value: () => "—" }, predictedBrix: { label: "予測糖度", width: 76, value: () => "—" }, predictedAcidity: { label: "予測酸度", width: 76, value: () => "—" }, rainfall30Days: { label: "30日雨量", width: 76, value: () => "—" }, averageTemperature30Days: { label: "30日平均気温", width: 92, value: () => "—" },
};
const initialColumns: Record<ColumnKey, boolean> = { diameter: true, brix: true, acidity: true, predictedDiameter: true, predictedBrix: true, predictedAcidity: true, rainfall30Days: true, averageTemperature30Days: true };

export function OrchardAnalysisClient({ dataError, orchardMasterWarning, records }: { dataError: string | null; orchardMasterWarning: string | null; records: readonly AnalysisDataRecord[] }) {
  const orchardOptions = useMemo(() => getOrchardSelectionOptions(records), [records]);
  const initialOption = orchardOptions[0];
  const initialOrchard = initialOption?.orchard ?? "";
  const initialVarieties = useMemo(() => getOrchardAnalysisFilterOptions(records, initialOrchard, undefined, initialOption?.treatment ?? null).varietyCategories, [records, initialOrchard, initialOption?.treatment]);
  const [query, setQuery] = useState<OrchardAnalysisQuery>({ orchard: initialOrchard, varietyCategory: initialVarieties[0] ?? "", treatment: initialOption?.treatment ?? null });
  const [visible, setVisible] = useState(initialColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const varietyCategories = useMemo(() => getOrchardAnalysisFilterOptions(records, query.orchard, undefined, query.treatment ?? null).varietyCategories, [records, query.orchard, query.treatment]);
  const timeline = useMemo(() => buildOrchardAnalysis(records, query), [records, query]);
  const visibleColumns = (Object.keys(visible) as ColumnKey[]).filter((column) => visible[column]);
  const resultColumns: ResultColumnKey[] = visibleColumns;
  const recordCount = timeline.filter((entry) => entry.type === "record").length;
  const valuesTemplate = resultColumns.map((column) => `${columns[column].width}px`).join(" ");
  const tableWidth = 58 + resultColumns.reduce((width, column) => width + columns[column].width, 0);
  const changeOrchard = (key: string) => {
    const option = orchardOptions.find((candidate) => candidate.key === key);
    if (!option) return;
    const nextVarieties = getOrchardAnalysisFilterOptions(records, option.orchard, undefined, option.treatment).varietyCategories;
    setQuery({ orchard: option.orchard, treatment: option.treatment, varietyCategory: nextVarieties[0] ?? "" });
  };
  const changeVarietyCategory = (varietyCategory: string) => setQuery({ ...query, varietyCategory });

  return <main className="orchard-page">
    <header className="orchard-title"><p className="eyebrow">ORCHARDS</p><h1>園地分析</h1><p>1回の調査を1行として表示する時系列カルテです。</p><a className="orchard-compare-link" href="/orchards/compare">2園地を比較する →</a></header>
    <section className="orchard-filters" aria-label="園地分析の検索条件">
      <label>園地・処理区<select value={orchardSelectionKey(query.orchard, query.treatment ?? null)} onChange={(event) => changeOrchard(event.target.value)}>{orchardOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
      <label>品種<select value={query.varietyCategory} onChange={(event) => changeVarietyCategory(event.target.value)}>{varietyCategories.map((variety) => <option key={variety} value={variety}>{variety}</option>)}</select></label>
    </section>
    <section className="orchard-results" aria-label="園地分析の時系列一覧">
      {orchardMasterWarning && <p className="orchard-master-warning" role="status">{orchardMasterWarning}</p>}
      <div className="orchard-result-summary"><span>検索結果</span><strong>{recordCount}件</strong><button type="button" onClick={() => setShowColumnPicker(!showColumnPicker)}>表示項目</button></div>
      {showColumnPicker && <div className="orchard-column-picker" aria-label="表示項目">{(Object.keys(columns) as ColumnKey[]).map((column) => <label key={column}><input checked={visible[column]} type="checkbox" onChange={() => setVisible({ ...visible, [column]: !visible[column] })} />{columns[column].label}</label>)}</div>}
      {dataError ? <p className="orchard-empty">{dataError}</p> : recordCount === 0 ? <p className="orchard-empty">条件に一致する調査データはありません。</p> : <div className="orchard-table"><div className="orchard-horizontal-scroll"><div className="orchard-table-content" style={{ minWidth: tableWidth }}>
        <div className="orchard-column-headings"><div className="orchard-date">日付</div><div className="orchard-values" style={{ gridTemplateColumns: valuesTemplate }}>{resultColumns.map((column) => <span key={column}>{columns[column].label}</span>)}</div></div>
        {timeline.map((entry) => entry.type === "year" ? <div className="orchard-year-divider" key={`year-${entry.year}`}>{entry.year}年</div> : <div className="orchard-row" key={entry.row.registrationId}><div className="orchard-date">{displayDate(entry.row.measuredAt)}</div><div className="orchard-values" style={{ gridTemplateColumns: valuesTemplate }}>{resultColumns.map((column) => <span key={column}>{columns[column].value(entry.row)}</span>)}</div></div>)}
      </div></div></div>}
    </section>
  </main>;
}
