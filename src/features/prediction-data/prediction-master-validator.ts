import type {
  PredictionCoefficientMaster,
  PredictionMasterBundle,
} from "./prediction-master.types";

const expectedModels = [
  "ゆら早生",
  "興津早生",
  "田口早生",
  "向山温州",
  "林温州",
  "丹生温州",
] as const;
const expectedMetrics = ["横径", "糖度", "クエン酸"] as const;

const monthDayPattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const monthDayDate = (value: string, year: number): Date => {
  if (!monthDayPattern.test(value)) throw new Error(`無効な月日です: ${value}`);
  const [month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`無効な月日です: ${value}`);
  }
  return date;
};

const unique = (values: string[], label: string): void => {
  if (new Set(values).size !== values.length) {
    throw new Error(`重複した${label}があります。`);
  }
};

const validateDailyContinuity = (
  rows: readonly PredictionCoefficientMaster[],
  targetMonthDay: string,
): void => {
  const ordered = [...rows].sort((left, right) =>
    left.monthDay.localeCompare(right.monthDay),
  );
  if (!ordered.some((row) => row.monthDay === targetMonthDay)) {
    throw new Error(
      `${ordered[0].metric}/${ordered[0].predictionModel} の目標日係数がありません。`,
    );
  }
  const targetIndex = ordered.findIndex(
    (row) => row.monthDay === targetMonthDay,
  );
  for (let index = 1; index <= targetIndex; index += 1) {
    const previous = monthDayDate(ordered[index - 1].monthDay, 2000);
    const current = monthDayDate(ordered[index].monthDay, 2000);
    const expected = new Date(previous.getTime() + 86_400_000);
    if (current.getTime() !== expected.getTime()) {
      throw new Error(
        `${ordered[index].metric}/${ordered[index].predictionModel} の日別係数が連続していません: ${ordered[index - 1].monthDay} → ${ordered[index].monthDay}`,
      );
    }
  }
};

export const validatePredictionMasters = (
  bundle: PredictionMasterBundle,
): void => {
  if (bundle.models.length !== expectedModels.length) {
    throw new Error(`予測モデル数が6件ではありません: ${bundle.models.length}`);
  }
  if (bundle.coefficients.length === 0) {
    throw new Error("係数が0件です。");
  }
  unique(
    bundle.models.map((item) => item.predictionModel),
    "予測モデル",
  );
  unique(
    bundle.coefficients.map(
      (item) => `${item.metric}/${item.predictionModel}/${item.monthDay}`,
    ),
    "係数キー",
  );

  const actualModels = new Set(
    bundle.models.map((item) => item.predictionModel),
  );
  for (const model of expectedModels) {
    if (!actualModels.has(model)) throw new Error(`予測モデルがありません: ${model}`);
  }

  const actualMetrics = new Set(
    bundle.coefficients.map((item) => item.metric),
  );
  for (const metric of expectedMetrics) {
    if (!actualMetrics.has(metric)) throw new Error(`指標がありません: ${metric}`);
  }

  for (const model of bundle.models) {
    monthDayDate(model.targetMonthDay, 2000);
    for (const metric of expectedMetrics) {
      const rows = bundle.coefficients.filter(
        (item) =>
          item.metric === metric &&
          item.predictionModel === model.predictionModel,
      );
      if (rows.length === 0) {
        throw new Error(`${metric}/${model.predictionModel} の係数がありません。`);
      }
      for (const item of rows) {
        monthDayDate(item.monthDay, 2000);
        if (!Number.isFinite(item.coefficient) || item.coefficient <= 0) {
          throw new Error(`無効な係数です: ${item.sourceCell}`);
        }
        if (
          item.sourceSheet.length === 0 ||
          !/^'.+'![A-Z]+[1-9]\d*$/.test(item.sourceCell)
        ) {
          throw new Error(`無効な原典セルです: ${item.sourceCell}`);
        }
      }
      validateDailyContinuity(rows, model.targetMonthDay);
    }
  }
};
