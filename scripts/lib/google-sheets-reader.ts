import { createSign } from "node:crypto";
import type {
  LegacyPredictionSheet,
  SheetCell,
} from "../../src/features/prediction-data/prediction-master.types";

export const googleSheetsReadOnlyScope =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

const GRID_ROW_COUNT = 1000;
const GRID_COLUMN_COUNT = 56;

type GoogleGridData = {
  startRow?: number;
  startColumn?: number;
  rowData?: { values?: SheetCell[] }[];
};

type GoogleSheet = {
  properties: { title: string };
  data?: GoogleGridData[];
};

const base64url = (value: string | Buffer): string =>
  Buffer.from(value).toString("base64url");

const fetchAccessToken = async (): Promise<string> => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error("Google Sheets読取認証が設定されていません。");
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64url(
      JSON.stringify({
        iss: email,
        scope: googleSheetsReadOnlyScope,
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

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google認証に失敗しました: HTTP ${response.status}`);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Google認証トークンを取得できませんでした。");
  }
  return json.access_token;
};

export const normalizeGridData = (
  data: readonly GoogleGridData[],
): SheetCell[][] => {
  const grid = Array.from({ length: GRID_ROW_COUNT }, () =>
    Array.from({ length: GRID_COLUMN_COUNT }, (): SheetCell => ({})),
  );

  for (const block of data) {
    const startRow = block.startRow ?? 0;
    const startColumn = block.startColumn ?? 0;
    for (const [rowOffset, row] of (block.rowData ?? []).entries()) {
      const targetRow = startRow + rowOffset;
      if (targetRow >= GRID_ROW_COUNT) continue;
      for (const [columnOffset, cell] of (row.values ?? []).entries()) {
        const targetColumn = startColumn + columnOffset;
        if (targetColumn >= GRID_COLUMN_COUNT) continue;
        grid[targetRow][targetColumn] = cell;
      }
    }
  }
  return grid;
};

export const readLegacyPredictionSheets = async (
  spreadsheetId: string,
  titles: readonly string[],
): Promise<LegacyPredictionSheet[]> => {
  if (!spreadsheetId) throw new Error("Spreadsheet IDが設定されていません。");

  const token = await fetchAccessToken();
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
  );
  titles.forEach((title) =>
    url.searchParams.append("ranges", `'${title}'!A1:BD1000`),
  );
  url.searchParams.set("includeGridData", "true");
  url.searchParams.set(
    "fields",
    "sheets(properties(title),data(startRow,startColumn,rowData(values(formattedValue,effectiveValue))))",
  );

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Google Sheets読取に失敗しました: HTTP ${response.status}`);
  }

  const json = (await response.json()) as { sheets?: GoogleSheet[] };
  const sheets = json.sheets ?? [];
  const returnedTitles = new Set(
    sheets.map((sheet) => sheet.properties.title),
  );
  const missingTitles = titles.filter((title) => !returnedTitles.has(title));
  if (missingTitles.length > 0) {
    throw new Error(`対象シートを取得できません: ${missingTitles.join(", ")}`);
  }

  return sheets.map((sheet) => ({
    title: sheet.properties.title,
    grid: normalizeGridData(sheet.data ?? []),
  }));
};
