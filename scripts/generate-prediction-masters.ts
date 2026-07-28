import { generatePredictionMasters } from "../src/features/prediction-data/prediction-master-generator";
import {
  formatPredictionDryRun,
  formatPredictionSummary,
} from "../src/features/prediction-data/prediction-master-report";
import { verifyPredictionRegressions } from "../src/features/prediction-data/prediction-master-regression";
import { readLegacyPredictionSheets } from "./lib/google-sheets-reader";

const sheetTitles = ["横径予測", "糖度予測", "酸度予測"] as const;

const argumentValue = (name: string, fallback: string): string => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const main = async (): Promise<void> => {
  const mode = process.argv[2];
  if (mode !== "summary" && mode !== "dry-run") {
    throw new Error(`未対応の実行モードです: ${mode ?? "(未指定)"}`);
  }
  const spreadsheetId = process.env.PREDICTION_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("PREDICTION_SPREADSHEET_IDが未設定です。");

  const dataVersion = argumentValue("--data-version", "1.0.0");
  const generatedAt =
    new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
      .replace(" ", "T") + "+09:00";
  const source = await readLegacyPredictionSheets(spreadsheetId, sheetTitles);
  const bundle = generatePredictionMasters(source, dataVersion, generatedAt);

  if (mode === "summary") {
    console.log(formatPredictionSummary(bundle, dataVersion));
    return;
  }
  const regressions = verifyPredictionRegressions(bundle);
  console.log(formatPredictionDryRun(bundle, dataVersion, regressions));
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "不明なエラー";
  console.error(`検証失敗: ${message}`);
  process.exitCode = 1;
});
