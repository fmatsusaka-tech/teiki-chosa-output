import { createSign } from "node:crypto";
import type { AnalysisDataTableSource } from "../../repositories/analysis-data-repository";

export const analysisDataSpreadsheetTitle = "定期調査データバンク";
export const analysisDataSheetTitle = "調査データ";
export const analysisDataReaderScope =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

type FetchImplementation = typeof fetch;

export type AnalysisDataSourceErrorCode =
  | "CONFIGURATION_ERROR"
  | "AUTHENTICATION_FAILED"
  | "ACCESS_DENIED"
  | "FETCH_FAILED"
  | "TARGET_MISMATCH"
  | "TITLE_MISMATCH"
  | "SHEET_MISSING"
  | "INVALID_RESPONSE";

export class AnalysisDataSourceError extends Error {
  constructor(
    public readonly code: AnalysisDataSourceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AnalysisDataSourceError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const base64url = (value: string | Buffer): string =>
  Buffer.from(value).toString("base64url");

const readerConfiguration = (): {
  email: string;
  privateKey: string;
  spreadsheetId: string;
} => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  const spreadsheetId = process.env.ANALYSIS_DATA_SPREADSHEET_ID;
  if (!email || !privateKey || !spreadsheetId) {
    throw new AnalysisDataSourceError(
      "CONFIGURATION_ERROR",
      "認証付き調査データ読取の設定が不足しています。",
    );
  }
  return { email, privateKey, spreadsheetId };
};

const createReaderAssertion = (email: string, privateKey: string): string => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const unsigned = [
      base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
      base64url(
        JSON.stringify({
          iss: email,
          scope: analysisDataReaderScope,
          aud: "https://oauth2.googleapis.com/token",
          iat: now,
          exp: now + 3600,
        }),
      ),
    ].join(".");
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    return `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
  } catch {
    throw new AnalysisDataSourceError(
      "AUTHENTICATION_FAILED",
      "調査データ読取認証の署名準備に失敗しました。",
    );
  }
};

const readerAccessToken = async (
  fetchImpl: FetchImplementation,
  email: string,
  privateKey: string,
): Promise<string> => {
  const assertion = createReaderAssertion(email, privateKey);
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
    throw new AnalysisDataSourceError(
      "AUTHENTICATION_FAILED",
      "調査データ読取認証への接続に失敗しました。",
    );
  }
  if (!response.ok) {
    throw new AnalysisDataSourceError(
      "AUTHENTICATION_FAILED",
      `調査データ読取認証に失敗しました: HTTP ${response.status}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new AnalysisDataSourceError(
      "AUTHENTICATION_FAILED",
      "調査データ読取認証の応答を解析できません。",
    );
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.access_token !== "string" ||
    parsed.access_token.trim() === ""
  ) {
    throw new AnalysisDataSourceError(
      "AUTHENTICATION_FAILED",
      "調査データ読取認証の応答が不正です。",
    );
  }
  return parsed.access_token;
};

const effectiveValue = (value: unknown): string | number | boolean | null => {
  if (!isRecord(value)) {
    throw new AnalysisDataSourceError(
      "INVALID_RESPONSE",
      "調査データのセル構造が不正です。",
    );
  }
  const raw = value.effectiveValue;
  if (raw === undefined) return null;
  if (!isRecord(raw)) {
    throw new AnalysisDataSourceError(
      "INVALID_RESPONSE",
      "調査データのセル値構造が不正です。",
    );
  }
  const entries = ["stringValue", "numberValue", "boolValue"].filter(
    (key) => raw[key] !== undefined,
  );
  if (entries.length !== 1) {
    throw new AnalysisDataSourceError(
      "INVALID_RESPONSE",
      "調査データのセル値構造が不正です。",
    );
  }
  const key = entries[0]!;
  const cellValue = raw[key];
  if (
    (key === "stringValue" && typeof cellValue === "string") ||
    (key === "numberValue" && typeof cellValue === "number" && Number.isFinite(cellValue)) ||
    (key === "boolValue" && typeof cellValue === "boolean")
  ) {
    return cellValue;
  }
  throw new AnalysisDataSourceError(
    "INVALID_RESPONSE",
    "調査データのセル値型が不正です。",
  );
};

