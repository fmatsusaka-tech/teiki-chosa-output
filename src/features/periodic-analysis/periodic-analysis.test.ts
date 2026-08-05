import { describe, expect, it } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildPeriodicAnalysis } from "./periodic-analysis";
import { getPredictionModel, getVarietyCategory } from "../shared/variety-category";
import type { PredictionRecordResult } from "../prediction-integration/prediction-integration.types";

const record = (overrides: Partial<AnalysisDataRecord> = {}): AnalysisDataRecord => ({
  id: "id-1", registeredAt: "2026-07-28T10:00:00Z", measuredAt: "2026-07-28",
  fiscalYear: 2026, year: 2026, month: 7, surveyMonth: "2026-08", surveyPeriod: "前半",
  orchard: "吉川", variety: "早生", treatment: null, notes: null, diameterCount: 5,
  averageDiameter: 50, minimumDiameter: 45, maximumDiameter: 55, brix: 10, acidity: 1,
  brixAcidityRatio: 10, dataStatus: "正常", activationStatus: null, inputMethod: "text", enteredBy: null, source: null,
  ...overrides,
});

const query = { varietyCategory: "早生(宮川・興津 等、又は山下紅)", month: 8, half: "前半" as const };

describe("variety categories", () => {
  it.each(["早生", "山下紅", "早生(宮川・興津など)", "早生（宮川・興津 等、又は山下紅）", "  早生(宮川・興津 等、又は山下紅)  "])(
    "normalizes %s as the early category",
    (variety) => expect(getVarietyCategory(variety)).toBe(query.varietyCategory),
  );

  it("does not classify non-alias varieties by partial match", () => {
    expect(getVarietyCategory("ゆら早生")).toBe("ゆら早生");
    expect(getVarietyCategory("田口早生")).toBe("田口");
    expect(getVarietyCategory("木村早生")).toBe("木村早生");
    expect(getPredictionModel("木村早生")).toBeNull();
  });
});

