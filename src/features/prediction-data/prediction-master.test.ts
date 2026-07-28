import { describe, expect, it } from "vitest";
import {
  extractLegacyPredictionSheet,
  toMonthDay,
} from "./prediction-master-extractor";
import { formatPredictionSummary } from "./prediction-master-report";
import { verifyPredictionRegressions } from "./prediction-master-regression";
import { validatePredictionMasters } from "./prediction-master-validator";
import type {
  LegacyPredictionSheet,
  PredictionMasterBundle,
  PredictionMetric,
  SheetCell,
} from "./prediction-master.types";

const cell = (
  formattedValue?: string,
  effectiveValue?: SheetCell["effectiveValue"],
): SheetCell => ({ formattedValue, effectiveValue });

const extractionSheet = (): LegacyPredictionSheet => {
  const grid: SheetCell[][] = Array.from({ length: 20 }, () =>
    Array.from({ length: 56 }, () => ({})),
  );
  grid[0][32] = cell("ゆら早生算出基礎");
  grid[1][32] = cell("倍数");
  grid[1][33] = cell("逆算");
  grid[2][31] = cell("7/15");
  grid[2][32] = cell("1.0", { numberValue: 1 });
  grid[2][33] = cell("999", { numberValue: 999 });
  grid[3][31] = cell("7/16");
  grid[3][32] = cell("TRUE", { boolValue: true });
  grid[4][31] = cell("7/17");
  grid[4][32] = cell("1.1", { numberValue: 1.1 });
  grid[0][53] = cell("品種一覧");
  grid[0][54] = cell("目標月/日");
  grid[1][53] = cell("ゆら早生");
  grid[1][54] = cell("10/15");
  return { title: "横径予測", grid };
};

const expectedModels = [
  "ゆら早生",
  "興津早生",
  "田口早生",
  "向山温州",
  "林温州",
  "丹生温州",
];
const expectedMetrics: PredictionMetric[] = ["横径", "糖度", "クエン酸"];

const completeBundle = (): PredictionMasterBundle => {
  const models = expectedModels.map((predictionModel) => ({
    displayCategory: predictionModel,
    predictionModel,
    targetMonthDay: "01-03",
    active: true as const,
    selectionCriteria: "",
    sourceYears: "",
    dataVersion: "1",
    generatedAt: "now",
  }));
  const coefficients = expectedMetrics.flatMap((metric) =>
    expectedModels.flatMap((predictionModel) =>
      ["01-01", "01-02", "01-03"].map((monthDay, index) => ({
        metric,
        predictionModel,
        monthDay,
        coefficient: index + 1,
        sourceSheet: `${metric}予測`,
        sourceCell: `'${metric}予測'!A${index + 1}`,
        dataVersion: "1",
        generatedAt: "now",
      })),
    ),
  );
  return { models, coefficients };
};

describe("prediction master extraction", () => {
  it("見出しでモデル別係数を抽出し、AA以降の原典セルを保持する", () => {
    const result = extractLegacyPredictionSheet(
      extractionSheet(),
      "1.0.0",
      "2026-07-28T00:00:00+09:00",
    );
    expect(result.coefficients).toEqual([
      expect.objectContaining({
        monthDay: "07-15",
        coefficient: 1,
        sourceCell: "'横径予測'!AG3",
      }),
      expect.objectContaining({
        monthDay: "07-17",
        coefficient: 1.1,
        sourceCell: "'横径予測'!AG5",
      }),
    ]);
    expect(result.models[0]).toMatchObject({
      predictionModel: "ゆら早生",
      targetMonthDay: "10-15",
    });
  });

  it("TRUEと逆算列を係数として取得しない", () => {
    const result = extractLegacyPredictionSheet(
      extractionSheet(),
      "1",
      "now",
    );
    expect(result.coefficients.map((row) => row.coefficient)).toEqual([1, 1.1]);
  });

  it("日付文字列とSpreadsheetシリアル値をMM-DDへ変換する", () => {
    expect(toMonthDay("7月15日")).toBe("07-15");
    expect(toMonthDay(45853)).toBe("07-15");
  });
});

describe("prediction master validation", () => {
  it("6モデル・3指標の日別連続係数を受理する", () => {
    expect(() => validatePredictionMasters(completeBundle())).not.toThrow();
  });

  it("モデル0件と係数0件を拒否する", () => {
    expect(() =>
      validatePredictionMasters({ models: [], coefficients: [] }),
    ).toThrow("予測モデル数");
  });

  it("欠落日を拒否する", () => {
    const bundle = completeBundle();
    bundle.coefficients = bundle.coefficients.filter(
      (row) =>
        !(
          row.metric === "横径" &&
          row.predictionModel === "ゆら早生" &&
          row.monthDay === "01-02"
        ),
    );
    expect(() => validatePredictionMasters(bundle)).toThrow(
      "日別係数が連続していません",
    );
  });

  it("空Summaryを拒否する", () => {
    expect(() =>
      formatPredictionSummary({ models: [], coefficients: [] }, "1"),
    ).toThrow("空のSummary");
  });
});

describe("prediction regression", () => {
  it("実係数から表示値を計算し、原典セルを返す", () => {
    const bundle = completeBundle();
    const replacements = [
      ["横径", "ゆら早生", "07-17", 0.5],
      ["横径", "ゆら早生", "10-15", 64 / 37.3 / 2],
      ["糖度", "田口早生", "09-01", 0.5],
      ["糖度", "田口早生", "11-15", 0.65],
      ["クエン酸", "田口早生", "11-05", 0.98],
      ["クエン酸", "田口早生", "11-15", 0.88],
    ] as const;
    for (const [metric, model, monthDay, coefficient] of replacements) {
      bundle.coefficients.push({
        metric,
        predictionModel: model,
        monthDay,
        coefficient,
        sourceSheet: "s",
        sourceCell: "'s'!A1",
        dataVersion: "1",
        generatedAt: "now",
      });
    }
    const results = verifyPredictionRegressions(bundle);
    expect(results.map((result) => result.displayedPrediction)).toEqual([
      64, 10.4, 0.88,
    ]);
  });
});
