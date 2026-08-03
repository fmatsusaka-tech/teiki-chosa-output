import { describe, expect, it } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildAnalysisDataVisibilitySummary } from "./analysis-data-visibility";

const record = (overrides: Partial<AnalysisDataRecord>): AnalysisDataRecord => ({
  id: "id-1", registeredAt: null, measuredAt: "2026-07-01", fiscalYear: 2026, year: 2026, month: 7,
  surveyMonth: "2026-07", surveyPeriod: "前半", orchard: "吉川", variety: "ゆら早生", treatment: null,
  notes: null, diameterCount: null, averageDiameter: 42.1, minimumDiameter: null, maximumDiameter: null,
  brix: 9.3, acidity: 1.4, brixAcidityRatio: null, dataStatus: "正常", activationStatus: null, inputMethod: "", enteredBy: null, source: null,
  ...overrides,
});

describe("buildAnalysisDataVisibilitySummary", () => {
  it("counts only enabled records and ignores fully visible ones", () => {
    const summary = buildAnalysisDataVisibilitySummary([
      record({ id: "visible" }),
      record({ id: "disabled", activationStatus: "無効", measuredAt: null }),
    ]);

    expect(summary.totalEnabledRecords).toBe(1);
    expect(summary.hiddenFromEveryScreen).toHaveLength(0);
  });

  it("does not flag a record missing only 園地名, since periodic analysis still shows it", () => {
    const summary = buildAnalysisDataVisibilitySummary([record({ id: "no-orchard", orchard: null })]);

    expect(summary.hiddenFromEveryScreen).toHaveLength(0);
  });

  it("does not flag a record with an unparseable 調査基準月, since orchard analysis still shows it", () => {
    const summary = buildAnalysisDataVisibilitySummary([record({ id: "bad-survey-month", surveyMonth: "unknown" })]);

    expect(summary.hiddenFromEveryScreen).toHaveLength(0);
  });

  it("flags a record with no 計測日 as hidden from every screen", () => {
    const summary = buildAnalysisDataVisibilitySummary([record({ id: "no-date", measuredAt: null })]);

    expect(summary.hiddenFromEveryScreen).toMatchObject([{ id: "no-date", reasons: ["missing_measured_at"] }]);
    expect(summary.reasonCounts.missing_measured_at).toBe(1);
  });

  it("flags a record with a blank 品種 as hidden from every screen", () => {
    const summary = buildAnalysisDataVisibilitySummary([record({ id: "no-variety", variety: null })]);

    expect(summary.hiddenFromEveryScreen).toMatchObject([{ id: "no-variety", reasons: ["missing_variety"] }]);
  });

  it("does not flag a record whose 品種 is not a known alias, since it still gets its own category", () => {
    const summary = buildAnalysisDataVisibilitySummary([record({ id: "unrecognized-variety", variety: "謎の品種" })]);

    expect(summary.hiddenFromEveryScreen).toHaveLength(0);
  });

  it("flags a non-standard データ状態 as hidden from every screen", () => {
    const summary = buildAnalysisDataVisibilitySummary([record({ id: "cancelled", dataStatus: "取消" })]);

    expect(summary.hiddenFromEveryScreen).toMatchObject([{ id: "cancelled", reasons: ["non_standard_status"] }]);
  });

  it("combines multiple reasons for the same record", () => {
    const summary = buildAnalysisDataVisibilitySummary([
      record({ id: "many-issues", measuredAt: null, orchard: null, variety: null }),
    ]);

    expect(summary.hiddenFromEveryScreen[0].reasons).toEqual(
      expect.arrayContaining(["missing_measured_at", "missing_variety", "missing_orchard"]),
    );
    expect(summary.reasonCounts.missing_orchard).toBe(1);
  });
});
