import { buildPredictionResults } from "../src/features/prediction-integration/prediction-integration";
import { verifyPredictionRegressions } from "../src/features/prediction-data/prediction-master-regression";
import { createAuthenticatedAnalysisDataRepository } from "../src/server/analysis-data/authenticated-analysis-data-repository";
import { createGoogleSheetsPredictionMasterRepository } from "../src/server/prediction-data/google-sheets-prediction-master-repository";

const argumentValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const main = async (): Promise<void> => {
  delete process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL;
  delete process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY;

  const expectedDataVersion = argumentValue("--data-version");
  const spreadsheetId = process.env.PREDICTION_MASTER_SPREADSHEET_ID;
  if (!expectedDataVersion || !spreadsheetId) {
    throw new Error("--data-versionまたはPrediction Master target設定が不足しています。");
  }

  const inputRepository = createAuthenticatedAnalysisDataRepository();
  const masterRepository = createGoogleSheetsPredictionMasterRepository();
  const [records, bundle] = await Promise.all([
    inputRepository.getAll(),
    masterRepository.read({ spreadsheetId, expectedDataVersion }),
  ]);
  const result = buildPredictionResults(records, bundle, expectedDataVersion);
  const regressions = verifyPredictionRegressions(bundle);

  console.log(JSON.stringify({
    summary: result.summary,
    regressions: regressions.map((item) => ({
      metric: item.metric,
      predictionModel: item.predictionModel,
      actual: item.displayedPrediction,
    })),
    spreadsheetWrites: 0,
    writerCredentialsReferenced: 0,
  }, null, 2));
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Prediction MVP検証に失敗しました。");
  process.exitCode = 1;
});
