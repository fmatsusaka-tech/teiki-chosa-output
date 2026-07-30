import {
  predictionMetricOrder,
  predictionModelOrder,
  sourceSheetByMetric,
} from "./prediction-master-contract";
import type {
  PredictionCoefficientMaster,
  PredictionMasterBundle,
  PredictionModelMaster,
} from "./prediction-master.types";

const monthDayPattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const dataVersionPattern = /^\d+\.\d+\.\d+$/;
const generatedAtPattern =
  /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\+09:00$/;
const sourceCellPattern = /^'([^']+)'![A-Z]+[1-9]\d*$/;
const modelAttributeKeys = [
  "displayCategory",
  "predictionModel",
  "targetMonthDay",
  "active",
  "selectionCriteria",
  "sourceYears",
] as const;
const modelStringKeys = [
  "displayCategory",
  "predictionModel",
  "targetMonthDay",
  "selectionCriteria",
  "sourceYears",
  "dataVersion",
  "generatedAt",
] as const;
const coefficientStringKeys = [
  "metric",
  "predictionModel",
  "monthDay",
  "sourceSheet",
  "sourceCell",
  "dataVersion",
  "generatedAt",
] as const;

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`${label}は文字列ではありません。`);
  }
}

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

const validateDataVersion = (
  value: string,
  expectedDataVersion: string,
): void => {
  if (!dataVersionPattern.test(value)) {
    throw new Error(`無効なデータ版です: ${value || "(空)"}`);
  }
  if (value !== expectedDataVersion) {
    throw new Error(
      `データ版がCLI指定値と一致しません: expected=${expectedDataVersion} actual=${value}`,
    );
  }
};

const validateGeneratedAt = (value: string): void => {
  const parsed = new Date(value);
  const local = new Date(parsed.getTime() + 9 * 60 * 60 * 1000);
  const canonical = Number.isNaN(parsed.getTime())
    ? ""
    : `${String(local.getUTCFullYear()).padStart(4, "0")}-${String(
        local.getUTCMonth() + 1,
      ).padStart(2, "0")}-${String(local.getUTCDate()).padStart(
        2,
        "0",
      )}T${String(local.getUTCHours()).padStart(2, "0")}:${String(
        local.getUTCMinutes(),
      ).padStart(2, "0")}:${String(local.getUTCSeconds()).padStart(
        2,
        "0",
      )}+09:00`;
  if (!generatedAtPattern.test(value) || canonical !== value) {
    throw new Error(`無効な生成日時です: ${value}`);
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

export const validateExtractedModelConsistency = (
  models: readonly PredictionModelMaster[],
): void => {
  const byModel = new Map<string, PredictionModelMaster[]>();
  for (const model of models) {
    const rows = byModel.get(model.predictionModel) ?? [];
    rows.push(model);
    byModel.set(model.predictionModel, rows);
  }
  for (const [predictionModel, rows] of byModel) {
    if (rows.length !== 3) {
      throw new Error(
        `3原典シートすべてにモデルがありません: ${predictionModel}/${rows.length}件`,
      );
    }
    const reference = rows[0];
    for (const row of rows.slice(1)) {
      for (const key of modelAttributeKeys) {
        if (row[key] !== reference[key]) {
          throw new Error(
            `3原典シート間でモデル属性が一致しません: ${predictionModel}/${key}`,
          );
        }
      }
    }
  }
};

export const validatePredictionMasters = (
  bundle: PredictionMasterBundle,
  expectedDataVersion: string,
): void => {
  if (bundle.models.length !== predictionModelOrder.length) {
    throw new Error(`予測モデル数が6件ではありません: ${bundle.models.length}`);
  }
  if (bundle.coefficients.length === 0) {
    throw new Error("係数が0件です。");
  }
  if (!dataVersionPattern.test(expectedDataVersion)) {
    throw new Error(
      `無効なCLI指定データ版です: ${expectedDataVersion || "(空)"}`,
    );
  }

  for (const model of bundle.models) {
    for (const key of modelStringKeys) {
      assertString(model[key], `予測モデル.${key}`);
    }
    if (model.active !== true) {
      throw new Error(
        `予測モデル.activeはtrueではありません: ${model.predictionModel}`,
      );
    }
    if (!predictionModelOrder.includes(model.predictionModel as never)) {
      throw new Error(`未知の予測モデルです: ${model.predictionModel}`);
    }
    monthDayDate(model.targetMonthDay, 2000);
    validateDataVersion(model.dataVersion, expectedDataVersion);
    validateGeneratedAt(model.generatedAt);
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
  for (const model of predictionModelOrder) {
    if (!actualModels.has(model))
      throw new Error(`予測モデルがありません: ${model}`);
  }

  const generatedAt = bundle.models[0].generatedAt;
  for (const item of bundle.coefficients) {
    for (const key of coefficientStringKeys) {
      assertString(item[key], `予測係数.${key}`);
    }
    if (!predictionMetricOrder.includes(item.metric as never)) {
      throw new Error(`未知の指標です: ${item.metric}`);
    }
    if (!actualModels.has(item.predictionModel)) {
      throw new Error(
        `係数の予測モデルがモデルマスタにありません: ${item.predictionModel}`,
      );
    }
    monthDayDate(item.monthDay, 2000);
    if (!Number.isFinite(item.coefficient) || item.coefficient <= 0) {
      throw new Error(`無効な係数です: ${item.sourceCell}`);
    }
    const expectedSheet = sourceSheetByMetric[item.metric];
    if (item.sourceSheet !== expectedSheet) {
      throw new Error(
        `指標と原典シートが一致しません: ${item.metric}/${item.sourceSheet}`,
      );
    }
    const sourceCell = sourceCellPattern.exec(item.sourceCell);
    if (!sourceCell || sourceCell[1] !== item.sourceSheet) {
      throw new Error(`原典シートと原典セルが一致しません: ${item.sourceCell}`);
    }
    validateDataVersion(item.dataVersion, expectedDataVersion);
    validateGeneratedAt(item.generatedAt);
    if (item.generatedAt !== generatedAt) {
      throw new Error(`生成日時が全行で一致しません: ${item.sourceCell}`);
    }
  }

  for (const model of bundle.models) {
    if (model.generatedAt !== generatedAt) {
      throw new Error(`生成日時が全行で一致しません: ${model.predictionModel}`);
    }
    for (const metric of predictionMetricOrder) {
      const rows = bundle.coefficients.filter(
        (item) =>
          item.metric === metric &&
          item.predictionModel === model.predictionModel,
      );
      if (rows.length === 0) {
        throw new Error(
          `${metric}/${model.predictionModel} の係数がありません。`,
        );
      }
      validateDailyContinuity(rows, model.targetMonthDay);
    }
  }
};
