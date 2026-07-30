import { createSign } from "node:crypto";
import {
  predictionCoefficientSheetTitle,
  predictionMasterSpreadsheetTitle,
  predictionModelSheetTitle,
  PredictionMasterBatchStateUnknownError,
  type MasterCellValue,
  type PredictionMasterBatchUpdate,
  type PredictionMasterSpreadsheetMetadata,
  type PredictionMasterWriteProvider,
  type SerializedMasterSheet,
  type SerializedPredictionMasters,
} from "../../src/features/prediction-data/prediction-master-writer";

export const googleSheetsWriterScope =
  "https://www.googleapis.com/auth/spreadsheets";

type FetchImplementation = typeof fetch;
type GoogleEffectiveValue = {
  stringValue?: string;
  numberValue?: number;
  boolValue?: boolean;
};
type GoogleSpreadsheetResponse = {
  spreadsheetId?: string;
  properties?: { title?: string };
  sheets?: {
    properties?: {
      sheetId?: number;
      title?: string;
      gridProperties?: { rowCount?: number; columnCount?: number };
    };
    data?: {
      rowData?: { values?: { effectiveValue?: GoogleEffectiveValue }[] }[];
    }[];
  }[];
};

const base64url = (value: string | Buffer): string =>
  Buffer.from(value).toString("base64url");

const sanitizedHttpError = (stage: string, status: number): Error =>
  new Error(`${stage}に失敗しました: HTTP ${status}`);

const accessToken = async (fetchImpl: FetchImplementation): Promise<string> => {
  const email = process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL;
  const privateKey =
    process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
      /\\n/g,
      "\n",
    );
  if (!email || !privateKey) {
    throw new Error("Google Sheets Writer認証が設定されていません。");
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64url(
      JSON.stringify({
        iss: email,
        scope: googleSheetsWriterScope,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  ].join(".");
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;

  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw sanitizedHttpError("Google認証", response.status);
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Google認証トークンを取得できませんでした。");
  }
  return json.access_token;
};

const cellValue = (
  value: GoogleEffectiveValue | undefined,
): MasterCellValue => {
  if (value?.boolValue !== undefined) return value.boolValue;
  if (value?.numberValue !== undefined) return value.numberValue;
  return value?.stringValue ?? "";
};

const trimTrailingEmptyRows = (
  values: MasterCellValue[][],
): MasterCellValue[][] => {
  let last = values.length - 1;
  while (last >= 0 && values[last].every((value) => value === "")) last -= 1;
  return values.slice(0, last + 1);
};

const parsedSheet = (
  title: string,
  sheet: NonNullable<GoogleSpreadsheetResponse["sheets"]>[number] | undefined,
): SerializedMasterSheet => {
  if (!sheet) throw new Error(`再読込対象シートがありません: ${title}`);
  const values = (sheet.data?.[0]?.rowData ?? []).map((row) =>
    Array.from({ length: 8 }, (_, index) =>
      cellValue(row.values?.[index]?.effectiveValue),
    ),
  );
  return { title, values: trimTrailingEmptyRows(values) };
};

export const createGoogleSheetsWriterProvider = (
  fetchImpl: FetchImplementation = fetch,
): PredictionMasterWriteProvider => {
  let cachedToken: Promise<string> | undefined;
  const token = (): Promise<string> => (cachedToken ??= accessToken(fetchImpl));

  const getSpreadsheet = async (
    spreadsheetId: string,
    options: {
      includeGridData: boolean;
      ranges?: readonly string[];
      fields: string;
    },
    stage: string,
  ): Promise<GoogleSpreadsheetResponse> => {
    const url = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    );
    url.searchParams.set("includeGridData", String(options.includeGridData));
    url.searchParams.set("fields", options.fields);
    for (const range of options.ranges ?? []) {
      url.searchParams.append("ranges", range);
    }
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { authorization: `Bearer ${await token()}` },
    });
    if (!response.ok) throw sanitizedHttpError(stage, response.status);
    return (await response.json()) as GoogleSpreadsheetResponse;
  };

  const readMasterSheets = async (
    spreadsheetId: string,
  ): Promise<SerializedPredictionMasters> => {
    const json = await getSpreadsheet(
      spreadsheetId,
      {
        includeGridData: true,
        ranges: [
          `'${predictionModelSheetTitle}'!A1:H`,
          `'${predictionCoefficientSheetTitle}'!A1:H`,
        ],
        fields:
          "sheets(properties(title),data(rowData(values(effectiveValue))))",
      },
      "Prediction Master再読込",
    );
    const byTitle = new Map(
      (json.sheets ?? []).map((sheet) => [
        sheet.properties?.title ?? "",
        sheet,
      ]),
    );
    return {
      models: parsedSheet(
        predictionModelSheetTitle,
        byTitle.get(predictionModelSheetTitle),
      ),
      coefficients: parsedSheet(
        predictionCoefficientSheetTitle,
        byTitle.get(predictionCoefficientSheetTitle),
      ),
    };
  };

  return {
    async getMetadata(
      spreadsheetId: string,
    ): Promise<PredictionMasterSpreadsheetMetadata> {
      const json = await getSpreadsheet(
        spreadsheetId,
        {
          includeGridData: false,
          fields:
            "spreadsheetId,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
        },
        "Writer target確認",
      );
      const sheets: PredictionMasterSpreadsheetMetadata["sheets"] = (
        json.sheets ?? []
      ).map((sheet) => ({
        sheetId: sheet.properties?.sheetId ?? -1,
        title: sheet.properties?.title ?? "",
        rowCount: sheet.properties?.gridProperties?.rowCount ?? 0,
        columnCount: sheet.properties?.gridProperties?.columnCount ?? 0,
      }));
      const hasBoth =
        sheets.some((sheet) => sheet.title === predictionModelSheetTitle) &&
        sheets.some((sheet) => sheet.title === predictionCoefficientSheetTitle);
      if (hasBoth) {
        const current = await readMasterSheets(spreadsheetId);
        const headers = new Map([
          [predictionModelSheetTitle, current.models.values[0]],
          [predictionCoefficientSheetTitle, current.coefficients.values[0]],
        ]);
        for (const sheet of sheets) sheet.headers = headers.get(sheet.title);
      }
      return {
        spreadsheetId: json.spreadsheetId ?? spreadsheetId,
        title: json.properties?.title ?? "",
        sheets,
      };
    },

    async batchUpdate(
      spreadsheetId: string,
      request: PredictionMasterBatchUpdate,
    ): Promise<void> {
      const writerToken = await token();
      let response: Response;
      try {
        response = await fetchImpl(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${writerToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify(request),
          },
        );
      } catch {
        throw new PredictionMasterBatchStateUnknownError();
      }
      if (!response.ok) {
        throw sanitizedHttpError(
          "Prediction Master batch更新",
          response.status,
        );
      }
    },

    readMasterSheets,
  };
};

export const expectedPredictionMasterSpreadsheetTitle =
  predictionMasterSpreadsheetTitle;
