import { describe, expect, it } from "vitest";
import {
  predictionMetricOrder,
  predictionModelOrder,
  sortPredictionMasterBundle,
  sourceSheetByMetric,
} from "./prediction-master-contract";
import {
  extractLegacyPredictionSheet,
  toMonthDay,
} from "./prediction-master-extractor";
import { formatPredictionSummary } from "./prediction-master-report";
import { verifyPredictionRegressions } from "./prediction-master-regression";
import {
  validateExtractedModelConsistency,
  validatePredictionMasters,
} from "./prediction-master-validator";
import type {
  LegacyPredictionSheet,
  PredictionMasterBundle,
  SheetCell,
} from "./prediction-master.types";

const dataVersion = "1.0.0";
const generatedAt = "2026-07-29T12:34:56+09:00";

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

const completeBundle = (): PredictionMasterBundle => {
  const models = predictionModelOrder.map((predictionModel) => ({
    displayCategory: predictionModel,
    predictionModel,
    targetMonthDay: "01-03",
    active: true as const,
    selectionCriteria: "",
    sourceYears: "",
    dataVersion,
    generatedAt,
  }));
  const coefficients = predictionMetricOrder.flatMap((metric) =>
    predictionModelOrder.flatMap((predictionModel) =>
      ["01-01", "01-02", "01-03"].map((monthDay, index) => ({
        metric,
        predictionModel,
        monthDay,
        coefficient: index + 1,
        sourceSheet: sourceSheetByMetric[metric],
        sourceCell: `'${sourceSheetByMetric[metric]}'!A${index + 1}`,
        dataVersion,
        generatedAt,
      })),
    ),
  );
  return { models, coefficients };
};

describe("prediction master extraction", () => {
  it("見出しでモデル別係数を抽出し、AA以降の原典セルを保持する", () => {
    const result = extractLegacyPredictionSheet(
      extractionSheet(),
      dataVersion,
      generatedAt,
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
      dataVersion,
      generatedAt,
    );
    expect(result.coefficients.map((row) => row.coefficient)).toEqual([1, 1.1]);
  });

  it("日付文字列とSpreadsheetシリアル値をMM-DDへ変換する", () => {
    expect(toMonthDay("7月15日")).toBe("07-15");
    expect(toMonthDay(45853)).toBe("07-15");
  });
});

describe("prediction master validation", () => {
  it("正式な6モデル・3指標の日別連続Bundleを受理する", () => {
    expect(() =>
      validatePredictionMasters(completeBundle(), dataVersion),
    ).not.toThrow();
  });

  it("モデル0件と係数0件を拒否する", () => {
    expect(() =>
      validatePredictionMasters({ models: [], coefficients: [] }, dataVersion),
    ).toThrow("予測モデル数");
  });

  it("未知モデルを拒否する", () => {
    const bundle = completeBundle();
    bundle.models[0].predictionModel = "未知モデル";
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "未知の予測モデル",
    );
  });

  it("未知指標を拒否する", () => {
    const bundle = completeBundle();
    bundle.coefficients[0].metric = "未知指標" as never;
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "未知の指標",
    );
  });

  it("係数側の未知モデルを拒否する", () => {
    const bundle = completeBundle();
    bundle.coefficients[0].predictionModel = "未知モデル";
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "係数の予測モデルがモデルマスタにありません",
    );
  });

  it("指標と原典シートの不一致を拒否する", () => {
    const bundle = completeBundle();
    bundle.coefficients[0].sourceSheet = "糖度予測";
    bundle.coefficients[0].sourceCell = "'糖度予測'!A1";
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "指標と原典シートが一致しません",
    );
  });

  it("sourceSheetとsourceCellのシート名不一致を拒否する", () => {
    const bundle = completeBundle();
    bundle.coefficients[0].sourceCell = "'糖度予測'!A1";
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "原典シートと原典セルが一致しません",
    );
  });

  it("Mapでまとめる前に3原典シート間のモデル属性不一致を拒否する", () => {
    const model = completeBundle().models[0];
    expect(() =>
      validateExtractedModelConsistency([
        model,
        { ...model },
        { ...model, targetMonthDay: "01-04" },
      ]),
    ).toThrow("3原典シート間でモデル属性が一致しません");
  });

  it("不正なdataVersionを拒否する", () => {
    const bundle = completeBundle();
    bundle.models[0].dataVersion = "1";
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "無効なデータ版",
    );
  });

  it("行ごとのdataVersion不一致を拒否する", () => {
    const bundle = completeBundle();
    bundle.coefficients[0].dataVersion = "1.0.1";
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "データ版がCLI指定値と一致しません",
    );
  });

  it("不正なgeneratedAtを拒否する", () => {
    const bundle = completeBundle();
    bundle.models[0].generatedAt = "now";
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "無効な生成日時",
    );
  });

  it("行ごとのgeneratedAt不一致を拒否する", () => {
    const bundle = completeBundle();
    bundle.coefficients[0].generatedAt = "2026-07-29T12:34:57+09:00";
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "生成日時が全行で一致しません",
    );
  });

  it("重複キーを拒否する", () => {
    const bundle = completeBundle();
    bundle.coefficients.push({ ...bundle.coefficients[0] });
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "重複した係数キー",
    );
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
    expect(() => validatePredictionMasters(bundle, dataVersion)).toThrow(
      "日別係数が連続していません",
    );
  });

  it("モデルと係数を正式順へ並べる", () => {
    const bundle = completeBundle();
    const sorted = sortPredictionMasterBundle({
      models: [...bundle.models].reverse(),
      coefficients: [...bundle.coefficients].reverse(),
    });
    expect(sorted.models.map((row) => row.predictionModel)).toEqual(
      predictionModelOrder,
    );
    expect(
      sorted.coefficients
        .slice(0, 4)
        .map((row) => [row.metric, row.predictionModel, row.monthDay]),
    ).toEqual([
      ["横径", "ゆら早生", "01-01"],
      ["横径", "ゆら早生", "01-02"],
      ["横径", "ゆら早生", "01-03"],
      ["横径", "興津早生", "01-01"],
    ]);
  });

  it("空Summaryを拒否する", () => {
    expect(() =>
      formatPredictionSummary({ models: [], coefficients: [] }, dataVersion),
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
        sourceSheet: sourceSheetByMetric[metric],
        sourceCell: `'${sourceSheetByMetric[metric]}'!A1`,
        dataVersion,
        generatedAt,
      });
    }
    const results = verifyPredictionRegressions(bundle);
    expect(results.map((result) => result.displayedPrediction)).toEqual([
      64, 10.4, 0.88,
    ]);
  });
});
