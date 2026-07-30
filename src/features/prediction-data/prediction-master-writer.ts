import { sortPredictionMasterBundle } from "./prediction-master-contract";
import { validatePredictionMasters } from "./prediction-master-validator";
import type { PredictionMasterBundle } from "./prediction-master.types";

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

export type MasterCellValue = string | number | boolean;
export type SerializedMasterSheet = {
  title: string;
  values: MasterCellValue[][];
};
export type SerializedPredictionMasters = {
  models: SerializedMasterSheet;
  coefficients: SerializedMasterSheet;
};
export type MasterSheetMetadata = {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
  headers?: MasterCellValue[];
};
export type PredictionMasterSpreadsheetMetadata = {
  spreadsheetId: string;
  title: string;
  sheets: MasterSheetMetadata[];
};
export type PredictionMasterTargetConfig = {
  targetSpreadsheetId: string;
  inputSpreadsheetId: string;
  sourceSpreadsheetId: string;
};
export type GoogleExtendedValue =
  { stringValue: string } | { numberValue: number } | { boolValue: boolean };
export type GoogleCellData = {
  userEnteredValue: GoogleExtendedValue | null;
};
export type GoogleRowData = { values: GoogleCellData[] };
export type GoogleSheetsBatchRequest =
  | {
      addSheet: {
        properties: {
          sheetId: number;
          title: string;
          gridProperties: { rowCount: number; columnCount: number };
        };
      };
    }
  | {
      updateCells: {
        rows: GoogleRowData[];
        fields: "userEnteredValue";
        start?: { sheetId: number; rowIndex: 0; columnIndex: 0 };
        range?: {
          sheetId: number;
          startRowIndex: 0;
          endRowIndex: number;
          startColumnIndex: 0;
          endColumnIndex: number;
        };
      };
    };
export type PredictionMasterBatchUpdate = {
  requests: GoogleSheetsBatchRequest[];
};
export type PredictionMasterWriteProvider = {
  getMetadata: (
    spreadsheetId: string,
  ) => Promise<PredictionMasterSpreadsheetMetadata>;
  batchUpdate: (
    spreadsheetId: string,
    request: PredictionMasterBatchUpdate,
  ) => Promise<void>;
  readMasterSheets: (
    spreadsheetId: string,
  ) => Promise<SerializedPredictionMasters>;
};
export type PredictionMasterWritePlan = {
  mode: "create" | "update";
  serialized: SerializedPredictionMasters;
  batch: PredictionMasterBatchUpdate;
};
export type PredictionMasterWriteResult = PredictionMasterWritePlan & {
  status: "dry-run" | "confirmed" | "confirmed-after-unknown";
};

export class PredictionMasterBatchStateUnknownError extends Error {
  constructor() {
    super("batch送信後に応答を確認できず、適用状態が不明です。");
    this.name = "PredictionMasterBatchStateUnknownError";
  }
}

export class PredictionMasterWriteStateUnknownError extends Error {
  constructor() {
    super(
      "batch送信後の適用状態が不明です。自動再送せず、手動確認が必要です。",
    );
    this.name = "PredictionMasterWriteStateUnknownError";
  }
}

const forbiddenSheetTitles = new Set([
  "調査データ",
  "横径予測",
  "糖度予測",
  "酸度予測",
]);

export const serializePredictionMasters = (
  bundle: PredictionMasterBundle,
  dataVersion: string,
): SerializedPredictionMasters => {
  validatePredictionMasters(bundle, dataVersion);
  const sorted = sortPredictionMasterBundle(bundle);
  return {
    models: {
      title: predictionModelSheetTitle,
      values: [
        [...predictionModelHeaders],
        ...sorted.models.map((model) => [
          model.displayCategory,
          model.predictionModel,
          model.targetMonthDay,
          model.active,
          model.selectionCriteria,
          model.sourceYears,
          model.dataVersion,
          model.generatedAt,
        ]),
      ],
    },
    coefficients: {
      title: predictionCoefficientSheetTitle,
      values: [
        [...predictionCoefficientHeaders],
        ...sorted.coefficients.map((coefficient) => [
          coefficient.metric,
          coefficient.predictionModel,
          coefficient.monthDay,
          coefficient.coefficient,
          coefficient.sourceSheet,
          coefficient.sourceCell,
          coefficient.dataVersion,
          coefficient.generatedAt,
        ]),
      ],
    },
  };
};

const assertHeaders = (
  sheet: MasterSheetMetadata,
  expected: readonly string[],
): void => {
  if (
    !sheet.headers ||
    sheet.headers.length !== expected.length ||
    expected.some((header, index) => sheet.headers?.[index] !== header)
  ) {
    throw new Error(`既存見出しが正式契約と一致しません: ${sheet.title}`);
  }
};

