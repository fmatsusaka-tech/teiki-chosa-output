import type {
  PredictionMasterBundle,
  PredictionMetric,
} from "./prediction-master.types";

export type PredictionRegressionResult = {
  metric: PredictionMetric;
  predictionModel: string;
  measuredMonthDay: string;
  measuredValue: number;
  measuredCoefficient: number;
  measuredSourceCell: string;
  targetMonthDay: string;
  targetCoefficient: number;
  targetSourceCell: string;
  rawPrediction: number;
  displayedPrediction: number;
  expectedPrediction: number;
  digits: number;
};

const cases = [
  {
    metric: "横径",
    predictionModel: "ゆら早生",
    measuredMonthDay: "07-17",
    measuredValue: 37.3,
    targetMonthDay: "10-15",
    expectedPrediction: 64.0,
    digits: 1,
  },
  {
    metric: "糖度",
    predictionModel: "田口早生",
    measuredMonthDay: "09-01",
    measuredValue: 8.0,
    targetMonthDay: "11-15",
    expectedPrediction: 10.4,
    digits: 1,
  },
  {
    metric: "クエン酸",
    predictionModel: "田口早生",
    measuredMonthDay: "11-05",
    measuredValue: 0.98,
    targetMonthDay: "11-15",
    expectedPrediction: 0.88,
    digits: 2,
  },
] as const;

export const verifyPredictionRegressions = (
  bundle: PredictionMasterBundle,
): PredictionRegressionResult[] =>
  cases.map((testCase) => {
    const measured = bundle.coefficients.find(
      (row) =>
        row.metric === testCase.metric &&
        row.predictionModel === testCase.predictionModel &&
        row.monthDay === testCase.measuredMonthDay,
    );
    const target = bundle.coefficients.find(
      (row) =>
        row.metric === testCase.metric &&
        row.predictionModel === testCase.predictionModel &&
        row.monthDay === testCase.targetMonthDay,
    );
    if (!measured || !target) {
      throw new Error(
        `回帰係数がありません: ${testCase.metric}/${testCase.predictionModel}`,
      );
    }
    const rawPrediction =
      (testCase.measuredValue * target.coefficient) / measured.coefficient;
    const displayedPrediction = Number(rawPrediction.toFixed(testCase.digits));
    if (displayedPrediction !== testCase.expectedPrediction) {
      throw new Error(
        `回帰結果が一致しません: ${testCase.metric}/${testCase.predictionModel} expected=${testCase.expectedPrediction} actual=${displayedPrediction}`,
      );
    }
    return {
      ...testCase,
      measuredCoefficient: measured.coefficient,
      measuredSourceCell: measured.sourceCell,
      targetCoefficient: target.coefficient,
      targetSourceCell: target.sourceCell,
      rawPrediction,
      displayedPrediction,
    };
  });
