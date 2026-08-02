"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildPeriodicAnalysis } from "../../features/periodic-analysis/periodic-analysis";
import type { PeriodicAnalysisQuery, PeriodicAnalysisRow } from "../../features/periodic-analysis/periodic-analysis.types";
import { formatDifference } from "../../features/periodic-analysis/periodic-analysis-display";
import { getVarietyCategory } from "../../features/periodic-analysis/variety-category";
import type { PredictionMetricResult, PredictionRecordResult } from "../../features/prediction-integration/prediction-integration.types";
import { aggregateWeather30Days, type DailyWeatherRecord, type WeatherMetricOutcome } from "../../features/weather/weather-30-day";

const fallbackCategories = ["ゆら早生", "早生(宮川・興津 等、又は山下紅)", "田口", "中生(向山など)", "晩生", "丹生系"];

const displayNumber = (value: number | null, digits: number): string => value === null ? "—" : value.toFixed(digits);
const displayPrediction = (result: PredictionMetricResult | undefined, digits: number): string => {
  if (!result) return "—";
  return result.ok ? result.predictedValue.toFixed(digits) : `— ${result.message}`;
};
const displayDay = (value: string): string => {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${Number(match[2])}日` : "—";
};

type ColumnKey = "diameter" | "diameterDifference" | "diameterPrediction"
  | "minimumDiameter" | "minimumDiameterDifference"
  | "maximumDiameter" | "maximumDiameterDifference"
  | "brix" | "brixDifference" | "brixPrediction"
  | "acidity" | "acidityDifference" | "acidityPrediction"
  | "brixAcidityRatio" | "brixAcidityRatioDifference"
  | "rainfall30Days" | "temperature30Days";

type RainfallStation = "yuasa" | "kawabe";
type ColumnContext = { rainfallStation: RainfallStation; weatherRecords: readonly DailyWeatherRecord[] };
type MetricTone = "diameter" | "brix" | "acidity";

const displayWeather = (outcome: WeatherMetricOutcome, digits: number): string => outcome.ok ? outcome.value.toFixed(digits) : "—";

const columns: Record<ColumnKey, { label: string; width: number; tone?: MetricTone; value: (record: PeriodicAnalysisRow, context: ColumnContext) => string; differenceValue?: (record: PeriodicAnalysisRow) => number | null }> = {
  diameter: { label: "平均横径", width: 70, tone: "diameter", value: (record) => displayNumber(record.diameterAverage, 1) },
  diameterDifference: { label: "前回差", width: 58, tone: "diameter", value: (record) => formatDifference(record.previousDifference.diameterAverage, 1).text, differenceValue: (record) => record.previousDifference.diameterAverage },
  diameterPrediction: { label: "収穫時予測", width: 96, tone: "diameter", value: (record) => displayPrediction(record.prediction?.metrics.横径, 1) },
  minimumDiameter: { label: "最小横径", width: 70, tone: "diameter", value: (record) => displayNumber(record.diameterMinimum, 1) },
  minimumDiameterDifference: { label: "前回差", width: 58, tone: "diameter", value: (record) => formatDifference(record.previousDifference.diameterMinimum, 1).text, differenceValue: (record) => record.previousDifference.diameterMinimum },
  maximumDiameter: { label: "最大横径", width: 70, tone: "diameter", value: (record) => displayNumber(record.diameterMaximum, 1) },
  maximumDiameterDifference: { label: "前回差", width: 58, tone: "diameter", value: (record) => formatDifference(record.previousDifference.diameterMaximum, 1).text, differenceValue: (record) => record.previousDifference.diameterMaximum },
  brix: { label: "糖度", width: 58, tone: "brix", value: (record) => displayNumber(record.brix, 1) },
  brixDifference: { label: "前回差", width: 58, tone: "brix", value: (record) => formatDifference(record.previousDifference.brix, 1).text, differenceValue: (record) => record.previousDifference.brix },
  brixPrediction: { label: "収穫時予測", width: 96, tone: "brix", value: (record) => displayPrediction(record.prediction?.metrics.糖度, 1) },
  acidity: { label: "クエン酸", width: 68, tone: "acidity", value: (record) => displayNumber(record.acidity, 2) },
  acidityDifference: { label: "前回差", width: 58, tone: "acidity", value: (record) => formatDifference(record.previousDifference.acidity, 2).text, differenceValue: (record) => record.previousDifference.acidity },
  acidityPrediction: { label: "収穫時予測", width: 96, tone: "acidity", value: (record) => displayPrediction(record.prediction?.metrics.クエン酸, 2) },
  brixAcidityRatio: { label: "糖酸比", width: 62, value: (record) => displayNumber(record.brixAcidityRatio, 1) },
  brixAcidityRatioDifference: { label: "前回差", width: 58, value: (record) => formatDifference(record.previousDifference.brixAcidityRatio, 1).text, differenceValue: (record) => record.previousDifference.brixAcidityRatio },
  rainfall30Days: { label: "30日降水量", width: 88, value: (record, context) => displayWeather(aggregateWeather30Days({ measuredAt: record.measuredAt, precipitationStationId: context.rainfallStation, temperatureStationId: "kawabe", records: context.weatherRecords }).precipitation, 1) },
  temperature30Days: { label: "30日平均気温", width: 96, value: (record, context) => displayWeather(aggregateWeather30Days({ measuredAt: record.measuredAt, precipitationStationId: context.rainfallStation, temperatureStationId: "kawabe", records: context.weatherRecords }).meanTemperature, 1) },
};

const initialColumns = Object.fromEntries(
  (Object.keys(columns) as ColumnKey[]).map((column) => [column, true]),
) as Record<ColumnKey, boolean>;

const AnalysisRow = ({ context, record, visibleColumns }: { context: ColumnContext; record: PeriodicAnalysisRow; visibleColumns: ColumnKey[] }) => (
  <div className="analysis-row">
    <div className="analysis-identity" title={`${record.orchard ?? "—"}${record.treatment ? `／${record.treatment}` : ""}${record.originalOrchard && record.originalOrchard !== record.orchard ? `（Input: ${record.originalOrchard}）` : ""}`}>
      <span title={record.measuredAt}>{displayDay(record.measuredAt)}</span><span>{record.orchard ? `${record.orchard}${record.treatment ? `／${record.treatment}` : ""}` : "—"}</span>
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
  const visibleColumns = (Object.keys(visible) as ColumnKey[]).filter((column) => visible[column]);
  const columnContext = useMemo<ColumnContext>(() => ({ rainfallStation, weatherRecords }), [rainfallStation, weatherRecords]);
  const tableWidth = 125 + visibleColumns.reduce((width, column) => width + columns[column].width, 0);
  const total = groups.reduce((count, group) => count + group.rows.length, 0);

  useEffect(() => setExpandedYears(new Set(groups.map((group) => group.year))), [groups]);

  return <main className="analysis-page">
    <header className="analysis-title"><Link className="home-link" href="/">← ホーム</Link><p className="eyebrow">ANALYSIS</p><h1>定期調査分析</h1></header>
    <section className="analysis-filters" aria-label="検索条件">
      <label>品種<select value={query.varietyCategory} onChange={(event) => setQuery({ ...query, varietyCategory: event.target.value })}>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>月<select value={query.month} onChange={(event) => setQuery({ ...query, month: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}月</option>)}</select></label>
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
      {dataError ? <p className="analysis-empty">{dataError}</p> : groups.length === 0 ? <p className="analysis-empty">条件に一致する調査データはありません。</p> : groups.map((group) => {
        const expanded = expandedYears.has(group.year);
        return <section className="analysis-year" key={group.year}>
          <button className="analysis-year-heading" type="button" onClick={() => setExpandedYears((years) => { const next = new Set(years); if (expanded) next.delete(group.year); else next.add(group.year); return next; })}>
            <span aria-hidden="true">{expanded ? "▼" : "▶"}</span> {group.year}年（{group.rows.length}件）
          </button>
          {expanded && <div className="analysis-table-scroll" aria-label={`${group.year}年の調査結果。表を横にスクロールできます。`}>
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
