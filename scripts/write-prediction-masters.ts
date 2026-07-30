import { generatePredictionMasters } from "../src/features/prediction-data/prediction-master-generator";
import {
  runPredictionMasterWrite,
  type PredictionMasterTargetConfig,
} from "../src/features/prediction-data/prediction-master-writer";
import { readLegacyPredictionSheets } from "./lib/google-sheets-reader";
import { createGoogleSheetsWriterProvider } from "./lib/google-sheets-writer";

const sourceSheetTitles = ["横径予測", "糖度予測", "酸度予測"] as const;
const defaultInputSpreadsheetId =
  "1Ix7qFigeUvmxkEl3C51rmzuBzYDq7OR_ZGHq6GUKa0g";

const requiredArgument = (name: string): string => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`${name}は必須です。`);
  }
  return value;
};

const maskedId = (value: string): string =>
  value.length <= 4 ? "****" : `****${value.slice(-4)}`;

const main = async (): Promise<void> => {
  const mode = process.argv[2];
  if (mode !== "dry-run" && mode !== "write") {
    throw new Error(`未対応のWriterモードです: ${mode ?? "(未指定)"}`);
  }
  const dataVersion = requiredArgument("--data-version");
  const execute = mode === "write" && process.argv.includes("--execute");
  const sourceSpreadsheetId = process.env.PREDICTION_SPREADSHEET_ID ?? "";
  if (!sourceSpreadsheetId) {
    throw new Error("PREDICTION_SPREADSHEET_IDが未設定です。");
  }
  const config: PredictionMasterTargetConfig = {
    targetSpreadsheetId: process.env.PREDICTION_MASTER_SPREADSHEET_ID ?? "",
    inputSpreadsheetId:
      process.env.ANALYSIS_DATA_SPREADSHEET_ID ?? defaultInputSpreadsheetId,
    sourceSpreadsheetId,
  };
  if (!config.targetSpreadsheetId) {
    throw new Error("PREDICTION_MASTER_SPREADSHEET_IDが未設定です。");
  }

  const generatedAt =
    new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
      .replace(" ", "T") + "+09:00";
  const source = await readLegacyPredictionSheets(
    sourceSpreadsheetId,
    sourceSheetTitles,
  );
  const bundle = generatePredictionMasters(source, dataVersion, generatedAt);
  const result = await runPredictionMasterWrite(
    bundle,
    dataVersion,
    config,
    createGoogleSheetsWriterProvider(),
    execute,
  );
  console.log(
    [
      `Writer target: ${maskedId(config.targetSpreadsheetId)}`,
      `モード: ${execute ? "execute" : "dry-run"}`,
      `更新方式: ${result.mode}`,
      `モデル行数: ${result.serialized.models.values.length - 1}`,
      `係数行数: ${result.serialized.coefficients.values.length - 1}`,
      result.status === "confirmed-after-unknown"
        ? "適用状態: 適用済み・再確認成功"
        : execute
          ? "書込み後再読込検証: 成功"
          : "書込み: なし",
    ].join("\n"),
  );
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "不明なエラー";
  console.error(`Writer失敗: ${message}`);
  process.exitCode = 1;
});
