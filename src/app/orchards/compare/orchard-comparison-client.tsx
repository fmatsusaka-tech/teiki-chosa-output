"use client";

import { useMemo, useState } from "react";
import type { AnalysisDataRecord } from "../../../contracts/analysis-data";
import { buildOrchardComparison, getOrchardAnalysisFilterOptions } from "../../../features/orchard-analysis/orchard-analysis";
import type { OrchardComparisonMetric, OrchardComparisonRecord, OrchardComparisonSelection } from "../../../features/orchard-analysis/orchard-analysis.types";

const allTreatments = "__all__";
const unsetTreatment = "__unset__";
type Side = "A" | "B";
type MetricFilter = "all" | "diameter" | "brix" | "acidity" | "ratio";
type MetricDefinition = { key: OrchardComparisonMetric; label: string; digits: number; filter: MetricFilter };

const metrics: readonly MetricDefinition[] = [
  { key: "averageDiameter", label: "平均横径", digits: 1, filter: "diameter" },
  { key: "minimumDiameter", label: "最小横径", digits: 1, filter: "diameter" },
  { key: "maximumDiameter", label: "最大横径", digits: 1, filter: "diameter" },
  { key: "brix", label: "糖度", digits: 1, filter: "brix" },
  { key: "acidity", label: "クエン酸", digits: 2, filter: "acidity" },
  { key: "brixAcidityRatio", label: "糖酸比", digits: 1, filter: "ratio" },
];

