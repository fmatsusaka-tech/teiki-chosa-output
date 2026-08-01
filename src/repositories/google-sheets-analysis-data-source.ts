import type { AnalysisDataTableSource } from "./analysis-data-repository";
import { AnalysisDataError } from "./analysis-data-error";

const spreadsheetId = process.env.ANALYSIS_DATA_SPREADSHEET_ID ?? "1Ix7qFigeUvmxkEl3C51rmzuBzYDq7OR_ZGHq6GUKa0g";
const analysisDataSheetId = process.env.ANALYSIS_DATA_SHEET_ID ?? "1565120965";

type VisualizationCell = { v: unknown } | null;
type VisualizationResponse = {
  table?: {
    cols?: Array<{ label?: string }>;
    rows?: Array<{ c?: VisualizationCell[] }>;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export class GoogleSheetsAnalysisDataSource implements AnalysisDataTableSource {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async readTab(tabName: "調査データ"): Promise<readonly (readonly unknown[])[] | null> {
    if (tabName !== "調査データ") {
      throw new AnalysisDataError("TAB_NOT_ALLOWED", "許可されていない調査データタブです。");
    }

    const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`);
    url.searchParams.set("gid", analysisDataSheetId);
    url.searchParams.set("tqx", "out:json");
    let response: Response;
    try {
      response = await this.fetchImpl(url, { method: "GET", cache: "no-store" });
    } catch {
      throw new AnalysisDataError("FETCH_FAILED", "調査データの取得通信に失敗しました。");
    }
    if (!response.ok) {
      throw new AnalysisDataError(
        "FETCH_FAILED",
        `調査データの取得に失敗しました: HTTP ${response.status}`,
      );
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch {
      throw new AnalysisDataError("RESPONSE_PARSE_FAILED", "調査データの応答本文を読み取れません。");
    }
    const payload = this.parse(responseText);
    const table = payload.table;
    if (!table || !Array.isArray(table.cols) || !Array.isArray(table.rows)) {
      throw new AnalysisDataError("INVALID_RESPONSE", "調査データの応答構造が不正です。");
    }
    const headers = table.cols.map((column) => {
      if (!isRecord(column) || (column.label !== undefined && typeof column.label !== "string")) {
        throw new AnalysisDataError("INVALID_RESPONSE", "調査データの見出し構造が不正です。");
      }
      return column.label ?? "";
    });
    const rows = table.rows.map((row) => {
      if (!isRecord(row) || !Array.isArray(row.c)) {
        throw new AnalysisDataError("INVALID_RESPONSE", "調査データの行構造が不正です。");
      }
      return row.c.map((cell) => {
        if (cell === null) return null;
        if (!isRecord(cell)) {
          throw new AnalysisDataError("INVALID_RESPONSE", "調査データのセル構造が不正です。");
        }
        return cell.v ?? null;
      });
    });
    return [headers, ...rows];
  }

  private parse(responseText: string): VisualizationResponse {
    const trimmed = responseText.trim();
    if (!trimmed) {
      throw new AnalysisDataError("RESPONSE_PARSE_FAILED", "調査データの応答形式を解釈できません。");
    }
    const callbackStart = trimmed.indexOf("(");
    const callbackEnd = trimmed.lastIndexOf(")");
    const jsonText = callbackStart >= 0 && callbackEnd > callbackStart
      ? trimmed.slice(callbackStart + 1, callbackEnd)
      : trimmed;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new AnalysisDataError("RESPONSE_PARSE_FAILED", "調査データの応答JSONを解釈できません。");
    }
    if (!isRecord(parsed)) {
      throw new AnalysisDataError("INVALID_RESPONSE", "調査データの応答構造が不正です。");
    }
    if (parsed.table !== undefined && !isRecord(parsed.table)) {
      throw new AnalysisDataError("INVALID_RESPONSE", "調査データの応答構造が不正です。");
    }
    return parsed as VisualizationResponse;
  }
}
