"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildPeriodicAnalysis } from "../../features/periodic-analysis/periodic-analysis";
import type { PeriodicAnalysisQuery, PeriodicAnalysisRow } from "../../features/periodic-analysis/periodic-analysis.types";
import { formatDifference } from "../../features/periodic-analysis/periodic-analysis-display";
import { columns, displayDay, initialColumns, type ColumnContext, type ColumnKey, type RainfallStation } from "../../features/periodic-analysis/periodic-analysis-columns";
import { getVarietyCategory } from "../../features/periodic-analysis/variety-category";
import type { PredictionRecordResult } from "../../features/prediction-integration/prediction-integration.types";
import type { DailyWeatherRecord } from "../../features/weather/weather-30-day";

const fallbackCategories = ["ゆら早生", "早生(宮川・興津 等、又は山下紅)", "田口", "中生(向山など)", "晩生", "丹生系"];
const fiscalMonthOrder = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

const AnalysisRow = ({ context, record, visibleColumns }: { context: ColumnContext; record: PeriodicAnalysisRow; visibleColumns: ColumnKey[] }) => (
  <div className="analysis-row">
    <div className="analysis-identity" title={`${record.orchard ?? "—"}${record.treatment ? `／${record.treatment}` : ""}${record.originalOrchard && record.originalOrchard !== record.orchard ? `（Input: ${record.originalOrchard}）` : ""}`}>
      <span title={record.measuredAt}>{displayDay(record.measuredAt)}</span>
      {record.treatment ? (
        <div className="analysis-orchard-stack">
          <span className="analysis-orchard-name">{record.orchard ?? "—"}</span>
          <span className="analysis-treatment">{record.treatment}</span>
        </div>
      ) : (
        <span>{record.orchard ?? "—"}</span>
      )}
    </div>
    <div className="analysis-values" style={{ gridTemplateColumns: visibleColumns.map((column) => `${columns[column].width}px`).join(" ") }}>
        {visibleColumns.map((column) => {
          const value = columns[column].value(record, context);
          const differenceValue = columns[column].differenceValue?.(record);
          const differenceTone = differenceValue === undefined ? null : formatDifference(differenceValue, 0).tone;
          const differenceClass = differenceTone === "positive" ? "analysis-positive" : differenceTone === "negative" ? "analysis-negative" : differenceTone === "neutral" ? "analysis-neutral" : "";
          const toneClass = columns[column].tone ? `analysis-metric-${columns[column].tone}` : "";
          const className = [toneClass, differenceClass].filter(Boolean).join(" ") || undefined;
          return <span className={className} key={column} title={value}>{value}</span>;
        })}
    </div>
  </div>
);

