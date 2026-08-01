import {
  predictionCoefficientHeaders,
  predictionCoefficientSheetTitle,
  predictionModelHeaders,
  predictionModelOrder,
  predictionModelSheetTitle,
  sortPredictionMasterBundle,
} from "./prediction-master-contract";
import type {
  PredictionCoefficientMaster,
  PredictionMasterBundle,
  PredictionMetric,
  PredictionModelMaster,
} from "./prediction-master.types";
import { validatePredictionMasters } from "./prediction-master-validator";

export type PredictionMasterCellValue = string | number | boolean | undefined;

export type PredictionMasterSheetData = {
  title: string;
  values: readonly (readonly PredictionMasterCellValue[])[];
};

export type PredictionMasterDecodeErrorCode =
  | "SHEET_MISSING"
  | "HEADER_MISMATCH"
  | "EMPTY_ROW"
  | "MISSING_CELL"
  | "INVALID_CELL_TYPE"
  | "INVALID_CELL_VALUE"
  | "ORDER_MISMATCH"
  | "INVALID_BUNDLE";

export class PredictionMasterDecodeError extends Error {
  constructor(
    public readonly code: PredictionMasterDecodeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PredictionMasterDecodeError";
  }
}

const isEmpty = (value: PredictionMasterCellValue): boolean =>
  value === undefined || value === "";

const isEmptyRow = (row: readonly PredictionMasterCellValue[]): boolean =>
  row.every(isEmpty);

const normalizedRows = (
  sheet: PredictionMasterSheetData,
): readonly (readonly PredictionMasterCellValue[])[] => {
  let end = sheet.values.length;
  while (end > 0 && isEmptyRow(sheet.values[end - 1])) end -= 1;
  return sheet.values.slice(0, end);
};

const headerIndexes = (
  sheet: PredictionMasterSheetData,
  expected: readonly string[],
): Map<string, number> => {
  const header = sheet.values[0] ?? [];
  if (
    header.length !== expected.length ||
    header.some((value) => typeof value !== "string") ||
    new Set(header).size !== header.length ||
    expected.some((value, index) => header[index] !== value)
  ) {
    throw new PredictionMasterDecodeError(
      "HEADER_MISMATCH",
      `正式見出しと一致しません: ${sheet.title}`,
    );
  }
  return new Map(header.map((value, index) => [value as string, index]));
};

const cell = (
  row: readonly PredictionMasterCellValue[],
  indexes: ReadonlyMap<string, number>,
  header: string,
): PredictionMasterCellValue => row[indexes.get(header) ?? -1];

const stringCell = (
  row: readonly PredictionMasterCellValue[],
  indexes: ReadonlyMap<string, number>,
  header: string,
  sheetTitle: string,
  rowNumber: number,
  allowEmpty = false,
): string => {
  const value = cell(row, indexes, header);
  if (value === undefined || (!allowEmpty && value === "")) {
    throw new PredictionMasterDecodeError(
      "MISSING_CELL",
      `必須セルが欠測しています: ${sheetTitle}/${rowNumber}/${header}`,
    );
  }
  if (typeof value !== "string") {
    throw new PredictionMasterDecodeError(
      "INVALID_CELL_TYPE",
      `セル型が文字列ではありません: ${sheetTitle}/${rowNumber}/${header}`,
    );
  }
  return value;
};

const booleanCell = (
  row: readonly PredictionMasterCellValue[],
  indexes: ReadonlyMap<string, number>,
  header: string,
  sheetTitle: string,
  rowNumber: number,
): true => {
  const value = cell(row, indexes, header);
  if (value === undefined || value === "") {
    throw new PredictionMasterDecodeError(
      "MISSING_CELL",
      `必須セルが欠測しています: ${sheetTitle}/${rowNumber}/${header}`,
    );
  }
  if (typeof value !== "boolean") {
    throw new PredictionMasterDecodeError(
      "INVALID_CELL_TYPE",
      `セル型が真偽値ではありません: ${sheetTitle}/${rowNumber}/${header}`,
    );
  }
  if (value !== true) {
    throw new PredictionMasterDecodeError(
      "INVALID_CELL_VALUE",
      `有効モデルではありません: ${sheetTitle}/${rowNumber}/${header}`,
    );
  }
  return true;
};

const numberCell = (
  row: readonly PredictionMasterCellValue[],
  indexes: ReadonlyMap<string, number>,
  header: string,
  sheetTitle: string,
  rowNumber: number,
): number => {
  const value = cell(row, indexes, header);
  if (value === undefined || value === "") {
    throw new PredictionMasterDecodeError(
      "MISSING_CELL",
      `必須セルが欠測しています: ${sheetTitle}/${rowNumber}/${header}`,
    );
  }
  if (typeof value !== "number") {
    throw new PredictionMasterDecodeError(
      "INVALID_CELL_TYPE",
      `セル型が数値ではありません: ${sheetTitle}/${rowNumber}/${header}`,
    );
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new PredictionMasterDecodeError(
      "INVALID_CELL_VALUE",
      `係数が有限の正数ではありません: ${sheetTitle}/${rowNumber}/${header}`,
    );
  }
  return value;
};

