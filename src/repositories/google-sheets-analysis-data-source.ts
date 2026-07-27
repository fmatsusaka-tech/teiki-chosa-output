import type { AnalysisDataTableSource } from "./analysis-data-repository";

const spreadsheetId = process.env.ANALYSIS_DATA_SPREADSHEET_ID ?? "1Ix7qFigeUvmxkEl3C51rmzuBzYDq7OR_ZGHq6GUKa0g";
const analysisDataSheetId = process.env.ANALYSIS_DATA_SHEET_ID ?? "1565120965";

type VisualizationCell = { v: unknown } | null;
type VisualizationResponse = {
  table?: {
    cols?: Array<{ label?: string }>;
    rows?: Array<{ c?: VisualizationCell[] }>;
  };
};

export class GoogleSheetsAnalysisDataSource implements AnalysisDataTableSource {
  async readTab(tabName: "調査データ"): Promise<readonly (readonly unknown[])[] | null> {
    if (tabName !== "調査データ") {
      return null;
    }

    const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`);
    url.searchParams.set("gid", analysisDataSheetId);
    url.searchParams.set("tqx", "out:json");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`調査データの取得に失敗しました: HTTP ${response.status}`);
    }

    const payload = this.parse(await response.text());
    const table = payload.table;
    if (!table?.cols || !table.rows) {
      return null;
    }
    const headers = table.cols.map((column) => column.label ?? "");
    const rows = table.rows.map((row) => (row.c ?? []).map((cell) => cell?.v ?? null));
    return [headers, ...rows];
  }

  private parse(responseText: string): VisualizationResponse {
    const start = responseText.indexOf("{");
    const end = responseText.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("調査データの応答形式を解釈できません。");
    }
    return JSON.parse(responseText.slice(start, end + 1)) as VisualizationResponse;
  }
}
