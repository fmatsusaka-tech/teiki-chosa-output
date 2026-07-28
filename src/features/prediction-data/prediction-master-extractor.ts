import { getVarietyCategory } from "../shared/variety-category";
import type {
  LegacyPredictionSheet,
  PredictionCoefficientMaster,
  PredictionMetric,
  PredictionModelMaster,
  SheetCell,
} from "./prediction-master.types";

const supportedModels = [
  "ゆら早生",
  "興津早生",
  "田口早生",
  "向山温州",
  "林温州",
  "丹生温州",
] as const;

const modelAliases: Record<string, string> = {
  向山: "向山温州",
  林: "林温州",
  丹生: "丹生温州",
};

const metricBySheet: Record<string, PredictionMetric> = {
  横径予測: "横径",
  糖度予測: "糖度",
  酸度予測: "クエン酸",
};

const columnName = (index: number): string => {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

const text = (cell: SheetCell | undefined): string =>
  cell?.formattedValue?.trim() ?? "";

const number = (cell: SheetCell | undefined): number | null =>
  cell?.effectiveValue?.numberValue ?? null;

export const toMonthDay = (value: string | number): string => {
  if (typeof value === "string") {
    const match = /^(\d{1,2})\s*(?:\/|月)\s*(\d{1,2})/.exec(value.trim());
    if (match) {
      return `${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  throw new Error(`月日をMM-DDへ変換できません: ${String(value)}`);
};

const canonicalModel = (value: string): string => modelAliases[value] ?? value;

const categoryForModel = (model: string): string => {
  const supported = supportedModels.find(
    (candidate) => candidate === canonicalModel(model),
  );
  if (!supported) throw new Error(`未対応の予測モデルです: ${model}`);
  const category = getVarietyCategory(
    supported === "興津早生" ? "早生" : supported,
  );
  if (!category) throw new Error(`表示カテゴリーを解決できません: ${model}`);
  return category;
};

const findModelHeaders = (
  sheet: LegacyPredictionSheet,
): { row: number; column: number }[] => {
  const headers: { row: number; column: number }[] = [];
  for (let row = 0; row < sheet.grid.length; row += 1) {
    for (
      let column = 0;
      column < (sheet.grid[row]?.length ?? 0);
      column += 1
    ) {
      if (
        text(sheet.grid[row][column]) === "品種一覧" &&
        text(sheet.grid[row][column + 1]) === "目標月/日"
      ) {
        headers.push({ row, column });
      }
    }
  }
  return headers;
};

const extractModels = (
  sheet: LegacyPredictionSheet,
  dataVersion: string,
  generatedAt: string,
): PredictionModelMaster[] => {
  const models: PredictionModelMaster[] = [];
  const seenModels = new Set<string>();

  for (const { row, column } of findModelHeaders(sheet)) {
    for (let dataRow = row + 1; dataRow < sheet.grid.length; dataRow += 1) {
      const rawModel = text(sheet.grid[dataRow]?.[column]);
      if (!rawModel) break;
      const predictionModel = canonicalModel(rawModel);
      const targetCell = sheet.grid[dataRow]?.[column + 1];
      const targetMonthDay = toMonthDay(number(targetCell) ?? text(targetCell));
      if (seenModels.has(predictionModel)) continue;
      models.push({
        displayCategory: categoryForModel(predictionModel),
        predictionModel,
        targetMonthDay,
        active: true,
        selectionCriteria: text(sheet.grid[dataRow]?.[column + 2]),
        sourceYears: text(sheet.grid[dataRow]?.[column + 3]),
        dataVersion,
        generatedAt,
      });
      seenModels.add(predictionModel);
    }
  }
  return models;
};

const findModelLabel = (
  sheet: LegacyPredictionSheet,
  row: number,
  column: number,
): string | null => {
  const label = [row - 1, row - 2, row - 3]
    .flatMap((rowIndex) => [
      text(sheet.grid[rowIndex]?.[column - 1]),
      text(sheet.grid[rowIndex]?.[column]),
    ])
    .find((value) => value.endsWith("算出基礎"));
  if (!label || label === "算出基礎") return null;
  const model = canonicalModel(label.replace(/算出基礎$/, ""));
  return supportedModels.includes(model as (typeof supportedModels)[number])
    ? model
    : null;
};

const extractCoefficients = (
  sheet: LegacyPredictionSheet,
  metric: PredictionMetric,
  dataVersion: string,
  generatedAt: string,
): PredictionCoefficientMaster[] => {
  const coefficients: PredictionCoefficientMaster[] = [];
  for (let row = 0; row < sheet.grid.length; row += 1) {
    for (
      let column = 0;
      column < (sheet.grid[row]?.length ?? 0);
      column += 1
    ) {
      if (
        text(sheet.grid[row][column]) !== "倍数" ||
        text(sheet.grid[row][column + 1]) !== "逆算"
      ) {
        continue;
      }
      const predictionModel = findModelLabel(sheet, row, column);
      if (!predictionModel) continue;

      for (
        let dataRow = row + 1;
        dataRow < sheet.grid.length;
        dataRow += 1
      ) {
        const dateCell = sheet.grid[dataRow]?.[column - 1];
        const coefficientCell = sheet.grid[dataRow]?.[column];
        if (!text(dateCell) && number(dateCell) === null) break;
        const coefficient = number(coefficientCell);
        if (coefficient === null) continue;
        coefficients.push({
          metric,
          predictionModel,
          monthDay: toMonthDay(number(dateCell) ?? text(dateCell)),
          coefficient,
          sourceSheet: sheet.title,
          sourceCell: `'${sheet.title}'!${columnName(column)}${dataRow + 1}`,
          dataVersion,
          generatedAt,
        });
      }
    }
  }
  return coefficients;
};

export const extractLegacyPredictionSheet = (
  sheet: LegacyPredictionSheet,
  dataVersion: string,
  generatedAt: string,
): {
  models: PredictionModelMaster[];
  coefficients: PredictionCoefficientMaster[];
} => {
  const metric = metricBySheet[sheet.title];
  if (!metric) throw new Error(`対象外の旧予測シートです: ${sheet.title}`);
  return {
    models: extractModels(sheet, dataVersion, generatedAt),
    coefficients: extractCoefficients(
      sheet,
      metric,
      dataVersion,
      generatedAt,
    ),
  };
};

export const extractPredictionMasters = (
  sheets: readonly LegacyPredictionSheet[],
  dataVersion: string,
  generatedAt: string,
): {
  models: PredictionModelMaster[];
  coefficients: PredictionCoefficientMaster[];
} =>
  sheets.reduce(
    (bundle, sheet) => {
      const extracted = extractLegacyPredictionSheet(
        sheet,
        dataVersion,
        generatedAt,
      );
      bundle.models.push(...extracted.models);
      bundle.coefficients.push(...extracted.coefficients);
      return bundle;
    },
    {
      models: [] as PredictionModelMaster[],
      coefficients: [] as PredictionCoefficientMaster[],
    },
  );