const dataRows = (
  sheet: PredictionMasterSheetData,
): readonly (readonly PredictionMasterCellValue[])[] => {
  const rows = normalizedRows(sheet).slice(1);
  rows.forEach((row, index) => {
    if (isEmptyRow(row)) {
      throw new PredictionMasterDecodeError(
        "EMPTY_ROW",
        `データ途中に空行があります: ${sheet.title}/${index + 2}`,
      );
    }
  });
  return rows;
};

const findSheet = (
  sheets: readonly PredictionMasterSheetData[],
  title: string,
): PredictionMasterSheetData => {
  const matches = sheets.filter((sheet) => sheet.title === title);
  if (matches.length !== 1) {
    throw new PredictionMasterDecodeError(
      "SHEET_MISSING",
      `正式シートを一意に取得できません: ${title}`,
    );
  }
  return matches[0];
};

const decodeModels = (
  sheet: PredictionMasterSheetData,
): PredictionModelMaster[] => {
  const indexes = headerIndexes(sheet, predictionModelHeaders);
  return dataRows(sheet).map((row, index) => {
    const rowNumber = index + 2;
    return {
      displayCategory: stringCell(row, indexes, "表示カテゴリー", sheet.title, rowNumber),
      predictionModel: stringCell(row, indexes, "予測モデル", sheet.title, rowNumber),
      targetMonthDay: stringCell(row, indexes, "収穫目標月日", sheet.title, rowNumber),
      active: booleanCell(row, indexes, "有効", sheet.title, rowNumber),
      selectionCriteria: stringCell(row, indexes, "選抜基準", sheet.title, rowNumber, true),
      sourceYears: stringCell(row, indexes, "引用年次", sheet.title, rowNumber, true),
      dataVersion: stringCell(row, indexes, "データ版", sheet.title, rowNumber),
      generatedAt: stringCell(row, indexes, "生成日時", sheet.title, rowNumber),
    };
  });
};

const decodeCoefficients = (
  sheet: PredictionMasterSheetData,
): PredictionCoefficientMaster[] => {
  const indexes = headerIndexes(sheet, predictionCoefficientHeaders);
  return dataRows(sheet).map((row, index) => {
    const rowNumber = index + 2;
    return {
      metric: stringCell(row, indexes, "指標", sheet.title, rowNumber) as PredictionMetric,
      predictionModel: stringCell(row, indexes, "予測モデル", sheet.title, rowNumber),
      monthDay: stringCell(row, indexes, "月日", sheet.title, rowNumber),
      coefficient: numberCell(row, indexes, "推移係数", sheet.title, rowNumber),
      sourceSheet: stringCell(row, indexes, "原典シート", sheet.title, rowNumber),
      sourceCell: stringCell(row, indexes, "原典セル", sheet.title, rowNumber),
      dataVersion: stringCell(row, indexes, "データ版", sheet.title, rowNumber),
      generatedAt: stringCell(row, indexes, "生成日時", sheet.title, rowNumber),
    };
  });
};

const assertCanonicalOrder = (bundle: PredictionMasterBundle): void => {
  const sorted = sortPredictionMasterBundle(bundle);
  if (
    bundle.models.some(
      (model, index) => model.predictionModel !== sorted.models[index]?.predictionModel,
    ) ||
    bundle.coefficients.some((item, index) => {
      const expected = sorted.coefficients[index];
      return (
        !expected ||
        item.metric !== expected.metric ||
        item.predictionModel !== expected.predictionModel ||
        item.monthDay !== expected.monthDay
      );
    })
  ) {
    throw new PredictionMasterDecodeError(
      "ORDER_MISMATCH",
      `正式な行順ではありません: ${predictionModelOrder.length}モデル契約`,
    );
  }
};

export const decodePredictionMasterSheets = (
  sheets: readonly PredictionMasterSheetData[],
  expectedDataVersion: string,
): PredictionMasterBundle => {
  const bundle: PredictionMasterBundle = {
    models: decodeModels(findSheet(sheets, predictionModelSheetTitle)),
    coefficients: decodeCoefficients(
      findSheet(sheets, predictionCoefficientSheetTitle),
    ),
  };
  try {
    validatePredictionMasters(bundle, expectedDataVersion);
  } catch {
    throw new PredictionMasterDecodeError(
      "INVALID_BUNDLE",
      "Prediction Master契約検証に失敗しました。",
    );
  }
  assertCanonicalOrder(bundle);
  return bundle;
};
