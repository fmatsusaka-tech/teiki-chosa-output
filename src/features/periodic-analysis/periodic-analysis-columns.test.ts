import { describe, expect, it } from "vitest";
import { displayDiameterPrediction } from "./periodic-analysis-columns";
import type { PredictionMetricResult } from "../prediction-integration/prediction-integration.types";

const okResult = (predictedValue: number, rawPrediction: number): PredictionMetricResult => ({
  ok: true,
  metric: "横径",
  measuredValue: 60,
  predictedValue,
  rawPrediction,
  measuredSourceSheet: "sheet",
  measuredSourceCell: "A1",
  targetSourceSheet: "sheet",
  targetSourceCell: "A2",
});

describe("displayDiameterPrediction", () => {
  it("shows the rounded value with mm and the size classified from the raw prediction", () => {
    expect(displayDiameterPrediction(okResult(64.2, 64.16), 1)).toBe("64.2mm（M）");
  });

  it("classifies by the raw prediction, not the rounded display value", () => {
    // Rounds to 67.0 (L threshold) but the raw value is still under 67.0 (M).
    expect(displayDiameterPrediction(okResult(67.0, 66.96), 1)).toBe("67.0mm（M）");
  });

  it("shows the failure message when the prediction is not calculable", () => {
    const failed: PredictionMetricResult = { ok: false, metric: "横径", reason: "EMPTY_VARIETY", message: "品種が入力されていません。" };
    expect(displayDiameterPrediction(failed, 1)).toBe("— 品種が入力されていません。");
  });

  it("shows a dash when there is no result", () => {
    expect(displayDiameterPrediction(undefined, 1)).toBe("—");
  });
});
