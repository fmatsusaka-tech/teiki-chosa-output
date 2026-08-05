import {
  decodeOrchardNameMaster,
  orchardMasterSpreadsheetTitle,
  orchardNameMasterRange,
  orchardNameMasterSheetTitle,
  type OrchardNameMapping,
} from "../../features/orchard-master/orchard-name-master";
import { fetchGoogleAccessToken, isRecord } from "../google-sheets/google-sheets-auth";

export const orchardMasterReaderScope = "https://www.googleapis.com/auth/spreadsheets.readonly";
type FetchImplementation = typeof fetch;

export type OrchardMasterRepositoryErrorCode =
  | "CONFIGURATION_ERROR" | "AUTHENTICATION_FAILED" | "ACCESS_DENIED" | "FETCH_FAILED"
  | "TARGET_MISMATCH" | "TITLE_MISMATCH" | "SHEET_MISSING" | "INVALID_RESPONSE";

export class OrchardMasterRepositoryError extends Error {
  constructor(public readonly code: OrchardMasterRepositoryErrorCode, message: string) {
    super(message);
    this.name = "OrchardMasterRepositoryError";
  }
}

const getToken = async (fetchImpl: FetchImplementation, email: string, privateKey: string): Promise<string> => {
  try {
    return await fetchGoogleAccessToken(fetchImpl, { email, privateKey, scope: orchardMasterReaderScope }, "園地マスタ読取認証");
  } catch (error) {
    throw new OrchardMasterRepositoryError("AUTHENTICATION_FAILED", error instanceof Error ? error.message : "園地マスタ読取認証に失敗しました。");
  }
};

const decodeGrid = (sheet: Record<string, unknown>): readonly (readonly unknown[])[] => {
  if (!Array.isArray(sheet.data) || sheet.data.length !== 1 || !isRecord(sheet.data[0])) throw new OrchardMasterRepositoryError("INVALID_RESPONSE", "園地マスタのグリッド構造が不正です。");
  const rows = sheet.data[0].rowData;
  if (!Array.isArray(rows)) throw new OrchardMasterRepositoryError("INVALID_RESPONSE", "園地マスタの行構造が不正です。");
  return rows.map((row) => {
    if (!isRecord(row) || !Array.isArray(row.values)) throw new OrchardMasterRepositoryError("INVALID_RESPONSE", "園地マスタの行構造が不正です。");
    return row.values.map((cell) => isRecord(cell) && typeof cell.formattedValue === "string" ? cell.formattedValue : "");
  });
};

export const createGoogleSheetsOrchardNameMasterRepository = (fetchImpl: FetchImplementation = fetch) => ({
  async read(): Promise<OrchardNameMapping[]> {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.ORCHARD_MASTER_SPREADSHEET_ID;
    if (!email || !privateKey || !spreadsheetId) throw new OrchardMasterRepositoryError("CONFIGURATION_ERROR", "園地マスタ読取設定が不足しています。");
    const token = await getToken(fetchImpl, email, privateKey);
    const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`);
    url.searchParams.append("ranges", `'${orchardNameMasterSheetTitle}'!${orchardNameMasterRange}`);
    url.searchParams.set("includeGridData", "true");
    url.searchParams.set("fields", "spreadsheetId,properties(title),sheets(properties(title),data(rowData(values(formattedValue))))");
    let response: Response;
    try { response = await fetchImpl(url, { method: "GET", headers: { authorization: `Bearer ${token}` }, cache: "no-store" }); }
    catch { throw new OrchardMasterRepositoryError("FETCH_FAILED", "園地マスタの取得通信に失敗しました。"); }
    if (!response.ok) throw new OrchardMasterRepositoryError(response.status === 401 || response.status === 403 ? "ACCESS_DENIED" : "FETCH_FAILED", `園地マスタの取得に失敗しました: HTTP ${response.status}`);
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new OrchardMasterRepositoryError("INVALID_RESPONSE", "園地マスタの応答を解析できません。"); }
    if (!isRecord(payload) || typeof payload.spreadsheetId !== "string" || !isRecord(payload.properties) || !Array.isArray(payload.sheets)) {
      throw new OrchardMasterRepositoryError("INVALID_RESPONSE", "園地マスタの応答構造が不正です。");
    }
    if (payload.spreadsheetId !== spreadsheetId) throw new OrchardMasterRepositoryError("TARGET_MISMATCH", "園地マスタの取得先が設定対象と一致しません。");
    if (payload.properties.title !== orchardMasterSpreadsheetTitle) throw new OrchardMasterRepositoryError("TITLE_MISMATCH", "園地マスタSpreadsheetのタイトルが正式値と一致しません。");
    const sheets = payload.sheets.filter((sheet): sheet is Record<string, unknown> => isRecord(sheet) && isRecord(sheet.properties) && sheet.properties.title === orchardNameMasterSheetTitle);
    if (sheets.length !== 1) throw new OrchardMasterRepositoryError("SHEET_MISSING", "園地名正規化マスタを一意に確認できません。");
    try { return decodeOrchardNameMaster(decodeGrid(sheets[0])); }
    catch (error) {
      if (error instanceof OrchardMasterRepositoryError) throw error;
      throw new OrchardMasterRepositoryError("INVALID_RESPONSE", "園地名正規化マスタが契約を満たしていません。");
    }
  },
});
