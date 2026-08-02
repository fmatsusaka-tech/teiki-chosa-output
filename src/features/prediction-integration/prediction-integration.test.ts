import { describe, expect, it } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import type {
  PredictionMasterBundle,
  PredictionMetric,
  PredictionModelMaster,
} from "../prediction-data/prediction-master.types";
import { buildPredictionResults } from "./prediction-integration";

const version = "1.0.1";
const generatedAt = "2026-08-01T12:00:00+09:00";
const modelNames = [
  "ゆら早生",
  "興津早生",
  "田口早生",
  "向山温州",
  "林温州",
  "丹生温州",
] as const;
const categories = [
  "ゆら早生",
  "早生(宮川・興津 等、又は山下紅)",
  "田口",
  "中生(向山など)",
  "晩生",
  "丹生系",
] as const;
const metrics = ["横径", "糖度", "クエン酸"] as const;
const sheetByMetric: Record<PredictionMetric, string> = {
  横径: "横径予測",
  糖度: "糖度予測",
  クエン酸: "酸度予測",
};

const bundle = (): PredictionMasterBundle => ({
  models: modelNames.map((predictionModel, index) => ({
    displayCategory: categories[index],
    predictionModel,
    targetMonthDay: "07-20",
    active: true,
    selectionCriteria: "",
    sourceYears: "",
    dataVersion: version,
    generatedAt,
  })),
  coefficients: metrics.flatMap((metric) =>
    modelNames.flatMap((predictionModel, modelIndex) =>
      ["07-19", "07-20"].map((monthDay, dayIndex) => ({
        metric,
        predictionModel,
        monthDay,
        coefficient: 1 + modelIndex / 10 + dayIndex / 10,
        sourceSheet: sheetByMetric[metric],
        sourceCell: `'${sheetByMetric[metric]}'!A${modelIndex * 2 + dayIndex + 1}`,
        dataVersion: version,
        generatedAt,
      })),
    ),
  ),
});

const record = (overrides: Partial<AnalysisDataRecord> = {}): AnalysisDataRecord => ({
  id: "record-1",
  registeredAt: "2026-07-19",
  measuredAt: "2026-07-19",
  fiscalYear: 2026,
  year: 2026,
  month: 7,
  surveyMonth: "7月",
  surveyPeriod: "後半",
  orchard: "検証園地",
  variety: "ゆら早生",
  treatment: null,
  notes: null,
  diameterCount: 3,
  averageDiameter: 10,
  minimumDiameter: 9,
  maximumDiameter: 11,
  brix: 8,
  acidity: 1,
  brixAcidityRatio: 8,
  dataStatus: "正常",
  inputMethod: "検証",
  enteredBy: null,
  source: null,
  ...overrides,
});

describe("buildPredictionResults", () => {
  it.each(categories.map((variety, index) => [variety, modelNames[index]] as const))(
    "%sを%sへ完全一致で選択する",
    (variety, predictionModel) => {
      const result = buildPredictionResults([record({ variety })], bundle(), version);
      expect(result.records[0].predictionModel).toBe(predictionModel);
      expect(result.records[0].metrics.横径.ok).toBe(true);
    },
  );

  it("未登録品種を計算対象外にする", () => {
    const result = buildPredictionResults([record({ variety: "未登録" })], bundle(), version);
    expect(result.records[0].metrics.横径).toMatchObject({ ok: false, reason: "UNREGISTERED_VARIETY" });
  });

  it("品種空欄を計算対象外にする", () => {
    const result = buildPredictionResults([record({ variety: null })], bundle(), version);
    expect(result.records[0].metrics.横径).toMatchObject({ ok: false, reason: "EMPTY_VARIETY" });
  });

  it("inactiveモデルを計算対象外にする", () => {
    const data = bundle();
    data.models[0] = { ...data.models[0], active: false } as unknown as PredictionModelMaster;
    expect(() => buildPredictionResults([record()], data, version)).toThrow("activeはtrueではありません");
  });

  it("計測日欠測を計算対象外にする", () => {
    const result = buildPredictionResults([record({ measuredAt: null })], bundle(), version);
    expect(result.records[0].metrics.横径).toMatchObject({ ok: false, reason: "MISSING_MEASURED_AT" });
  });

  it("目標日超過を全指標で計算対象外にする", () => {
    const result = buildPredictionResults([record({ measuredAt: "2026-07-21" })], bundle(), version);
    expect(Object.values(result.records[0].metrics)).toEqual(
      expect.arrayContaining([expect.objectContaining({ ok: false, reason: "TARGET_DATE_EXCEEDED" })]),
    );
  });

  it("計測日係数欠落を指標単位で返す", () => {
    const result = buildPredictionResults([record({ measuredAt: "2026-07-18" })], bundle(), version);
    expect(result.records[0].metrics.横径).toMatchObject({ ok: false, reason: "MEASURED_COEFFICIENT_NOT_FOUND" });
  });

  it("1指標の実測値不正で他指標を止めない", () => {
    const result = buildPredictionResults([record({ brix: null })], bundle(), version);
    expect(result.records[0].metrics.横径.ok).toBe(true);
    expect(result.records[0].metrics.糖度).toMatchObject({ ok: false, reason: "INVALID_MEASURED_VALUE" });
    expect(result.records[0].metrics.クエン酸.ok).toBe(true);
  });

  it("dataVersion不一致をBundle全体エラーにする", () => {
    expect(() => buildPredictionResults([record()], bundle(), "1.0.0")).toThrow("データ版がCLI指定値と一致しません");
  });

  it("InputとBundleを変更しない", () => {
    const input = [record()];
    const masters = bundle();
    const beforeInput = structuredClone(input);
    const beforeMasters = structuredClone(masters);
    buildPredictionResults(input, masters, version);
    expect(input).toEqual(beforeInput);
    expect(masters).toEqual(beforeMasters);
  });

  it("3指標を同じ比率式で計算して表示丸めする", () => {
    const result = buildPredictionResults([record()], bundle(), version).records[0];
    expect(result.metrics.横径).toMatchObject({ ok: true, measuredValue: 10, predictedValue: 11 });
    expect(result.metrics.糖度).toMatchObject({ ok: true, measuredValue: 8, predictedValue: 8.8 });
    expect(result.metrics.クエン酸).toMatchObject({ ok: true, measuredValue: 1, predictedValue: 1.1 });
  });
});