export function PeriodicAnalysisClient({ dataError, orchardMasterWarning, predictionError, predictions, records, weatherRecords, weatherWarning }: {
  dataError: string | null;
  orchardMasterWarning: string | null;
  predictionError: string | null;
  predictions: readonly PredictionRecordResult[];
  records: readonly AnalysisDataRecord[];
  weatherRecords: readonly DailyWeatherRecord[];
  weatherWarning: string | null;
}) {
  const availableCategories = useMemo(() => [...new Set(records.map((record) => getVarietyCategory(record.variety)).filter((category): category is string => category !== null))], [records]);
  const categoryOptions = availableCategories.length > 0 ? availableCategories : fallbackCategories;
  const initialRecord = records.find((record) => getVarietyCategory(record.variety) !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(record.surveyMonth) && (record.surveyPeriod === "前半" || record.surveyPeriod === "後半"));
  const initialQuery: PeriodicAnalysisQuery = initialRecord ? {
    varietyCategory: getVarietyCategory(initialRecord.variety)!,
    month: Number(initialRecord.surveyMonth.slice(5)),
    half: initialRecord.surveyPeriod as "前半" | "後半",
  } : { varietyCategory: categoryOptions[0], month: 7, half: "前半" };
  const [query, setQuery] = useState<PeriodicAnalysisQuery>(initialQuery);
  const groups = useMemo(() => buildPeriodicAnalysis(records, query, predictions), [records, query, predictions]);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [visible, setVisible] = useState(initialColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [rainfallStation, setRainfallStation] = useState<RainfallStation>("yuasa");
  const scrollContainers = useRef<(HTMLDivElement | null)[]>([]);
  const visibleColumns = (Object.keys(visible) as ColumnKey[]).filter((column) => visible[column]);
  const columnContext = useMemo<ColumnContext>(() => ({ rainfallStation, weatherRecords }), [rainfallStation, weatherRecords]);
  const tableWidth = 140 + visibleColumns.reduce((width, column) => width + columns[column].width, 0);
  const total = groups.reduce((count, group) => count + group.rows.length, 0);

  useEffect(() => setExpandedYears(new Set(groups.map((group) => group.year))), [groups]);
  useEffect(() => { scrollContainers.current.length = groups.length; }, [groups.length]);

  const syncHorizontalScroll = (source: HTMLDivElement) => {
    for (const target of scrollContainers.current) {
      if (target && target !== source && target.scrollLeft !== source.scrollLeft) {
        target.scrollLeft = source.scrollLeft;
      }
    }
  };

  return <main className="analysis-page">
    <header className="analysis-title"><Link className="home-link" href="/">← ホーム</Link><p className="eyebrow">ANALYSIS</p><h1>定期調査分析</h1></header>
    <section className="analysis-filters" aria-label="検索条件">
      <label>品種<select value={query.varietyCategory} onChange={(event) => setQuery({ ...query, varietyCategory: event.target.value })}>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>月<select value={query.month} onChange={(event) => setQuery({ ...query, month: Number(event.target.value) })}>{fiscalMonthOrder.map((month) => <option key={month} value={month}>{month}月</option>)}</select></label>
      <fieldset><legend>区分</legend><label><input checked={query.half === "前半"} name="half" type="radio" value="前半" onChange={() => setQuery({ ...query, half: "前半" })} />前半</label><label><input checked={query.half === "後半"} name="half" type="radio" value="後半" onChange={() => setQuery({ ...query, half: "後半" })} />後半</label></fieldset>
      <label className="analysis-rainfall-station">降水地点<select value={rainfallStation} onChange={(event) => setRainfallStation(event.target.value as RainfallStation)}><option value="yuasa">湯浅</option><option value="kawabe">川辺</option></select></label>
    </section>
    <section className="analysis-results" aria-label="定期調査一覧">
      {orchardMasterWarning && <p className="analysis-master-warning" role="status">{orchardMasterWarning}</p>}
      {predictionError && <p className="analysis-prediction-error" role="status">{predictionError}</p>}
      {weatherWarning && <p className="analysis-weather-warning" role="status">{weatherWarning}</p>}
      <div className="analysis-result-summary"><span>検索結果</span><strong>{total}件</strong>{groups.length > 0 && <small>（{groups[0].year}〜{groups[groups.length - 1].year}年）</small>}<button type="button" onClick={() => setShowColumnPicker(!showColumnPicker)}>表示項目</button></div>
      {showColumnPicker && <div className="analysis-column-picker" aria-label="表示項目">
        {(Object.keys(columns) as ColumnKey[]).map((column) => <label key={column}><input checked={visible[column]} type="checkbox" onChange={() => setVisible({ ...visible, [column]: !visible[column] })} />{columns[column].label}</label>)}
      </div>}
      {dataError ? <p className="analysis-empty">{dataError}</p> : groups.length === 0 ? <p className="analysis-empty">条件に一致する調査データはありません。</p> : groups.map((group, groupIndex) => {
        const expanded = expandedYears.has(group.year);
        return <section className="analysis-year" key={group.year}>
          <button className="analysis-year-heading" type="button" onClick={() => setExpandedYears((years) => { const next = new Set(years); if (expanded) next.delete(group.year); else next.add(group.year); return next; })}>
            <span aria-hidden="true">{expanded ? "▼" : "▶"}</span> {group.year}年（{group.rows.length}件）
          </button>
          {expanded && <div
            className="analysis-table-scroll"
            aria-label={`${group.year}年の調査結果。表を横にスクロールできます。`}
            ref={(element) => { scrollContainers.current[groupIndex] = element; }}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <div className="analysis-table" style={{ minWidth: `${tableWidth}px` }}>
              <div className="analysis-column-headings"><div className="analysis-identity"><span>日付</span><span>園地</span></div><div className="analysis-values" style={{ gridTemplateColumns: visibleColumns.map((column) => `${columns[column].width}px`).join(" ") }}>{visibleColumns.map((column) => <span className={columns[column].tone ? `analysis-metric-${columns[column].tone}` : undefined} key={column}>{columns[column].label}</span>)}</div></div>
              {group.rows.map((record) => <AnalysisRow context={columnContext} key={record.registrationId} record={record} visibleColumns={visibleColumns} />)}
            </div>
          </div>}
        </section>;
      })}
    </section>
  </main>;
}
