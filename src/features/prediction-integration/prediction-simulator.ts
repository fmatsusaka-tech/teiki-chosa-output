import { calculatePrediction, roundPredictionForDisplay } from "../prediction-engine/prediction-engine";
import { predictionMetricOrder } from "../prediction-data/prediction-master-contract";
import type { PredictionMasterBundle, PredictionMetric } from "../prediction-data/prediction-master.types";
import { validatePredictionMasters } from "../prediction-data/prediction-master-validator";

export type PredictionSimulationInput = {
  predictionModel: string;
  assumedDate: string;
  values: Record<PredictionMetric, number | null>;
  expectedDataVersion: string;
};

export type PredictionSimulationMetricResult =
  | { ok: true; measuredValue: number; predictedValue: number; rawPrediction: number }
  | { ok: false; reason: string };

export type PredictionSimulationResult = {
  predictionModel: string;
  assumedDate: string;
  targetMonthDay: string | null;
  dataVersion: string;
  metrics: Record<PredictionMetric, PredictionSimulationMetricResult>;
};

const key = (metric: PredictionMetric, model: string, monthDay: string) => `${metric}\u0000${model}\u0000${monthDay}`;
const failed = (reason: string): PredictionSimulationMetricResult => ({ ok: false, reason });

export const simulatePrediction = (
  bundle: PredictionMasterBundle,
  input: PredictionSimulationInput,
): PredictionSimulationResult => {
  validatePredictionMasters(bundle, input.expectedDataVersion);
  const model = bundle.models.find((candidate) => candidate.predictionModel === input.predictionModel);
  const dateMatch = /^\d{4}-(\d{2})-(\d{2})$/.exec(input.assumedDate);
  const measuredMonthDay = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}` : null;
  const coefficientIndex = new Map(bundle.coefficients.map((coefficient) => [key(coefficient.metric, coefficient.predictionModel, coefficient.monthDay), coefficient]));

  const metrics = Object.fromEntries(predictionMetricOrder.map((metric) => {
    if (!model) return [metric, failed("予測モデルが見つかりません。")];
    if (!measuredMonthDay) return [metric, failed("仮定日を入力してください。")];
    if (measuredMonthDay > model.targetMonthDay) return [metric, failed("仮定日が収穫目標日を過ぎています。")];
    const value = input.values[metric];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return [metric, failed("0より大きい仮定値を入力してください。")];
    const measuredCoefficient = coefficientIndex.get(key(metric, model.predictionModel, measuredMonthDay));
    if (!measuredCoefficient) return [metric, failed("仮定日の係数がありません。")];
    const targetCoefficient = coefficientIndex.get(key(metric, model.predictionModel, model.targetMonthDay));
    if (!targetCoefficient) return [metric, failed("収穫目標日の係数がありません。")];
    const outcome = calculatePrediction({ metric, predictionModel: model.predictionModel, measuredValue: value, measuredMonthDay, targetMonthDay: model.targetMonthDay, model, measuredCoefficient, targetCoefficient, expectedDataVersion: input.expectedDataVersion });
    return outcome.ok
      ? [metric, { ok: true, measuredValue: value, predictedValue: roundPredictionForDisplay(metric, outcome.result.rawPrediction), rawPrediction: outcome.result.rawPrediction }]
      : [metric, failed("予測値を計算できませんでした。")];
  })) as Record<PredictionMetric, PredictionSimulationMetricResult>;

  return { predictionModel: input.predictionModel, assumedDate: input.assumedDate, targetMonthDay: model?.targetMonthDay ?? null, dataVersion: input.expectedDataVersion, metrics };
};
