import { describe, expect, it } from "vitest";
import type { PredictionMasterBundle, PredictionMetric } from "../prediction-data/prediction-master.types";
import { simulatePrediction } from "./prediction-simulator";

const models = ["ゆら早生", "興津早生", "田口早生", "向山温州", "林温州", "丹生温州"];
const metrics: PredictionMetric[] = ["横径", "糖度", "クエン酸"];
const bundle = (): PredictionMasterBundle => ({
  models: models.map((predictionModel) => ({ displayCategory: predictionModel, predictionModel, targetMonthDay: "09-02", active: true, selectionCriteria: "", sourceYears: "", dataVersion: "1.0.1", generatedAt: "2026-08-01T12:00:00+09:00" })),
  coefficients: metrics.flatMap((metric) => models.flatMap((predictionModel) => ["09-01", "09-02"].map((monthDay) => ({ metric, predictionModel, monthDay, coefficient: monthDay === "09-01" ? 1 : 2, sourceSheet: metric === "横径" ? "横径予測" : metric === "糖度" ? "糖度予測" : "酸度予測", sourceCell: `'${metric === "クエン酸" ? "酸度予測" : `${metric}予測`}'!A1`, dataVersion: "1.0.1", generatedAt: "2026-08-01T12:00:00+09:00" })))),
});

describe("simulatePrediction", () => {
  it("6モデルで3指標を独立計算する", () => {
    for (const predictionModel of models) {
      const result = simulatePrediction(bundle(), { predictionModel, assumedDate: "2026-09-01", values: { 横径: 10, 糖度: 8, クエン酸: 1 }, expectedDataVersion: "1.0.1" });
      expect(result.metrics.横径).toMatchObject({ ok: true, predictedValue: 20 });
      expect(result.metrics.糖度).toMatchObject({ ok: true, predictedValue: 16 });
      expect(result.metrics.クエン酸).toMatchObject({ ok: true, predictedValue: 2 });
    }
  });

  it("1指標の不正値が他指標を止めず入力を変更しない", () => {
    const input = { predictionModel: "ゆら早生", assumedDate: "2026-09-01", values: { 横径: 10, 糖度: null, クエン酸: 1 }, expectedDataVersion: "1.0.1" } as const;
    const before = structuredClone(input);
    const result = simulatePrediction(bundle(), input);
    expect(result.metrics.横径.ok).toBe(true);
    expect(result.metrics.糖度).toMatchObject({ ok: false });
    expect(result.metrics.クエン酸.ok).toBe(true);
    expect(input).toEqual(before);
  });

  it("目標日超過と係数欠落を構造化失敗にする", () => {
    const after = simulatePrediction(bundle(), { predictionModel: "ゆら早生", assumedDate: "2026-09-03", values: { 横径: 10, 糖度: 8, クエン酸: 1 }, expectedDataVersion: "1.0.1" });
    expect(after.metrics.横径).toMatchObject({ ok: false, reason: "仮定日が収穫目標日を過ぎています。" });
    const missing = simulatePrediction(bundle(), { predictionModel: "ゆら早生", assumedDate: "2026-08-31", values: { 横径: 10, 糖度: 8, クエン酸: 1 }, expectedDataVersion: "1.0.1" });
    expect(missing.metrics.横径).toMatchObject({ ok: false, reason: "仮定日の係数がありません。" });
  });

  it("期待データ版不一致をBundle全体の失敗にする", () => {
    expect(() => simulatePrediction(bundle(), { predictionModel: "ゆら早生", assumedDate: "2026-09-01", values: { 横径: 10, 糖度: 8, クエン酸: 1 }, expectedDataVersion: "2.0.0" })).toThrow("データ版がCLI指定値と一致しません");
  });
});
