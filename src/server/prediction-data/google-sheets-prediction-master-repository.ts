import { createSign } from "node:crypto";
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const base64url = (value: string | Buffer): string =>
  Buffer.from(value).toString("base64url");

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
  let assertion: string;
  try {
    const now = Math.floor(Date.now() / 1000);
    const unsigned = [
      base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
      base64url(
        JSON.stringify({
          iss: email,
          scope: predictionMasterRepositoryScope,
          aud: "https://oauth2.googleapis.com/token",
          iat: now,
          exp: now + 3600,
        }),
      ),
    ].join(".");
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    assertion = `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
  } catch {
    throw new PredictionMasterRepositoryError(
      "AUTHENTICATION_FAILED",
      "Prediction Master読取認証の署名準備に失敗しました。",
    );
  }
  let response: Response;
  try {
    response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
  } catch {
    throw new PredictionMasterRepositoryError(
      "AUTHENTICATION_FAILED",
      "Prediction Master読取認証通信に失敗しました。",
    );
  }
  if (!response.ok) {
    throw new PredictionMasterRepositoryError(
      "AUTHENTICATION_FAILED",
      `Prediction Master読取認証に失敗しました: HTTP ${response.status}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new PredictionMasterRepositoryError(
      "AUTHENTICATION_FAILED",
      "Prediction Master読取認証応答の解析に失敗しました。",
    );
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.access_token !== "string" ||
    parsed.access_token.trim() === ""
  ) {
    throw new PredictionMasterRepositoryError(
      "AUTHENTICATION_FAILED",
      "Prediction Master読取認証応答が不正です。",
    );
  }
  return parsed.access_token;
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