export const guardPredictionMasterTarget = (
  config: PredictionMasterTargetConfig,
  metadata: PredictionMasterSpreadsheetMetadata,
): "create" | "update" => {
  if (!config.targetSpreadsheetId) {
    throw new Error("PREDICTION_MASTER_SPREADSHEET_IDが未設定です。");
  }
  if (!config.inputSpreadsheetId || !config.sourceSpreadsheetId) {
    throw new Error("比較対象Spreadsheet IDが設定されていません。");
  }
  if (config.targetSpreadsheetId === config.inputSpreadsheetId) {
    throw new Error("Input正本SpreadsheetをWriter targetに指定できません。");
  }
  if (config.targetSpreadsheetId === config.sourceSpreadsheetId) {
    throw new Error("予測原典SpreadsheetをWriter targetに指定できません。");
  }
  if (metadata.spreadsheetId !== config.targetSpreadsheetId) {
    throw new Error("取得したSpreadsheetがWriter targetと一致しません。");
  }
  if (metadata.title !== predictionMasterSpreadsheetTitle) {
    throw new Error("Writer targetのSpreadsheetタイトルが一致しません。");
  }
  const forbidden = metadata.sheets.find((sheet) =>
    forbiddenSheetTitles.has(sheet.title),
  );
  if (forbidden) {
    throw new Error(`Writer targetに禁止シートがあります: ${forbidden.title}`);
  }

  const modelSheet = metadata.sheets.find(
    (sheet) => sheet.title === predictionModelSheetTitle,
  );
  const coefficientSheet = metadata.sheets.find(
    (sheet) => sheet.title === predictionCoefficientSheetTitle,
  );
  if (Boolean(modelSheet) !== Boolean(coefficientSheet)) {
    throw new Error("正式マスタ2シートの片方だけが存在します。");
  }
  if (!modelSheet || !coefficientSheet) return "create";
  assertHeaders(modelSheet, predictionModelHeaders);
  assertHeaders(coefficientSheet, predictionCoefficientHeaders);
  return "update";
};

const extendedValue = (value: MasterCellValue): GoogleExtendedValue => {
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "number") return { numberValue: value };
  return { stringValue: value };
};

const rows = (
  values: readonly MasterCellValue[][],
  rowCount = values.length,
): GoogleRowData[] =>
  Array.from({ length: rowCount }, (_, rowIndex) => ({
    values: Array.from({ length: 8 }, (__, columnIndex) => ({
      userEnteredValue:
        rowIndex < values.length
          ? extendedValue(values[rowIndex][columnIndex])
          : null,
    })),
  }));

const allocateSheetIds = (
  sheets: readonly MasterSheetMetadata[],
): [number, number] => {
  const used = new Set(sheets.map((sheet) => sheet.sheetId));
  const allocated: number[] = [];
  for (let candidate = 1; allocated.length < 2; candidate += 1) {
    if (!used.has(candidate)) allocated.push(candidate);
  }
  return [allocated[0], allocated[1]];
};

