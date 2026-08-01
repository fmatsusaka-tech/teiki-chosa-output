import { describe, expect, it } from "vitest";
import {
  calculatePrediction,
  roundPredictionForDisplay,
} from "./prediction-engine";
import type { PredictionCalculationInput } from "./prediction-engine.types";
import type { PredictionModelMaster } from "../prediction-data/prediction-master.types";
import { predictionModelOrder, sourceSheetByMetric } from "../prediction-data/prediction-master-contract";

const dataVersion = "1.0.1";
const generatedAt = "2026-08-01T12:34:56+09:00";

const input = (
  overrides: Partial<PredictionCalculationInput> = {},
): PredictionCalculationInput => {
  const metric = overrides.metric ?? "横径";
  const predictionModel = overrides.predictionModel ?? "ゆら早生";
  const measuredMonthDay = overrides.measuredMonthDay ?? "07-17";
  const targetMonthDay = overrides.targetMonthDay ?? "10-15";
  const model: PredictionModelMaster = {
    displayCategory: "ゆら早生",
    predictionModel,
    targetMonthDay,
    active: true,
    selectionCriteria: "",
    sourceYears: "",
    dataVersion,
    generatedAt,
  };
  return {
    metric,
    predictionModel,
    measuredValue: 37.3,
    measuredMonthDay,
    targetMonthDay,
    model,
    measuredCoefficient: {
      metric,
      predictionModel,
      monthDay: measuredMonthDay,
      coefficient: 1.02103168476489,
      sourceSheet: sourceSheetByMetric[metric],
      sourceCell: `'${sourceSheetByMetric[metric]}'!AH17`,
      dataVersion,
      generatedAt,
    },
    targetCoefficient: {
      metric,
      predictionModel,
      monthDay: targetMonthDay,
      coefficient: 1.75269757946923,
      sourceSheet: sourceSheetByMetric[metric],
      sourceCell: `'${sourceSheetByMetric[metric]}'!AH107`,
      dataVersion,
      generatedAt,
    },
    expectedDataVersion: dataVersion,
    ...overrides,
  };
};

const errorCode = (value: PredictionCalculationInput): string | undefined => {
  const outcome = calculatePrediction(value);
  return outcome.ok ? undefined : outcome.error.code;
};

