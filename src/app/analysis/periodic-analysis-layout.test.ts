import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./periodic-analysis-client.tsx", import.meta.url), "utf8");
const columns = readFileSync(new URL("../../features/periodic-analysis/periodic-analysis-columns.ts", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("./periodic-analysis.css", import.meta.url), "utf8");

describe("periodic analysis table layout", () => {
  it("uses one horizontal scroll container for the heading and every row", () => {
    expect(component.match(/className="analysis-table-scroll"/g)).toHaveLength(1);
    expect(component).not.toContain("analysis-scroll-area");
    expect(component).toContain("group.rows.map");
    expect(stylesheet).toMatch(/\.analysis-table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  });

  it("keeps the identity cells visible without making the page itself scroll", () => {
    expect(stylesheet).toMatch(/\.analysis-table-scroll\s*\{[^}]*max-width:\s*100%/);
    expect(stylesheet).toMatch(/\.analysis-identity\s*\{[^}]*position:\s*sticky[^}]*left:\s*0/);
  });

  it("synchronizes horizontal scrolling across every expanded year", () => {
    expect(component).toContain("const scrollContainers = useRef");
    expect(component).toContain("target.scrollLeft = source.scrollLeft");
    expect(component).toContain("onScroll={(event) => syncHorizontalScroll(event.currentTarget)}");
  });

  it("keeps sticky identity cells opaque while metric cells scroll underneath", () => {
    expect(stylesheet).toMatch(/\.analysis-column-headings \.analysis-identity\s*\{[^}]*background:\s*#f8faf7/);
    expect(stylesheet).toMatch(/\.analysis-row \.analysis-identity\s*\{[^}]*background:\s*#fff/);
    expect(stylesheet).toMatch(/\.analysis-row:nth-child\(even\) \.analysis-identity\s*\{[^}]*background:\s*#fbfcfa/);
    expect(stylesheet).toMatch(/\.analysis-row:hover \.analysis-identity\s*\{[^}]*background:\s*#f2f7f1/);
  });

  it("keeps the column headings in normal table flow instead of pushing them over data rows", () => {
    expect(stylesheet).toMatch(/\.analysis-column-headings\s*\{[^}]*position:\s*relative/);
    expect(stylesheet).not.toMatch(/\.analysis-column-headings\s*\{[^}]*top:\s*140px/);
    expect(stylesheet).not.toMatch(/\.analysis-column-headings\s*\{[^}]*top:/);
  });

  it("keeps every harvest prediction column compact on mobile", () => {
    expect(columns.match(/Prediction:\s*\{[^}]*width:\s*58/g)).toHaveLength(3);
    expect(columns).not.toMatch(/Prediction:\s*\{[^}]*width:\s*150/);
  });

  it("offers selectable Yuasa and Kawabe rainfall stations", () => {
    expect(component).toContain("降水地点");
    expect(component).toContain('<option value="yuasa">湯浅</option>');
    expect(component).toContain('<option value="kawabe">川辺</option>');
    expect(component).not.toContain("analysis-future-option");
  });

  it("offers a visible home navigation link", () => {
    expect(component).toContain('className="home-link" href="/"');
    expect(component).toContain("← ホーム");
  });

  it("uses separate subtle backgrounds for diameter, brix, and acidity columns", () => {
    expect(columns).toContain('tone: "diameter"');
    expect(columns).toContain('tone: "brix"');
    expect(columns).toContain('tone: "acidity"');
    expect(stylesheet).toMatch(/\.analysis-values \.analysis-metric-diameter\s*\{[^}]*background:\s*#f1f7fb/);
    expect(stylesheet).toMatch(/\.analysis-values \.analysis-metric-brix\s*\{[^}]*background:\s*#fff9e8/);
    expect(stylesheet).toMatch(/\.analysis-values \.analysis-metric-acidity\s*\{[^}]*background:\s*#fff2f5/);
  });

  it("prioritizes the day in the narrow mobile date cell", () => {
    expect(columns).toContain('return match ? `${Number(match[2])}日` : "—"');
    expect(component).toContain("<span title={record.measuredAt}>{displayDay(record.measuredAt)}</span>");
    expect(stylesheet).toMatch(/\.analysis-identity\s*\{[^}]*grid-template-columns:\s*60px 72px[^}]*flex:\s*0 0 132px/);
    expect(component).toContain("const tableWidth = 132 + visibleColumns.reduce");
  });

  it("places detailed diameter columns after the weather columns", () => {
    const averageIndex = columns.indexOf('diameter: { label: "平均横径"');
    const brixIndex = columns.indexOf('brix: { label: "糖度"');
    const rainfallIndex = columns.indexOf('rainfall30Days: { label:');
    const temperatureIndex = columns.indexOf('temperature30Days: { label:');
    const minimumIndex = columns.indexOf('minimumDiameter: { label: "最小横径"');
    const maximumIndex = columns.indexOf('maximumDiameter: { label: "最大横径"');

    expect(averageIndex).toBeLessThan(brixIndex);
    expect(rainfallIndex).toBeLessThan(temperatureIndex);
    expect(temperatureIndex).toBeLessThan(minimumIndex);
    expect(minimumIndex).toBeLessThan(maximumIndex);
  });

  it("opens an orchard normal-value comparison from each data row", () => {
    expect(component).toContain("の平年比較を表示");
    expect(component).toContain("同じ調査基準月・前後半の平均と比較します");
    expect(component).toContain("analysis-chart-current");
    expect(component).toContain("analysis-chart-normal");
  });

  it("highlights harvest predictions that meet the diameter, brix, and acidity targets", () => {
    expect(component).toContain('column === "diameterPrediction"');
    expect(component).toContain("metrics.横径.rawPrediction >= 55");
    expect(component).toContain("metrics.横径.rawPrediction <= 67");
    expect(component).toContain('column === "brixPrediction"');
    expect(component).toContain("metrics.糖度.rawPrediction >= 12");
    expect(component).toContain('column === "acidityPrediction"');
    expect(component).toContain("metrics.クエン酸.rawPrediction <= 1.1");
    expect(component).toContain('"analysis-harvest-target"');
    expect(stylesheet).toMatch(/\.analysis-values \.analysis-harvest-target\s*\{[^}]*background:\s*#ffe5bd[^}]*box-shadow:/);
    expect(columns).not.toContain("mm`");
  });
});
