import {
  predictionCoefficientSheetTitle,
  predictionMasterSpreadsheetTitle,
  predictionModelSheetTitle,
} from "../../features/prediction-data/prediction-master-contract";
import {
  decodePredictionMasterSheets,
  type PredictionMasterCellValue,
  type PredictionMasterSheetData,
} from "../../features/prediction-data/prediction-master-sheet-decoder";
import type { PredictionMasterBundle } from "../../features/prediction-data/prediction-master.types";
import { fetchGoogleAccessToken, isRecord } from "../google-sheets/google-sheets-auth";

export const predictionMasterRepositoryScope =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

type FetchImplementation = typeof fetch;
type EffectiveValue = {
  stringValue?: string;
  numberValue?: number;
  boolValue?: boolean;
};
type SpreadsheetResponse = {
  spreadsheetId?: string;
  properties?: { title?: string };
  sheets?: {
    properties?: { title?: string };
    data?: { rowData?: { values?: { effectiveValue?: EffectiveValue }[] }[] }[];
  }[];
};

export type PredictionMasterRepositoryErrorCode =
  | "AUTHENTICATION_FAILED"
  | "ACCESS_DENIED"
  | "SPREADSHEET_FETCH_FAILED"
  | "TARGET_MISMATCH"
  | "TITLE_MISMATCH";

export class PredictionMasterRepositoryError extends Error {
  constructor(
    public readonly code: PredictionMasterRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PredictionMasterRepositoryError";
  }
}

export type PredictionMasterRepository = {
  read(input: {
    spreadsheetId: string;
    expectedDataVersion: string;
  }): Promise<PredictionMasterBundle>;
};

const accessToken = async (fetchImpl: FetchImplementation): Promise<string> => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  if (!email || !privateKey) {
    throw new PredictionMasterRepositoryError(
      "AUTHENTICATION_FAILED",
      "Prediction Master読取認証が設定されていません。",
    );
  }
  try {
    return await fetchGoogleAccessToken(
      fetchImpl,
      { email, privateKey, scope: predictionMasterRepositoryScope },
      "Prediction Master読取認証",
    );
  } catch (error) {
    throw new PredictionMasterRepositoryError(
      "AUTHENTICATION_FAILED",
      error instanceof Error ? error.message : "Prediction Master読取認証に失敗しました。",
    );
  }
};

const cellValue = (
  value: EffectiveValue | undefined,
): PredictionMasterCellValue => {
  if (value?.boolValue !== undefined) return value.boolValue;
  if (value?.numberValue !== undefined) return value.numberValue;
  return value?.stringValue;
};

const toSheet = (
  sheet: NonNullable<SpreadsheetResponse["sheets"]>[number],
): PredictionMasterSheetData => ({
  title: sheet.properties?.title ?? "",
  values: (sheet.data?.[0]?.rowData ?? []).map((row) =>
    (row.values ?? []).map((value) => cellValue(value.effectiveValue)),
  ),
});

export const createGoogleSheetsPredictionMasterRepository = (
  fetchImpl: FetchImplementation = fetch,
): PredictionMasterRepository => ({
  async read({ spreadsheetId, expectedDataVersion }) {
    if (!spreadsheetId) {
      throw new PredictionMasterRepositoryError(
        "TARGET_MISMATCH",
        "Prediction Master targetが設定されていません。",
      );
    }
    const token = await accessToken(fetchImpl);
    const url = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    );
    url.searchParams.append("ranges", `'${predictionModelSheetTitle}'!A:H`);
    url.searchParams.append(
      "ranges",
      `'${predictionCoefficientSheetTitle}'!A:H`,
    );
    url.searchParams.set("includeGridData", "true");
    url.searchParams.set(
      "fields",
      "spreadsheetId,properties(title),sheets(properties(title),data(rowData(values(effectiveValue))))",
    );
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch {
      throw new PredictionMasterRepositoryError(
        "SPREADSHEET_FETCH_FAILED",
        "Prediction Master取得通信に失敗しました。",
      );
    }
    if (!response.ok) {
      const code = response.status === 403 ? "ACCESS_DENIED" : "SPREADSHEET_FETCH_FAILED";
      throw new PredictionMasterRepositoryError(
        code,
        `Prediction Master取得に失敗しました: HTTP ${response.status}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new PredictionMasterRepositoryError(
        "SPREADSHEET_FETCH_FAILED",
        "Prediction Master Spreadsheet応答の解析に失敗しました。",
      );
    }
    if (!isRecord(parsed)) {
      throw new PredictionMasterRepositoryError(
        "SPREADSHEET_FETCH_FAILED",
        "Prediction Master Spreadsheet応答の形式が不正です。",
      );
    }
    const json = parsed as SpreadsheetResponse;
    if (json.spreadsheetId !== spreadsheetId) {
      throw new PredictionMasterRepositoryError(
        "TARGET_MISMATCH",
        "取得したSpreadsheetが要求targetと一致しません。",
      );
    }
    if (json.properties?.title !== predictionMasterSpreadsheetTitle) {
      throw new PredictionMasterRepositoryError(
        "TITLE_MISMATCH",
        "Prediction MasterのSpreadsheetタイトルが一致しません。",
      );
    }
    return decodePredictionMasterSheets(
      (json.sheets ?? []).map(toSheet),
      expectedDataVersion,
    );
  },
});
