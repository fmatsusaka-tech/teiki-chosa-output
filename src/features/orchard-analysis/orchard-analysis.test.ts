import { describe, expect, it } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildOrchardAnalysis } from "./orchard-analysis";

const record = (overrides: Partial<AnalysisDataRecord>): AnalysisDataRecord => ({
  id: "id-1", registeredAt: null, measuredAt: "2026-07-01", fiscalYear: 2026, year: 2026, month: 7,
  surveyMonth: "2026-07", surveyPeriod: "前半", orchard: "吉川", variety: "ゆら早生", treatment: null,
  notes: null, diameterCount: null, averageDiameter: 42.1, minimumDiameter: null, maximumDiameter: null,
  brix: 9.3, acidity: 1.4, brixAcidityRatio: null, dataStatus: "正常", inputMethod: "", enteredBy: null, source: null,
  ...overrides,
});

describe("buildOrchardAnalysis", () => {
  it("園地・品種で絞り込み、最新日付順に1調査を1行として返す", () => {
    const result = buildOrchardAnalysis([
      record({ id: "older", measuredAt: "2026-07-01" }),
      record({ id: "newer", measuredAt: "2026-07-15" }),
      record({ id: "other-orchard", orchard: "別園地" }),
      record({ id: "other-variety", variety: "石地" }),
    ], { orchard: "吉川", varietyCategory: "ゆら早生" });

    expect(result).toEqual([
      { type: "year", year: 2026 },
      expect.objectContaining({ type: "record", row: expect.objectContaining({ registrationId: "newer" }) }),
      expect.objectContaining({ type: "record", row: expect.objectContaining({ registrationId: "older" }) }),
    ]);
  });

  it("同日の複数レコードを集約せずに保持する", () => {
    const result = buildOrchardAnalysis([
      record({ id: "first", measuredAt: "2026-07-15", registeredAt: "2026-07-15T08:00:00Z" }),
      record({ id: "second", measuredAt: "2026-07-15", registeredAt: "2026-07-15T09:00:00Z" }),
    ], { orchard: "吉川", varietyCategory: "ゆら早生" });

    expect(result.filter((entry) => entry.type === "record")).toHaveLength(2);
    expect(result[1]).toMatchObject({ type: "record", row: { registrationId: "second" } });
  });

  it("処理区は指定時のみ絞り込み、未指定時はすべてを返す", () => {
    const records = [record({ id: "none", treatment: null }), record({ id: "treated", treatment: "処理A" })];
    expect(buildOrchardAnalysis(records, { orchard: "吉川", varietyCategory: "ゆら早生" }).filter((entry) => entry.type === "record")).toHaveLength(2);
    expect(buildOrchardAnalysis(records, { orchard: "吉川", varietyCategory: "ゆら早生", treatment: null })).toMatchObject([
      { type: "year", year: 2026 }, { type: "record", row: { registrationId: "none" } },
    ]);
  });

  it("年の切替位置へ見出しを生成し、欠測値を保持する", () => {
    const result = buildOrchardAnalysis([
      record({ id: "old", measuredAt: "2025-12-20", averageDiameter: null, brix: null, acidity: null }),
      record({ id: "new", measuredAt: "2026-01-02" }),
      record({ id: "no-date", measuredAt: null }),
    ], { orchard: "吉川", varietyCategory: "ゆら早生" });

    expect(result.map((entry) => entry.type === "year" ? entry.year : entry.row.registrationId)).toEqual([2026, "new", 2025, "old"]);
    expect(result[3]).toMatchObject({ type: "record", row: { diameterAverage: null, brix: null, acidity: null } });
  });

  it("品種別名をカテゴリ単位で検索し、分析対象外の状態を除外する", () => {
    const result = buildOrchardAnalysis([
      record({ id: "early", variety: "早生" }),
      record({ id: "yamashita", variety: "山下紅" }),
      record({ id: "review", variety: "早生", dataStatus: "要確認" }),
      record({ id: "cancelled", variety: "早生", dataStatus: "取消" }),
    ], { orchard: "吉川", varietyCategory: "早生(宮川・興津 等、又は山下紅)" });

    expect(result.filter((entry) => entry.type === "record")).toMatchObject([
      { row: { registrationId: "early" } }, { row: { registrationId: "yamashita" } },
    ]);
  });
});
