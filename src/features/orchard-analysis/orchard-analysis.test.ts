import { describe, expect, it } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildOrchardAnalysis, buildOrchardComparison, getOrchardAnalysisFilterOptions, getOrchardFilterOptions, getOrchardSelectionOptions } from "./orchard-analysis";

const record = (overrides: Partial<AnalysisDataRecord>): AnalysisDataRecord => ({
  id: "id-1", registeredAt: null, measuredAt: "2026-07-01", fiscalYear: 2026, year: 2026, month: 7,
  surveyMonth: "2026-07", surveyPeriod: "前半", orchard: "吉川", variety: "ゆら早生", treatment: null,
  notes: null, diameterCount: null, averageDiameter: 42.1, minimumDiameter: null, maximumDiameter: null,
  brix: 9.3, acidity: 1.4, brixAcidityRatio: null, dataStatus: "正常", inputMethod: "", enteredBy: null, source: null,
  ...overrides,
});

describe("buildOrchardComparison", () => {
  const selectionA = { orchard: "園地A", varietyCategory: "ゆら早生" };
  const selectionB = { orchard: "園地B", varietyCategory: "ゆら早生" };

  it("日付を昇順に並べ、近い日付を統合せず欠測側をnullにする", () => {
    const result = buildOrchardComparison([
      record({ id: "a-1", orchard: "園地A", measuredAt: "2026-07-01" }),
      record({ id: "b-1", orchard: "園地B", measuredAt: "2026-07-02" }),
    ], selectionA, selectionB);

    expect(result.columns).toMatchObject([
      { measuredAt: "2026-07-01", orchardA: { registrationId: "a-1" }, orchardB: null },
      { measuredAt: "2026-07-02", orchardA: null, orchardB: { registrationId: "b-1" } },
    ]);
  });

  it("同じ日の複数レコードを平均化せず個別列として保持する", () => {
    const result = buildOrchardComparison([
      record({ id: "a-1", orchard: "園地A", measuredAt: "2026-07-01", averageDiameter: 40 }),
      record({ id: "a-2", orchard: "園地A", measuredAt: "2026-07-01", averageDiameter: 50 }),
      record({ id: "b-1", orchard: "園地B", measuredAt: "2026-07-01", averageDiameter: 45 }),
    ], selectionA, selectionB);

    expect(result.columns).toHaveLength(2);
    expect(result.columns.map((column) => column.orchardA?.averageDiameter)).toEqual([40, 50]);
    expect(result.columns.map((column) => column.orchardB?.averageDiameter)).toEqual([45, undefined]);
  });

  it("6指標と欠測値を変換せず保持し、最新値を園地ごとに選ぶ", () => {
    const result = buildOrchardComparison([
      record({ id: "a-old", orchard: "園地A", measuredAt: "2025-12-31" }),
      record({ id: "a-new", orchard: "園地A", measuredAt: "2026-01-01", minimumDiameter: 30, maximumDiameter: 50, brixAcidityRatio: null }),
      record({ id: "b-new", orchard: "園地B", measuredAt: "2026-01-02" }),
    ], selectionA, selectionB);

    expect(result.latestA).toMatchObject({ registrationId: "a-new", minimumDiameter: 30, maximumDiameter: 50, brixAcidityRatio: null });
    expect(result.latestB?.registrationId).toBe("b-new");
    expect(result.columns.filter((column) => column.yearBoundary)).toHaveLength(2);
  });

  it("品種・処理区・分析対象状態で絞り込み、入力を変更しない", () => {
    const source = [
      record({ id: "keep", orchard: "園地A", treatment: "処理1" }),
      record({ id: "other-treatment", orchard: "園地A", treatment: "処理2" }),
      record({ id: "excluded", orchard: "園地A", treatment: "処理1", dataStatus: "取消" }),
    ];
    const before = structuredClone(source);
    const result = buildOrchardComparison(source, { ...selectionA, treatment: "処理1" }, selectionB);

    expect(result.columns).toHaveLength(1);
    expect(result.columns[0].orchardA?.registrationId).toBe("keep");
    expect(source).toEqual(before);
  });
});