export const buildPredictionMasterBatch = (
  serialized: SerializedPredictionMasters,
  metadata: PredictionMasterSpreadsheetMetadata,
  mode: "create" | "update",
): PredictionMasterBatchUpdate => {
  if (mode === "create") {
    const [modelSheetId, coefficientSheetId] = allocateSheetIds(
      metadata.sheets,
    );
    return {
      requests: [
        {
          addSheet: {
            properties: {
              sheetId: modelSheetId,
              title: predictionModelSheetTitle,
              gridProperties: {
                rowCount: serialized.models.values.length,
                columnCount: 8,
              },
            },
          },
        },
        {
          updateCells: {
            start: { sheetId: modelSheetId, rowIndex: 0, columnIndex: 0 },
            rows: rows(serialized.models.values),
            fields: "userEnteredValue",
          },
        },
        {
          addSheet: {
            properties: {
              sheetId: coefficientSheetId,
              title: predictionCoefficientSheetTitle,
              gridProperties: {
                rowCount: serialized.coefficients.values.length,
                columnCount: 8,
              },
            },
          },
        },
        {
          updateCells: {
            start: {
              sheetId: coefficientSheetId,
              rowIndex: 0,
              columnIndex: 0,
            },
            rows: rows(serialized.coefficients.values),
            fields: "userEnteredValue",
          },
        },
      ],
    };
  }

  const modelSheet = metadata.sheets.find(
    (sheet) => sheet.title === predictionModelSheetTitle,
  );
  const coefficientSheet = metadata.sheets.find(
    (sheet) => sheet.title === predictionCoefficientSheetTitle,
  );
  if (!modelSheet || !coefficientSheet) {
    throw new Error("更新対象の正式マスタ2シートがありません。");
  }
  const updateRequest = (
    sheet: MasterSheetMetadata,
    values: MasterCellValue[][],
  ): GoogleSheetsBatchRequest => {
    const rowCount = Math.max(sheet.rowCount, values.length);
    return {
      updateCells: {
        range: {
          sheetId: sheet.sheetId,
          startRowIndex: 0,
          endRowIndex: rowCount,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        rows: rows(values, rowCount),
        fields: "userEnteredValue",
      },
    };
  };
  return {
    requests: [
      updateRequest(modelSheet, serialized.models.values),
      updateRequest(coefficientSheet, serialized.coefficients.values),
    ],
  };
};

const rowKey = (sheet: SerializedMasterSheet, rowIndex: number): string => {
  if (rowIndex === 0) return "見出し";
  const row = sheet.values[rowIndex] ?? [];
  return sheet.title === predictionModelSheetTitle
    ? String(row[1] ?? "")
    : `${String(row[0] ?? "")}/${String(row[1] ?? "")}/${String(row[2] ?? "")}`;
};

const compareSheet = (
  expected: SerializedMasterSheet,
  actual: SerializedMasterSheet,
): void => {
  if (actual.title !== expected.title) {
    throw new Error(`再読込シート名が一致しません: ${expected.title}`);
  }
  if (actual.values.length !== expected.values.length) {
    throw new Error(`再読込行数が一致しません: ${expected.title}`);
  }
  for (let rowIndex = 0; rowIndex < expected.values.length; rowIndex += 1) {
    const expectedRow = expected.values[rowIndex];
    const actualRow = actual.values[rowIndex] ?? [];
    if (actualRow.length !== expectedRow.length) {
      throw new Error(
        `再読込列数が一致しません: ${expected.title}/${rowIndex + 1}/${rowKey(expected, rowIndex)}`,
      );
    }
    for (
      let columnIndex = 0;
      columnIndex < expectedRow.length;
      columnIndex += 1
    ) {
      const expectedValue = expectedRow[columnIndex];
      const actualValue = actualRow[columnIndex];
      if (
        typeof actualValue !== typeof expectedValue ||
        actualValue !== expectedValue
      ) {
        throw new Error(
          `再読込値が一致しません: ${expected.title}/${rowIndex + 1}/${columnIndex + 1}/${rowKey(expected, rowIndex)}`,
        );
      }
    }
  }
};

export const verifyPredictionMasterReadback = (
  expected: SerializedPredictionMasters,
  actual: SerializedPredictionMasters,
): void => {
  compareSheet(expected.models, actual.models);
  compareSheet(expected.coefficients, actual.coefficients);
};

export const planPredictionMasterWrite = async (
  bundle: PredictionMasterBundle,
  dataVersion: string,
  config: PredictionMasterTargetConfig,
  provider: Pick<PredictionMasterWriteProvider, "getMetadata">,
): Promise<PredictionMasterWritePlan> => {
  const serialized = serializePredictionMasters(bundle, dataVersion);
  if (!config.targetSpreadsheetId) {
    throw new Error("PREDICTION_MASTER_SPREADSHEET_IDが未設定です。");
  }
  const metadata = await provider.getMetadata(config.targetSpreadsheetId);
  const mode = guardPredictionMasterTarget(config, metadata);
  return {
    mode,
    serialized,
    batch: buildPredictionMasterBatch(serialized, metadata, mode),
  };
};

export const runPredictionMasterWrite = async (
  bundle: PredictionMasterBundle,
  dataVersion: string,
  config: PredictionMasterTargetConfig,
  provider: PredictionMasterWriteProvider,
  execute: boolean,
): Promise<PredictionMasterWriteResult> => {
  const plan = await planPredictionMasterWrite(
    bundle,
    dataVersion,
    config,
    provider,
  );
  if (!execute) return { ...plan, status: "dry-run" };
  try {
    await provider.batchUpdate(config.targetSpreadsheetId, plan.batch);
  } catch (error) {
    if (!(error instanceof PredictionMasterBatchStateUnknownError)) {
      throw error;
    }
    try {
      const actual = await provider.readMasterSheets(
        config.targetSpreadsheetId,
      );
      verifyPredictionMasterReadback(plan.serialized, actual);
      return { ...plan, status: "confirmed-after-unknown" };
    } catch {
      throw new PredictionMasterWriteStateUnknownError();
    }
  }
  const actual = await provider.readMasterSheets(config.targetSpreadsheetId);
  verifyPredictionMasterReadback(plan.serialized, actual);
  return { ...plan, status: "confirmed" };
};
