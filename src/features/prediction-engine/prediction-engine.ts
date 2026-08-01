import type { PredictionMetric } from "../prediction-data/prediction-master.types";
import type {
  PredictionCalculationErrorCode,
  PredictionCalculationInput,
  PredictionCalculationOutcome,
} from "./prediction-engine.types";

const failure = (
  code: PredictionCalculationErrorCode,
  message: string,
): PredictionCalculationOutcome => ({ ok: false, error: { code, message } });

const isPositiveFinite = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

/**
 * Calculates one metric for one measured value. Model and coefficient lookup,
 * date-range decisions, persistence, and display formatting are deliberately
 * outside this function.
 */
export const calculatePrediction = (
  input: PredictionCalculationInput,
): PredictionCalculationOutcome => {
  if (!isPositiveFinite(input.measuredValue)) {
    return failure(
      "INVALID_MEASURED_VALUE",
      "調査値は有限かつ0より大きい必要があります。",
    );
  }
  if (!isPositiveFinite(input.measuredCoefficient.coefficient)) {
    return failure(
      "INVALID_MEASURED_COEFFICIENT",
      "調査日係数は有限かつ0より大きい必要があります。",
    );
  }
  if (!isPositiveFinite(input.targetCoefficient.coefficient)) {
    return failure(
      "INVALID_TARGET_COEFFICIENT",
      "目標日係数は有限かつ0より大きい必要があります。",
    );
  }
  if (input.model.active !== true) {
    return failure("INACTIVE_MODEL", "無効な予測モデルは使用できません。");
  }
  if (
    input.model.predictionModel !== input.predictionModel ||
    input.measuredCoefficient.predictionModel !== input.predictionModel ||
    input.targetCoefficient.predictionModel !== input.predictionModel
  ) {
    return failure(
      "MODEL_MISMATCH",
      "入力、モデル、係数の予測モデルが一致しません。",
    );
  }
  if (
    input.measuredCoefficient.metric !== input.metric ||
    input.targetCoefficient.metric !== input.metric
  ) {
    return failure(
      "METRIC_MISMATCH",
      "入力と係数の指標が一致しません。",
    );
  }
  if (input.measuredCoefficient.monthDay !== input.measuredMonthDay) {
    return failure(
      "MEASURED_MONTH_DAY_MISMATCH",
      "調査日と調査日係数の月日が一致しません。",
    );
  }
  if (
    input.targetCoefficient.monthDay !== input.targetMonthDay ||
    input.model.targetMonthDay !== input.targetMonthDay
  ) {
    return failure(
      "TARGET_MONTH_DAY_MISMATCH",
      "目標日とモデルまたは目標日係数の月日が一致しません。",
    );
  }
  if (
    input.model.dataVersion !== input.expectedDataVersion ||
    input.measuredCoefficient.dataVersion !== input.expectedDataVersion ||
    input.targetCoefficient.dataVersion !== input.expectedDataVersion
  ) {
    return failure(
      "DATA_VERSION_MISMATCH",
      "モデルまたは係数のデータ版が期待値と一致しません。",
    );
  }

  const rawPrediction =
    (input.measuredValue * input.targetCoefficient.coefficient) /
    input.measuredCoefficient.coefficient;
  if (!Number.isFinite(rawPrediction)) {
    return failure(
      "INVALID_PREDICTION_RESULT",
      "予測値を有限数として計算できません。",
    );
  }

  return {
    ok: true,
    result: {
      metric: input.metric,
      predictionModel: input.predictionModel,
      measuredValue: input.measuredValue,
      measuredMonthDay: input.measuredMonthDay,
      measuredCoefficient: input.measuredCoefficient.coefficient,
      measuredSourceSheet: input.measuredCoefficient.sourceSheet,
      measuredSourceCell: input.measuredCoefficient.sourceCell,
      targetMonthDay: input.targetMonthDay,
      targetCoefficient: input.targetCoefficient.coefficient,
      targetSourceSheet: input.targetCoefficient.sourceSheet,
      targetSourceCell: input.targetCoefficient.sourceCell,
      rawPrediction,
      dataVersion: input.expectedDataVersion,
    },
  };
};

const displayDigits: Record<PredictionMetric, number> = {
  横径: 1,
  糖度: 1,
  クエン酸: 2,
};

/** Applies the established display rounding without changing the raw value. */
export const roundPredictionForDisplay = (
  metric: PredictionMetric,
  rawPrediction: number,
): number => {
  if (!Number.isFinite(rawPrediction)) {
    throw new RangeError("表示丸めの対象は有限数である必要があります。");
  }
  const rounded = Number(rawPrediction.toFixed(displayDigits[metric]));
  return Object.is(rounded, -0) ? 0 : rounded;
};