describe("calculatePrediction", () => {
  it.each([
    ["横径", 37.3, 1.02103168476489, 1.75269757946923, 64.02898234177339, 64],
    ["糖度", 8, 1.33383838383838, 1.73905723905724, 10.430392528082832, 10.4],
    ["クエン酸", 0.98, 0.223012656133675, 0.20005790387956, 0.8791283382789329, 0.88],
  ] as const)(
    "%sの既存回帰値を計算する",
    (metric, measuredValue, measured, target, raw, displayed) => {
      const value = input({
        metric,
        measuredValue,
        predictionModel: metric === "横径" ? "ゆら早生" : "田口早生",
      });
      const predictionModel = value.predictionModel;
      const measuredMonthDay = metric === "横径" ? "07-17" : metric === "糖度" ? "09-01" : "11-05";
      const targetMonthDay = metric === "横径" ? "10-15" : "11-15";
      const outcome = calculatePrediction({
        ...value,
        measuredMonthDay,
        targetMonthDay,
        model: { ...value.model, predictionModel, targetMonthDay },
        measuredCoefficient: {
          ...value.measuredCoefficient,
          metric,
          predictionModel,
          monthDay: measuredMonthDay,
          coefficient: measured,
        },
        targetCoefficient: {
          ...value.targetCoefficient,
          metric,
          predictionModel,
          monthDay: targetMonthDay,
          coefficient: target,
        },
      });
      expect(outcome).toMatchObject({ ok: true, result: { rawPrediction: raw } });
      if (outcome.ok) {
        expect(roundPredictionForDisplay(metric, outcome.result.rawPrediction)).toBe(displayed);
      }
    },
  );

  it.each(predictionModelOrder)("%sでも同じ比率式を使用する", (predictionModel) => {
    const value = input({ predictionModel });
    const outcome = calculatePrediction({
      ...value,
      model: { ...value.model, predictionModel },
      measuredCoefficient: { ...value.measuredCoefficient, predictionModel, coefficient: 2 },
      targetCoefficient: { ...value.targetCoefficient, predictionModel, coefficient: 3 },
      measuredValue: 10,
    });
    expect(outcome).toMatchObject({ ok: true, result: { rawPrediction: 15 } });
  });

  it("調査日と目標日が同じなら調査値を返す", () => {
    const value = input({ measuredMonthDay: "10-15", measuredValue: 12.34 });
    const outcome = calculatePrediction({
      ...value,
      measuredCoefficient: { ...value.measuredCoefficient, monthDay: "10-15", coefficient: 1.5 },
      targetCoefficient: { ...value.targetCoefficient, coefficient: 1.5 },
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.rawPrediction).toBeCloseTo(12.34, 12);
    }
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "不正な調査値 %s を拒否する",
    (measuredValue) => expect(errorCode(input({ measuredValue }))).toBe("INVALID_MEASURED_VALUE"),
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "不正な調査日係数 %s を拒否する",
    (coefficient) => {
      const value = input();
      expect(errorCode({ ...value, measuredCoefficient: { ...value.measuredCoefficient, coefficient } })).toBe("INVALID_MEASURED_COEFFICIENT");
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "不正な目標日係数 %s を拒否する",
    (coefficient) => {
      const value = input();
      expect(errorCode({ ...value, targetCoefficient: { ...value.targetCoefficient, coefficient } })).toBe("INVALID_TARGET_COEFFICIENT");
    },
  );

  it("inactiveモデルを拒否する", () => {
    const value = input();
    expect(errorCode({ ...value, model: { ...value.model, active: false as true } })).toBe("INACTIVE_MODEL");
  });

  it.each(["model", "measured", "target"] as const)(
    "%sのモデル不一致を拒否する",
    (location) => {
      const value = input();
      const mismatched = {
        ...value,
        ...(location === "model"
          ? { model: { ...value.model, predictionModel: "興津早生" } }
          : {}),
        ...(location === "measured"
          ? {
              measuredCoefficient: {
                ...value.measuredCoefficient,
                predictionModel: "興津早生",
              },
            }
          : {}),
        ...(location === "target"
          ? {
              targetCoefficient: {
                ...value.targetCoefficient,
                predictionModel: "興津早生",
              },
            }
          : {}),
      };
      expect(errorCode(mismatched)).toBe("MODEL_MISMATCH");
    },
  );

  it("指標不一致を拒否する", () => {
    const value = input();
    expect(errorCode({ ...value, targetCoefficient: { ...value.targetCoefficient, metric: "糖度" } })).toBe("METRIC_MISMATCH");
  });

  it("調査日の月日不一致を拒否する", () => {
    const value = input();
    expect(errorCode({ ...value, measuredCoefficient: { ...value.measuredCoefficient, monthDay: "07-18" } })).toBe("MEASURED_MONTH_DAY_MISMATCH");
  });

  it("目標日の月日不一致を拒否する", () => {
    const value = input();
    expect(errorCode({ ...value, targetCoefficient: { ...value.targetCoefficient, monthDay: "10-14" } })).toBe("TARGET_MONTH_DAY_MISMATCH");
  });

  it("モデルの目標日不一致を拒否する", () => {
    const value = input();
    expect(errorCode({ ...value, model: { ...value.model, targetMonthDay: "10-14" } })).toBe("TARGET_MONTH_DAY_MISMATCH");
  });

  it.each(["model", "measured", "target"] as const)(
    "%sのdataVersion不一致を拒否する",
    (location) => {
      const value = input();
      const mismatched = {
        ...value,
        ...(location === "model"
          ? { model: { ...value.model, dataVersion: "1.0.0" } }
          : {}),
        ...(location === "measured"
          ? {
              measuredCoefficient: {
                ...value.measuredCoefficient,
                dataVersion: "1.0.0",
              },
            }
          : {}),
        ...(location === "target"
          ? {
              targetCoefficient: {
                ...value.targetCoefficient,
                dataVersion: "1.0.0",
              },
            }
          : {}),
      };
      expect(errorCode(mismatched)).toBe("DATA_VERSION_MISMATCH");
    },
  );

  it("演算結果がオーバーフローする場合を拒否する", () => {
    const value = input({ measuredValue: Number.MAX_VALUE });
    expect(
      errorCode({
        ...value,
        measuredCoefficient: { ...value.measuredCoefficient, coefficient: 1 },
        targetCoefficient: { ...value.targetCoefficient, coefficient: 2 },
      }),
    ).toBe("INVALID_PREDICTION_RESULT");
  });

  it("入力と原典追跡情報を変更せず成功結果へ保持する", () => {
    const value = input();
    const before = structuredClone(value);
    const outcome = calculatePrediction(value);
    expect(value).toEqual(before);
    expect(outcome).toMatchObject({
      ok: true,
      result: {
        measuredSourceSheet: "横径予測",
        measuredSourceCell: "'横径予測'!AH17",
        targetSourceSheet: "横径予測",
        targetSourceCell: "'横径予測'!AH107",
      },
    });
  });

  it("複数不一致では検証順の最初のエラーを返す", () => {
    const value = input({ measuredValue: 0 });
    expect(errorCode({
      ...value,
      model: { ...value.model, active: false as true },
      measuredCoefficient: { ...value.measuredCoefficient, coefficient: 0, metric: "糖度" },
    })).toBe("INVALID_MEASURED_VALUE");
  });
});

describe("roundPredictionForDisplay", () => {
  it.each([
    ["横径", 1.25, 1.3],
    ["糖度", 10.44, 10.4],
    ["クエン酸", 0.885, 0.89],
  ] as const)("%sを契約桁数へ丸める", (metric, raw, expected) => {
    expect(roundPredictionForDisplay(metric, raw)).toBe(expected);
  });

  it("-0を0へ正規化する", () => {
    const rounded = roundPredictionForDisplay("横径", -0.01);
    expect(rounded).toBe(0);
    expect(Object.is(rounded, -0)).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "非有限数 %s を拒否する",
    (value) => expect(() => roundPredictionForDisplay("横径", value)).toThrow(RangeError),
  );
});
