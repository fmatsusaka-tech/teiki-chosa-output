import { describe, expect, it } from "vitest";
import { displayDiameterPrediction, displayPrediction } from "./periodic-analysis-columns";
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
  it("shows the rounded value and size on separate lines without a unit", () => {
    expect(displayDiameterPrediction(okResult(64.2, 64.16), 1)).toBe("64.2\nM");
  });

  it("classifies by the raw prediction, not the rounded display value", () => {
    // Rounds to 67.0 (L threshold) but the raw value is still under 67.0 (M).
    expect(displayDiameterPrediction(okResult(67.0, 66.96), 1)).toBe("67.0\nM");
  });

  it("shows the failure message when the prediction is not calculable", () => {
    const failed: PredictionMetricResult = { ok: false, metric: "横径", reason: "TARGET_DATE_EXCEEDED", message: "目標日を過ぎています。" };
    expect(displayDiameterPrediction(failed, 1)).toBe("— 目標日を過ぎています。");
  });

  it.each(["EMPTY_VARIETY", "UNREGISTERED_VARIETY", "MODEL_NOT_FOUND"] as const)("shows a short no-prediction label for unsupported varieties: %s", (reason) => {
    const diameter: PredictionMetricResult = { ok: false, metric: "横径", reason, message: "内部の長い説明" };
    const brix: PredictionMetricResult = { ok: false, metric: "糖度", reason, message: "内部の長い説明" };
    expect(displayDiameterPrediction(diameter, 1)).toBe("予測なし");
    expect(displayPrediction(brix, 1)).toBe("予測なし");
  });

  it("shows a dash when there is no result", () => {
    expect(displayDiameterPrediction(undefined, 1)).toBe("—");
  });
});
