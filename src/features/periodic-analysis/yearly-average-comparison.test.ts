import { describe, expect, it } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildYearlyAveragePoints } from "./yearly-average-comparison";

const record = (overrides: Partial<AnalysisDataRecord>): AnalysisDataRecord => ({
  id: "id", registeredAt: null, measuredAt: "2026-08-03", fiscalYear: 2026, year: 2026, month: 8,
  surveyMonth: "2026-08", surveyPeriod: "前半", orchard: "12号", variety: "早生", treatment: null,
  notes: null, diameterCount: null, averageDiameter: 40, minimumDiameter: null, maximumDiameter: null,
  brix: 10, acidity: 1.2, brixAcidityRatio: null, dataStatus: "正常", activationStatus: null,
  inputMethod: "", enteredBy: null, source: null, ...overrides,
});

describe("buildYearlyAveragePoints", () => {
  it("同じ園地・品種・処理区・月区分を年ごとに平均し、新しい年から返す", () => {
    const source = [
      record({ id: "current-a", averageDiameter: 40 }),
      record({ id: "current-b", averageDiameter: 44 }),
      record({ id: "old", year: 2025, surveyMonth: "2025-08", averageDiameter: 39 }),
      record({ id: "other-half", surveyPeriod: "後半", averageDiameter: 99 }),
      record({ id: "other-treatment", treatment: "処理", averageDiameter: 99 }),
    ];
    const before = structuredClone(source);

    expect(buildYearlyAveragePoints(source, { orchard: "12号", varietyCategory: "早生(宮川・興津 等、又は山下紅)", treatment: null, month: 8, half: "前半" }, "averageDiameter")).toEqual([
      { year: 2026, value: 42, count: 2 },
      { year: 2025, value: 39, count: 1 },
    ]);
    expect(source).toEqual(before);
  });

  it("欠測と分析対象外を平均へ混ぜず、欠測を0へ変換しない", () => {
    expect(buildYearlyAveragePoints([
      record({ id: "missing", brix: null }),
      record({ id: "disabled", brix: 12, activationStatus: "無効" }),
    ], { orchard: "12号", varietyCategory: "早生(宮川・興津 等、又は山下紅)", treatment: null, month: 8, half: "前半" }, "brix")).toEqual([]);
  });
});
