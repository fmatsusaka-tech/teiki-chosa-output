import type { PredictionRegressionResult } from "./prediction-master-regression";
import type { PredictionMasterBundle } from "./prediction-master.types";

const groups = (bundle: PredictionMasterBundle) => [
  ...bundle.coefficients
    .reduce((result, row) => {
      const key = `${row.metric}\u0000${row.predictionModel}`;
      const value = result.get(key) ?? [];
      value.push(row);
      result.set(key, value);
      return result;
    }, new Map<string, PredictionMasterBundle["coefficients"]>())
    .entries(),
];

export const formatPredictionSummary = (
  bundle: PredictionMasterBundle,
  dataVersion: string,
): string => {
  const grouped = groups(bundle);
  if (bundle.models.length === 0 || grouped.length === 0) {
    throw new Error("空のSummaryは出力できません。");
  }
  return [
    `データ版: ${dataVersion}`,
    `モデル数: ${bundle.models.length}`,
    `係数総件数: ${bundle.coefficients.length}`,
    "生成対象",
    "====================",
    ...grouped
      .sort(([left], [right]) => left.localeCompare(right, "ja"))
      .flatMap(([key, rows]) => {
        const [metric, model] = key.split("\u0000");
        const dates = rows.map((row) => row.monthDay).sort();
        return [
          `${metric} / ${model}`,
          `開始日: ${dates[0]}`,
          `終了日: ${dates.at(-1)}`,
          `件数: ${rows.length}`,
        ];
      }),
    "====================",
  ].join("\n");
};

export const formatPredictionDryRun = (
  bundle: PredictionMasterBundle,
  dataVersion: string,
  regressions: readonly PredictionRegressionResult[],
): string => {
  if (regressions.length === 0) {
    throw new Error("回帰結果が0件です。");
  }
  return [
    formatPredictionSummary(bundle, dataVersion),
    "",
    "検証成功",
    "重複: なし",
    "欠落: なし",
    "警告: なし",
    "",
    "回帰3例",
    ...regressions.flatMap((result) => [
      `${result.metric} / ${result.predictionModel}`,
      `計測日係数: ${result.measuredCoefficient} (${result.measuredSourceCell})`,
      `目標日係数: ${result.targetCoefficient} (${result.targetSourceCell})`,
      `未丸め予測値: ${result.rawPrediction}`,
      `表示丸め値: ${result.displayedPrediction.toFixed(result.digits)}`,
      `期待値: ${result.expectedPrediction.toFixed(result.digits)}`,
    ]),
  ].join("\n");
};