const filterLabels: readonly [MetricFilter, string][] = [["diameter", "横径"], ["brix", "糖度"], ["acidity", "クエン酸"], ["ratio", "糖酸比"], ["all", "すべて"]];
const displayNumber = (value: number | null | undefined, digits: number): string => value == null ? "—" : value.toFixed(digits);
const displayDate = (value: string): string => `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;

type SelectionControlsProps = {
  side: Side;
  records: readonly AnalysisDataRecord[];
  selection: OrchardComparisonSelection;
  treatmentValue: string;
  onSelection: (selection: OrchardComparisonSelection) => void;
  onTreatment: (value: string) => void;
};

function SelectionControls({ side, records, selection, treatmentValue, onSelection, onTreatment }: SelectionControlsProps) {
  const base = getOrchardAnalysisFilterOptions(records);
  const varieties = getOrchardAnalysisFilterOptions(records, selection.orchard).varietyCategories;
  const treatments = getOrchardAnalysisFilterOptions(records, selection.orchard, selection.varietyCategory).treatments;
  const changeOrchard = (orchard: string) => {
    const nextVarieties = getOrchardAnalysisFilterOptions(records, orchard).varietyCategories;
    onSelection({ orchard, varietyCategory: nextVarieties[0] ?? "" });
    onTreatment(allTreatments);
  };
  const changeVariety = (varietyCategory: string) => {
    onSelection({ orchard: selection.orchard, varietyCategory });
    onTreatment(allTreatments);
  };
  return <fieldset className={`comparison-selector comparison-selector-${side.toLowerCase()}`}>
    <legend>園地{side}</legend>
    <label>園地<select value={selection.orchard} onChange={(event) => changeOrchard(event.target.value)}>{base.orchards.map((orchard) => <option key={orchard}>{orchard}</option>)}</select></label>
    <label>品種<select value={selection.varietyCategory} onChange={(event) => changeVariety(event.target.value)}>{varieties.map((variety) => <option key={variety}>{variety}</option>)}</select></label>
    <label>処理区<select value={treatmentValue} onChange={(event) => {
      const value = event.target.value;
      onTreatment(value);
      onSelection({ ...selection, ...(value === allTreatments ? { treatment: undefined } : { treatment: value === unsetTreatment ? null : value }) });
    }}><option value={allTreatments}>すべて</option>{treatments.map((treatment) => <option key={treatment ?? unsetTreatment} value={treatment ?? unsetTreatment}>{treatment ?? "（未設定）"}</option>)}</select></label>
  </fieldset>;
}

const sideLabel = (side: Side, selection: OrchardComparisonSelection): string => {
  const treatment = selection.treatment === undefined ? "" : ` / ${selection.treatment ?? "処理区未設定"}`;
  return `園地${side} ${selection.orchard}${treatment}`;
};

function LatestCard({ side, selection, record }: { side: Side; selection: OrchardComparisonSelection; record: OrchardComparisonRecord | null }) {
  return <article className={`comparison-latest comparison-latest-${side.toLowerCase()}`}>
    <h2>{sideLabel(side, selection)}</h2>
    <dl>
      <div><dt>平均横径</dt><dd>{displayNumber(record?.averageDiameter, 1)}</dd></div>
      <div><dt>糖度</dt><dd>{displayNumber(record?.brix, 1)}</dd></div>
      <div><dt>クエン酸</dt><dd>{displayNumber(record?.acidity, 2)}</dd></div>
      <div><dt>最終計測日</dt><dd>{record?.measuredAt ?? "—"}</dd></div>
    </dl>
  </article>;
}

export function OrchardComparisonClient({ dataError, records }: { dataError: string | null; records: readonly AnalysisDataRecord[] }) {
  const options = useMemo(() => getOrchardAnalysisFilterOptions(records), [records]);
  const first = options.orchards[0] ?? "";
  const second = options.orchards[1] ?? first;
  const firstVariety = getOrchardAnalysisFilterOptions(records, first).varietyCategories[0] ?? "";
  const secondVariety = getOrchardAnalysisFilterOptions(records, second).varietyCategories[0] ?? "";
  const [orchardA, setOrchardA] = useState<OrchardComparisonSelection>({ orchard: first, varietyCategory: firstVariety });
  const [orchardB, setOrchardB] = useState<OrchardComparisonSelection>({ orchard: second, varietyCategory: secondVariety });
  const [treatmentA, setTreatmentA] = useState(allTreatments);
  const [treatmentB, setTreatmentB] = useState(allTreatments);
  const [metricFilter, setMetricFilter] = useState<MetricFilter>("all");
  const comparison = useMemo(() => buildOrchardComparison(records, orchardA, orchardB), [records, orchardA, orchardB]);
  const visibleMetrics = metrics.filter((metric) => metricFilter === "all" || metric.filter === metricFilter);

  return <main className="comparison-page">
    <header className="comparison-title"><p className="eyebrow">COMPARE</p><h1>2園地比較</h1><p>実際の計測日を横軸に並べ、近い日付を統合せず比較します。</p></header>
    <section className="comparison-selectors" aria-label="比較する園地">
      <SelectionControls side="A" records={records} selection={orchardA} treatmentValue={treatmentA} onSelection={setOrchardA} onTreatment={setTreatmentA} />
      <SelectionControls side="B" records={records} selection={orchardB} treatmentValue={treatmentB} onSelection={setOrchardB} onTreatment={setTreatmentB} />
    </section>
    {dataError ? <p className="comparison-empty">{dataError}</p> : <>
      <section className="comparison-latest-grid" aria-label="各園地の最新値"><LatestCard side="A" selection={orchardA} record={comparison.latestA} /><LatestCard side="B" selection={orchardB} record={comparison.latestB} /></section>
      <section className="comparison-results" aria-label="2園地の時系列比較">
        <div className="comparison-filter" role="group" aria-label="指標絞込み">{filterLabels.map(([value, label]) => <button type="button" aria-pressed={metricFilter === value} key={value} onClick={() => setMetricFilter(value)}>{label}</button>)}</div>
        {comparison.columns.length === 0 ? <p className="comparison-empty">条件に一致する調査データはありません。</p> : <>
          <p className="comparison-scroll-hint">← 横にスクロールして日付を確認できます →</p>
          <div className="comparison-scroll" tabIndex={0} aria-label="日付を横方向にスクロールできる比較表">
            <table className="comparison-table">
              <thead><tr><th className="comparison-metric-heading" scope="col">指標</th><th className="comparison-orchard-heading" scope="col">園地</th>{comparison.columns.map((column) => <th className={column.yearBoundary ? "comparison-year-boundary" : ""} key={column.key} scope="col"><span>{column.measuredAt.slice(0, 4)}年</span>{displayDate(column.measuredAt)}</th>)}</tr></thead>
              <tbody>{visibleMetrics.flatMap((metric) => (["A", "B"] as const).map((side, sideIndex) => <tr className={`comparison-row comparison-row-${side.toLowerCase()} ${sideIndex === 0 ? "comparison-metric-start" : ""}`} key={`${metric.key}-${side}`}>
                {sideIndex === 0 && <th className="comparison-metric" rowSpan={2} scope="rowgroup">{metric.label}</th>}
                <th className="comparison-orchard" scope="row">{sideLabel(side, side === "A" ? orchardA : orchardB)}</th>
                {comparison.columns.map((column) => <td className={column.yearBoundary ? "comparison-year-boundary" : ""} key={column.key}>{displayNumber((side === "A" ? column.orchardA : column.orchardB)?.[metric.key], metric.digits)}</td>)}
              </tr>))}</tbody>
            </table>
          </div>
        </>}
      </section>
    </>}
  </main>;
}
