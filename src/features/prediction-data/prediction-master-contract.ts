import type {
  PredictionCoefficientMaster,
  PredictionMasterBundle,
  PredictionMetric,
  PredictionModelMaster,
} from "./prediction-master.types";

export const predictionModelSheetTitle = "予測モデルマスタ";
export const predictionCoefficientSheetTitle = "予測係数マスタ";
export const predictionMasterSpreadsheetTitle = "定期調査Output予測マスタ";

export const predictionModelHeaders = [
  "表示カテゴリー",
  "予測モデル",
  "収穫目標月日",
  "有効",
  "選抜基準",
  "引用年次",
  "データ版",
  "生成日時",
] as const;
export const predictionCoefficientHeaders = [
  "指標",
  "予測モデル",
  "月日",
  "推移係数",
  "原典シート",
  "原典セル",
  "データ版",
  "生成日時",
] as const;

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