const decodeRows = (sheet: Record<string, unknown>): readonly (readonly unknown[])[] => {
  if (!Array.isArray(sheet.data) || sheet.data.length !== 1 || !isRecord(sheet.data[0])) {
    throw new AnalysisDataSourceError(
      "INVALID_RESPONSE",
      "調査データのグリッド構造が不正です。",
    );
  }
  const rowData = sheet.data[0].rowData;
  if (!Array.isArray(rowData) || rowData.length === 0) {
    throw new AnalysisDataSourceError(
      "INVALID_RESPONSE",
      "調査データの応答が空です。",
    );
  }
  return rowData.map((row) => {
    if (!isRecord(row) || !Array.isArray(row.values)) {
      throw new AnalysisDataSourceError(
        "INVALID_RESPONSE",
        "調査データの行構造が不正です。",
      );
    }
    return row.values.map(effectiveValue);
  });
};

export class GoogleSheetsApiAnalysisDataSource implements AnalysisDataTableSource {
  constructor(private readonly fetchImpl: FetchImplementation = fetch) {}

  async readTab(
    tabName: typeof analysisDataSheetTitle,
  ): Promise<readonly (readonly unknown[])[]> {
    if (tabName !== analysisDataSheetTitle) {
      throw new AnalysisDataSourceError(
        "SHEET_MISSING",
        "許可されていない調査データタブです。",
      );
    }

    const { email, privateKey, spreadsheetId } = readerConfiguration();
    const token = await readerAccessToken(this.fetchImpl, email, privateKey);
    const url = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
    );
    url.searchParams.append("ranges", `'${analysisDataSheetTitle}'`);
    url.searchParams.set("includeGridData", "true");
    url.searchParams.set(
      "fields",
      "spreadsheetId,properties(title),sheets(properties(title),data(rowData(values(effectiveValue))))",
    );

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch {
      throw new AnalysisDataSourceError(
        "FETCH_FAILED",
        "調査データの取得通信に失敗しました。",
      );
    }
    if (!response.ok) {
      throw new AnalysisDataSourceError(
        response.status === 401 || response.status === 403
          ? "ACCESS_DENIED"
          : "FETCH_FAILED",
        `調査データの取得に失敗しました: HTTP ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AnalysisDataSourceError(
        "INVALID_RESPONSE",
        "調査データの応答を解析できません。",
      );
    }
    if (!isRecord(payload)) {
      throw new AnalysisDataSourceError(
        "INVALID_RESPONSE",
        "調査データの応答構造が不正です。",
      );
    }
    if (
      typeof payload.spreadsheetId !== "string" ||
      !isRecord(payload.properties) ||
      typeof payload.properties.title !== "string" ||
      !Array.isArray(payload.sheets)
    ) {
      throw new AnalysisDataSourceError(
        "INVALID_RESPONSE",
        "調査データのメタデータ構造が不正です。",
      );
    }
    if (payload.spreadsheetId !== spreadsheetId) {
      throw new AnalysisDataSourceError(
        "TARGET_MISMATCH",
        "調査データの取得先が設定対象と一致しません。",
      );
    }
    if (payload.properties.title !== analysisDataSpreadsheetTitle) {
      throw new AnalysisDataSourceError(
        "TITLE_MISMATCH",
        "調査データSpreadsheetのタイトルが正式値と一致しません。",
      );
    }
    const sheets = payload.sheets.filter(
      (sheet): sheet is Record<string, unknown> =>
        isRecord(sheet) &&
        isRecord(sheet.properties) &&
        sheet.properties.title === analysisDataSheetTitle,
    );
    if (sheets.length !== 1 || payload.sheets.length !== 1) {
      throw new AnalysisDataSourceError(
        "SHEET_MISSING",
        "取得対象の調査データシートを一意に確認できません。",
      );
    }
    return decodeRows(sheets[0]);
  }
}