describe("buildPeriodicAnalysis", () => {
  it("uses surveyMonth and surveyPeriod instead of measured date month", () => {
    const result = buildPeriodicAnalysis([record()], query);
    expect(result[0]).toMatchObject({ year: 2026, rows: [{ registrationId: "id-1" }] });
    expect(buildPeriodicAnalysis([record()], { ...query, month: 7 })).toEqual([]);
  });

  it("supports optional orchard and exact treatment filters", () => {
    const records = [record(), record({ id: "id-2", orchard: "なる1", treatment: "無処理" })];
    expect(buildPeriodicAnalysis(records, { ...query, orchard: "なる1" })[0].rows).toHaveLength(1);
    expect(buildPeriodicAnalysis(records, { ...query, treatment: "無処理" })[0].rows).toHaveLength(1);
    expect(buildPeriodicAnalysis(records, { ...query, treatment: "" })).toEqual([]);
  });

  it("groups and orders by period year, measured date, orchard name, registration date, then id", () => {
    const records = [
      record({ id: "b", measuredAt: "2026-08-01", registeredAt: "2026-08-01T10:00:00Z" }),
      record({ id: "a", measuredAt: "2026-08-01", registeredAt: "2026-08-01T10:00:00Z" }),
      record({ id: "later", measuredAt: "2026-08-02" }),
      record({ id: "old", surveyMonth: "2025-08", measuredAt: "2025-08-01" }),
    ];
    const groups = buildPeriodicAnalysis(records, query);
    expect(groups.map((group) => group.year)).toEqual([2026, 2025]);
    expect(groups[0].rows.map((row) => row.registrationId)).toEqual(["later", "a", "b"]);
  });

  it("sorts same-date rows by orchard name (50音順) ahead of registration date and id", () => {
    const records = [
      record({ id: "z-id-but-early-name", orchard: "あいうえお園", measuredAt: "2026-08-01", registeredAt: "2026-08-01T12:00:00Z" }),
      record({ id: "a-id-but-late-name", orchard: "わをん園", measuredAt: "2026-08-01", registeredAt: "2026-08-01T10:00:00Z" }),
    ];
    const rows = buildPeriodicAnalysis(records, query)[0].rows;
    expect(rows.map((row) => row.registrationId)).toEqual(["z-id-but-early-name", "a-id-but-late-name"]);
  });

  it("handles statuses and partial missing observations without dropping the row", () => {
    const records = [
      record({ id: "normal" }), record({ id: "brix-missing", dataStatus: "糖度なし", brix: null }),
      record({ id: "review", dataStatus: "要確認" }), record({ id: "cancelled", dataStatus: "取消" }),
      record({ id: "unknown", dataStatus: "未知" }),
    ];
    expect(buildPeriodicAnalysis(records, query)[0].rows.map((row) => row.registrationId)).toEqual(["brix-missing", "normal"]);
    expect(buildPeriodicAnalysis(records, { ...query, includeNeedsReview: true })[0].rows.map((row) => row.registrationId)).toEqual(["brix-missing", "normal", "review"]);
  });

  it("calculates previous differences from all matching records in the same period year", () => {
    const records = [
      record({ id: "current", measuredAt: "2026-08-15", surveyMonth: "2026-08", averageDiameter: 52, minimumDiameter: 47, maximumDiameter: 57, brix: 11, acidity: 0.9, brixAcidityRatio: 12 }),
      record({ id: "previous", measuredAt: "2026-07-20", surveyMonth: "2026-07", surveyPeriod: "後半", averageDiameter: 50, minimumDiameter: 45, maximumDiameter: 55, brix: 10, acidity: 1, brixAcidityRatio: 10 }),
    ];
    const row = buildPeriodicAnalysis(records, query)[0].rows[0];
    expect(row.previousDifference).toEqual({
      diameterAverage: 2,
      diameterMinimum: 2,
      diameterMaximum: 2,
      brix: 1,
      acidity: -0.09999999999999998,
      brixAcidityRatio: 2,
    });
  });

  it("matches the previous record by variety category, not the raw 品種 text, when they are spelling variants", () => {
    const records = [
      record({ id: "current", measuredAt: "2026-08-01", surveyMonth: "2026-08", surveyPeriod: "前半", variety: "ゆら", averageDiameter: 52 }),
      record({ id: "previous", measuredAt: "2026-07-20", surveyMonth: "2026-07", surveyPeriod: "後半", variety: "ゆら早生", averageDiameter: 50 }),
    ];
    expect(buildPeriodicAnalysis(records, { ...query, varietyCategory: "ゆら早生" })[0].rows[0].previousDifference.diameterAverage).toBe(2);
  });

  it("does not mix a different treatment after orchard normalization", () => {
    const records = [
      record({ id: "current", measuredAt: "2026-08-15", orchard: "12号", treatment: "無処理", averageDiameter: 52 }),
      record({ id: "other-treatment", measuredAt: "2026-08-14", orchard: "12号", treatment: "フィ", averageDiameter: 50 }),
    ];
    expect(buildPeriodicAnalysis(records, query)[0].rows[0].previousDifference.diameterAverage).toBeNull();
  });

  it("does not use same-day records or skip missing previous values", () => {
    const records = [
      record({ id: "current", measuredAt: "2026-08-15", averageDiameter: 52 }),
      record({ id: "same-day", measuredAt: "2026-08-15", averageDiameter: 40 }),
      record({ id: "previous", measuredAt: "2026-07-31", surveyMonth: "2026-07", surveyPeriod: "後半", averageDiameter: null }),
      record({ id: "older", measuredAt: "2026-07-15", surveyMonth: "2026-07", surveyPeriod: "前半", averageDiameter: 10 }),
    ];
    expect(buildPeriodicAnalysis(records, query)[0].rows[0].previousDifference.diameterAverage).toBeNull();
  });

  it("orders by 調査基準月／調査区分, not by 計測日, even when 計測日 disagrees with the survey period order", () => {
    const records = [
      record({ id: "current", measuredAt: "2026-08-01", surveyMonth: "2026-08", surveyPeriod: "前半", averageDiameter: 52 }),
      // Measured after "current", but its survey period (7月後半) is still the one immediately before 8月前半.
      record({ id: "previous", measuredAt: "2026-08-20", surveyMonth: "2026-07", surveyPeriod: "後半", averageDiameter: 50 }),
    ];
    expect(buildPeriodicAnalysis(records, query)[0].rows[0].previousDifference.diameterAverage).toBe(2);
  });

  it("does not treat a same-period record on a different 計測日 as the previous record", () => {
    const records = [
      record({ id: "current", measuredAt: "2026-08-15", surveyMonth: "2026-08", surveyPeriod: "前半", averageDiameter: 52 }),
      record({ id: "same-period-different-day", measuredAt: "2026-08-01", surveyMonth: "2026-08", surveyPeriod: "前半", averageDiameter: 10 }),
    ];
    const current = buildPeriodicAnalysis(records, query)[0].rows.find((row) => row.registrationId === "current")!;
    expect(current.previousDifference.diameterAverage).toBeNull();
  });

  it("does not compare separate records from the same survey round", () => {
    const records = [
      record({ id: "current", measuredAt: "2026-07-25", surveyMonth: "2026-07", surveyPeriod: "後半", averageDiameter: 52 }),
      record({ id: "same-round", measuredAt: "2026-07-20", surveyMonth: "2026-07", surveyPeriod: "後半", averageDiameter: 40 }),
      record({ id: "previous-round", measuredAt: "2026-07-10", surveyMonth: "2026-07", surveyPeriod: "前半", averageDiameter: 50 }),
    ];
    const result = buildPeriodicAnalysis(records, { ...query, month: 7, half: "後半" });
    expect(result[0].rows[0].previousDifference.diameterAverage).toBe(2);
    expect(result[0].rows[1].previousDifference.diameterAverage).toBe(-10);
  });

  it("excludes blank variety, invalid survey month, and missing measured date without correcting them", () => {
    const records = [
      record({ id: "blank", variety: "" }), record({ id: "invalid-period", surveyMonth: "2026/08" }),
      record({ id: "missing-date", measuredAt: "" }), record({ id: "extreme", averageDiameter: 9999 }),
    ];
    expect(buildPeriodicAnalysis(records, query)[0].rows.map((row) => row.registrationId)).toEqual(["extreme"]);
  });

  it("keeps a missing orchard visible but does not calculate its previous difference", () => {
    const [row] = buildPeriodicAnalysis([record({ orchard: null, averageDiameter: null })], query)[0].rows;
    expect(row).toMatchObject({ orchard: null, diameterAverage: null });
    expect(row.previousDifference).toEqual({
      diameterAverage: null,
      diameterMinimum: null,
      diameterMaximum: null,
      brix: null,
      acidity: null,
      brixAcidityRatio: null,
    });
  });

  it("keeps the exact orchard, variety, and treatment separate", () => {
    const records = [
      record({ id: "current", measuredAt: "2026-08-15", treatment: "処理A", averageDiameter: 52 }),
      record({ id: "previous", measuredAt: "2026-08-01", treatment: "処理B", averageDiameter: 50 }),
      record({ id: "other-variety", measuredAt: "2026-08-10", variety: "山下紅", averageDiameter: 10 }),
    ];
    expect(buildPeriodicAnalysis(records, query)[0].rows[0].previousDifference.diameterAverage).toBeNull();
  });

  it.each([
    ["blank vs 無処理区", null, "無処理区"],
    ["blank vs 処理区なし", null, "処理区なし"],
    ["無処理区 vs 処理区なし", "無処理区", "処理区なし"],
  ])("treats %s as the same treatment when computing the previous difference", (_label, currentTreatment, previousTreatment) => {
    const records = [
      record({ id: "current", measuredAt: "2026-08-15", treatment: currentTreatment, averageDiameter: 52 }),
      record({ id: "previous", measuredAt: "2026-07-20", surveyMonth: "2026-07", surveyPeriod: "後半", treatment: previousTreatment, averageDiameter: 50 }),
    ];
    expect(buildPeriodicAnalysis(records, query)[0].rows[0].previousDifference.diameterAverage).toBe(2);
  });

  it("returns missing differences when the immediately previous day has multiple records", () => {
    const records = [
      record({ id: "current", measuredAt: "2026-08-15", averageDiameter: 52 }),
      record({ id: "previous-a", measuredAt: "2026-07-20", surveyMonth: "2026-07", surveyPeriod: "後半", averageDiameter: 50 }),
      record({ id: "previous-b", measuredAt: "2026-07-20", surveyMonth: "2026-07", surveyPeriod: "後半", averageDiameter: 49 }),
      record({ id: "older", measuredAt: "2026-07-01", surveyMonth: "2026-07", surveyPeriod: "前半", averageDiameter: 45 }),
    ];
    expect(buildPeriodicAnalysis(records, query)[0].rows[0].previousDifference.diameterAverage).toBeNull();
  });

  it("attaches the matching structured prediction without changing the input", () => {
    const input = record();
    const prediction: PredictionRecordResult = {
      id: input.id,
      fiscalYear: input.fiscalYear,
      measuredYear: input.year,
      orchard: input.orchard,
      variety: input.variety,
      treatment: input.treatment,
      measuredAt: input.measuredAt,
      predictionModel: "興津早生",
      targetMonthDay: "11-20",
      dataVersion: "1.0.1",
      metrics: {
        横径: { ok: false, metric: "横径", reason: "MEASURED_COEFFICIENT_NOT_FOUND", message: "係数なし" },
        糖度: { ok: false, metric: "糖度", reason: "INVALID_MEASURED_VALUE", message: "実測値なし" },
        クエン酸: { ok: false, metric: "クエン酸", reason: "TARGET_DATE_EXCEEDED", message: "目標日超過" },
      },
    };
    const snapshot = structuredClone(input);
    expect(buildPeriodicAnalysis([input], query, [prediction])[0].rows[0].prediction).toEqual(prediction);
    expect(input).toEqual(snapshot);
  });
});