describe("buildOrchardAnalysis", () => {
  it("品種を先に選び、該当園地を最新計測日順で一度だけ返す", () => {
    const records = [
      record({ id: "a-old", orchard: "園地A", variety: "ゆら早生", treatment: "A", measuredAt: "2026-07-01" }),
      record({ id: "a-new", orchard: "園地A", variety: "ゆら早生", treatment: "B", measuredAt: "2026-07-20" }),
      record({ id: "b", orchard: "園地B", variety: "ゆら早生", treatment: null, measuredAt: "2026-07-21" }),
      record({ id: "other", orchard: "園地C", variety: "田口", measuredAt: "2026-07-22" }),
    ];

    expect(getOrchardFilterOptions(records, "ゆら早生")).toEqual([
      { orchard: "園地B", latestMeasuredAt: "2026-07-21", label: "園地B　最終計測 2026-07-21" },
      { orchard: "園地A", latestMeasuredAt: "2026-07-20", label: "園地A　最終計測 2026-07-20" },
    ]);
    expect(getOrchardAnalysisFilterOptions(records, "園地A", "ゆら早生").treatments).toEqual(["A", "B"]);
  });

  it("orders orchard and treatment pairs by latest measured date and recalculates for a year", () => {
    const records = [
      record({ orchard: "園地B", treatment: "処理2", measuredAt: "2026-07-20" }),
      record({ orchard: "園地A", treatment: "処理2", measuredAt: "2026-07-20" }),
      record({ orchard: "園地A", treatment: "処理1", measuredAt: "2026-07-20" }),
      record({ orchard: "園地C", treatment: null, measuredAt: "2025-08-01" }),
      record({ orchard: "園地D", treatment: null, measuredAt: null }),
    ];
    expect(getOrchardSelectionOptions(records).map((option) => option.label)).toEqual([
      "園地A／処理1　最終計測 2026-07-20", "園地A／処理2　最終計測 2026-07-20", "園地B／処理2　最終計測 2026-07-20", "園地C／処理区なし　最終計測 2025-08-01", "園地D／処理区なし　最終計測 —",
    ]);
    expect(getOrchardSelectionOptions(records, 2025).map((option) => option.orchard)).toEqual(["園地C"]);
  });

  it("並び順が変わっても園地と処理区から作る選択キーを維持する", () => {
    const before = getOrchardSelectionOptions([
      record({ orchard: "園地A", treatment: "処理1", measuredAt: "2026-07-01" }),
      record({ orchard: "園地B", treatment: "処理2", measuredAt: "2026-07-02" }),
    ]);
    const after = getOrchardSelectionOptions([
      record({ orchard: "園地A", treatment: "処理1", measuredAt: "2026-07-03" }),
      record({ orchard: "園地B", treatment: "処理2", measuredAt: "2026-07-02" }),
    ]);

    expect(new Set(after.map((option) => option.key))).toEqual(new Set(before.map((option) => option.key)));
  });

  it("検索候補を園地、品種カテゴリ、処理区の順に連動させる", () => {
    const records = [
      record({ id: "yura-a", orchard: "吉川", variety: "ゆら早生", treatment: "A" }),
      record({ id: "early", orchard: "吉川", variety: "早生", treatment: "B" }),
      record({ id: "yamashita", orchard: "吉川", variety: "山下紅", treatment: "C" }),
      record({ id: "other", orchard: "別園地", variety: "田口", treatment: "D" }),
      record({ id: "review", orchard: "吉川", variety: "田口", treatment: "E", dataStatus: "要確認" }),
    ];

    expect(getOrchardAnalysisFilterOptions(records).orchards).toEqual(["吉川", "別園地"]);
    expect(getOrchardAnalysisFilterOptions(records, "吉川").varietyCategories).toEqual(["ゆら早生", "早生(宮川・興津 等、又は山下紅)"]);
    expect(getOrchardAnalysisFilterOptions(records, "吉川", "早生(宮川・興津 等、又は山下紅)").treatments).toEqual(["B", "C"]);
  });

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
