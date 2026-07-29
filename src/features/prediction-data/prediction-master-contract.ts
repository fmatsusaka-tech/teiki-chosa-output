import type {
  PredictionCoefficientMaster,
  PredictionMasterBundle,
  PredictionMetric,
  PredictionModelMaster,
} from "./prediction-master.types";

export const predictionModelOrder = [
  "ゆら早生",
  "興津早生",
  "田口早生",
  "向山温州",
  "林温州",
  "丹生温州",
] as const;
export const predictionMetricOrder = ["横径", "糖度", "クエン酸"] as const;
export const sourceSheetByMetric: Record<PredictionMetric, string> = {
  横径: "横径予測",
  糖度: "糖度予測",
  クエン酸: "酸度予測",
};

const modelRank = new Map<string, number>(
  predictionModelOrder.map((model, index) => [model, index]),
);
const metricRank = new Map(
  predictionMetricOrder.map((metric, index) => [metric, index]),
);

export const sortPredictionMasterBundle = (
  bundle: PredictionMasterBundle,
): PredictionMasterBundle => ({
  models: [...bundle.models].sort(
    (left: PredictionModelMaster, right: PredictionModelMaster) =>
      (modelRank.get(left.predictionModel) ?? Number.MAX_SAFE_INTEGER) -
      (modelRank.get(right.predictionModel) ?? Number.MAX_SAFE_INTEGER),
  ),
  coefficients: [...bundle.coefficients].sort(
    (left: PredictionCoefficientMaster, right: PredictionCoefficientMaster) =>
      (metricRank.get(left.metric) ?? Number.MAX_SAFE_INTEGER) -
        (metricRank.get(right.metric) ?? Number.MAX_SAFE_INTEGER) ||
      (modelRank.get(left.predictionModel) ?? Number.MAX_SAFE_INTEGER) -
        (modelRank.get(right.predictionModel) ?? Number.MAX_SAFE_INTEGER) ||
      left.monthDay.localeCompare(right.monthDay),
  ),
});
