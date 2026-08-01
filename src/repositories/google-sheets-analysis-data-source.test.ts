import { describe, expect, it, vi } from "vitest";
import { AnalysisDataError } from "./analysis-data-error";
import { GoogleSheetsAnalysisDataSource } from "./google-sheets-analysis-data-source";

const gviz = (value: unknown): string =>
  `google.visualization.Query.setResponse(${JSON.stringify(value)});`;

const fetchWith = (body: string, status = 200) => vi.fn<typeof fetch>(async () =>
  new Response(body, { status }));

describe("GoogleSheetsAnalysisDataSource", () => {
  it("reads a valid GViz response using GET only", async () => {
    const fetchImpl = fetchWith(gviz({
      table: {
        cols: [{ label: "登録ID" }, { label: "計測日" }],
        rows: [{ c: [{ v: "record-1" }, { v: "Date(2026,6,20)" }] }],
      },
    }));

    await expect(new GoogleSheetsAnalysisDataSource(fetchImpl).readTab("調査データ")).resolves.toEqual([
      ["登録ID", "計測日"],
      ["record-1", "Date(2026,6,20)"],
    ]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
  });

  it("rejects any tab other than 調査データ without HTTP access", async () => {
    const fetchImpl = fetchWith("");
    const promise = new GoogleSheetsAnalysisDataSource(fetchImpl).readTab("other" as "調査データ");

    await expect(promise).rejects.toMatchObject({ code: "TAB_NOT_ALLOWED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("classifies communication and HTTP failures", async () => {
    const communicationFailure = vi.fn<typeof fetch>(async () => { throw new Error("network secret"); });
    await expect(new GoogleSheetsAnalysisDataSource(communicationFailure).readTab("調査データ")).rejects.toMatchObject({
      code: "FETCH_FAILED",
      message: "調査データの取得通信に失敗しました。",
    });
    await expect(new GoogleSheetsAnalysisDataSource(fetchWith("denied", 403)).readTab("調査データ")).rejects.toMatchObject({
      code: "FETCH_FAILED",
      message: "調査データの取得に失敗しました: HTTP 403",
    });
  });

  it.each([
    ["", "RESPONSE_PARSE_FAILED"],
    ["not-json PRIVATE-CELL-VALUE", "RESPONSE_PARSE_FAILED"],
    ["google.visualization.Query.setResponse({invalid PRIVATE-CELL-VALUE});", "RESPONSE_PARSE_FAILED"],
    [gviz(null), "INVALID_RESPONSE"],
    [gviz([]), "INVALID_RESPONSE"],
    [gviz("primitive PRIVATE-CELL-VALUE"), "INVALID_RESPONSE"],
    [gviz(42), "INVALID_RESPONSE"],
    [gviz(true), "INVALID_RESPONSE"],
  ])("rejects malformed payload without leaking its body", async (body, code) => {
    const promise = new GoogleSheetsAnalysisDataSource(fetchWith(body)).readTab("調査データ");

    await expect(promise).rejects.toMatchObject({ name: "AnalysisDataError", code });
    await expect(promise).rejects.not.toThrow("PRIVATE-CELL-VALUE");
    await expect(promise).rejects.not.toThrow("docs.google.com");
    await expect(promise).rejects.not.toThrow("gid");
  });

  it.each([
    [{}, "INVALID_RESPONSE"],
    [{ table: null }, "INVALID_RESPONSE"],
    [{ table: { cols: null, rows: [] } }, "INVALID_RESPONSE"],
    [{ table: { cols: [], rows: null } }, "INVALID_RESPONSE"],
    [{ table: { cols: [null], rows: [] } }, "INVALID_RESPONSE"],
    [{ table: { cols: [{ label: 1 }], rows: [] } }, "INVALID_RESPONSE"],
    [{ table: { cols: [], rows: [null] } }, "INVALID_RESPONSE"],
    [{ table: { cols: [], rows: [{}] } }, "INVALID_RESPONSE"],
    [{ table: { cols: [], rows: [{ c: ["cell"] }] } }, "INVALID_RESPONSE"],
  ])("rejects invalid GViz table structure", async (payload, code) => {
    await expect(new GoogleSheetsAnalysisDataSource(fetchWith(gviz(payload))).readTab("調査データ")).rejects.toMatchObject({
      name: "AnalysisDataError",
      code,
    });
  });

  it("uses fixed sanitized errors", () => {
    const error = new AnalysisDataError("INVALID_RESPONSE", "fixed");
    expect(error).toMatchObject({ name: "AnalysisDataError", code: "INVALID_RESPONSE", message: "fixed" });
  });
});
