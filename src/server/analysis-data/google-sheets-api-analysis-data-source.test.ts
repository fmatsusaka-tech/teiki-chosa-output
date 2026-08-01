import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analysisDataHeaders } from "../../contracts/analysis-data";
import { AnalysisDataRepository } from "../../repositories/analysis-data-repository";
import {
  analysisDataReaderScope,
  analysisDataSheetTitle,
  analysisDataSpreadsheetTitle,
  AnalysisDataSourceError,
  GoogleSheetsApiAnalysisDataSource,
} from "./google-sheets-api-analysis-data-source";

const targetId = "input-target-id-for-test";
const email = "reader-test@example.invalid";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const original = {
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  id: process.env.ANALYSIS_DATA_SPREADSHEET_ID,
  writerEmail: process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL,
  writerKey: process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY,
};

const restore = (name: string, value: string | undefined): void => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

beforeEach(() => {
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = email;
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = pem;
  process.env.ANALYSIS_DATA_SPREADSHEET_ID = targetId;
  process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL = "writer@example.invalid";
  process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY = "writer-secret-key";
});

afterEach(() => {
  restore("GOOGLE_SERVICE_ACCOUNT_EMAIL", original.email);
  restore("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", original.key);
  restore("ANALYSIS_DATA_SPREADSHEET_ID", original.id);
  restore("PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL", original.writerEmail);
  restore("PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY", original.writerKey);
});

const tokenResponse = (body: unknown = { access_token: "reader-access-token" }, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const cell = (effectiveValue?: unknown) => effectiveValue === undefined ? {} : { effectiveValue };
const spreadsheet = (overrides: Record<string, unknown> = {}) => ({
  spreadsheetId: targetId,
  properties: { title: analysisDataSpreadsheetTitle },
  sheets: [{
    properties: { title: analysisDataSheetTitle },
    data: [{ rowData: [
      { values: [cell({ stringValue: "見出し" }), cell({ stringValue: "数値" }), cell({ stringValue: "真偽" }), cell()] },
      { values: [cell({ stringValue: "値" }), cell({ numberValue: 42 }), cell({ boolValue: true })] },
    ] }],
  }],
  ...overrides,
});

const fetchFor = (payload: unknown = spreadsheet()) => vi.fn<typeof fetch>(
  async (_input, init) => init?.body instanceof URLSearchParams
    ? tokenResponse()
    : new Response(JSON.stringify(payload), { status: 200 }),
);

const read = (fetchImpl: typeof fetch, tab: string = analysisDataSheetTitle) =>
  new GoogleSheetsApiAnalysisDataSource(fetchImpl).readTab(tab as typeof analysisDataSheetTitle);

describe("GoogleSheetsApiAnalysisDataSource", () => {
  it("Reader認証と固定GETだけで正式シートの値型を復元する", async () => {
    const fetchMock = fetchFor();
    await expect(read(fetchMock)).resolves.toEqual([
      ["見出し", "数値", "真偽", null],
      ["値", 42, true],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    const [sheetsUrl, sheetsInit] = fetchMock.mock.calls[1]!;
    expect(String(tokenUrl)).toBe("https://oauth2.googleapis.com/token");
    expect(tokenInit?.method).toBe("POST");
    expect(sheetsInit).toMatchObject({ method: "GET", cache: "no-store" });
    expect(String(sheetsUrl)).toContain(encodeURIComponent(targetId));
    const url = new URL(String(sheetsUrl));
    expect(url.searchParams.getAll("ranges")).toEqual(["'調査データ'"]);
    expect(url.searchParams.get("includeGridData")).toBe("true");
    expect(url.searchParams.get("fields")).not.toContain("formattedValue");
  });

  it("JWTのscopeをreadonlyへ固定しWriter資格情報を参照しない", async () => {
    const fetchMock = fetchFor();
    await read(fetchMock);
    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    const assertion = body.get("assertion")!;
    const payload = JSON.parse(Buffer.from(assertion.split(".")[1]!, "base64url").toString());
    expect(payload).toMatchObject({ iss: email, scope: analysisDataReaderScope });
    expect(assertion).not.toContain("writer-secret-key");
    expect(assertion).not.toContain("writer@example.invalid");
  });

  it("調査データ以外をHTTPアクセス前に拒否する", async () => {
    const fetchMock = fetchFor();
    await expect(read(fetchMock, "別シート")).rejects.toMatchObject({ code: "SHEET_MISSING" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "ANALYSIS_DATA_SPREADSHEET_ID",
  ])("必須設定%sの欠落を固定IDへフォールバックせず拒否する", async (name) => {
    delete process.env[name];
    const fetchMock = fetchFor();
    await expect(read(fetchMock)).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("秘密鍵署名失敗を認証エラーへ変換し秘密情報を出さない", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "PRIVATE-KEY-SECRET invalid";
    let error: unknown;
    try { await read(fetchFor()); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: "AUTHENTICATION_FAILED" });
    expect((error as Error).message).not.toMatch(/PRIVATE-KEY-SECRET|reader-test|DECODER|PEM/);
  });

  it("token通信失敗をサニタイズする", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error("JWT TOKEN SECRET"); });
    await expect(read(fetchMock)).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
    await expect(read(fetchMock)).rejects.not.toThrow(/JWT|TOKEN|SECRET/);
  });

  it("token endpointのHTTP失敗を分類する", async () => {
    await expect(read(vi.fn<typeof fetch>(async () => tokenResponse({}, 500)))).rejects.toMatchObject({
      code: "AUTHENTICATION_FAILED",
      message: expect.stringContaining("HTTP 500"),
    });
  });

  it.each([null, [], "primitive", {}, { access_token: 1 }, { access_token: "  " }])(
    "不正なtoken応答を認証エラーにする",
    async (body) => {
      await expect(read(vi.fn<typeof fetch>(async () => tokenResponse(body)))).rejects.toMatchObject({
        code: "AUTHENTICATION_FAILED",
      });
    },
  );

  it("token不正JSONを認証エラーにする", async () => {
    await expect(read(vi.fn<typeof fetch>(async () => new Response("TOKEN RESPONSE SECRET", { status: 200 })))).rejects.toMatchObject({
      code: "AUTHENTICATION_FAILED",
    });
  });

  it.each([401, 403])("Sheets HTTP %sをACCESS_DENIEDにする", async (status) => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) =>
      init?.body instanceof URLSearchParams ? tokenResponse() : new Response("denied", { status }));
    await expect(read(fetchMock)).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });

  it("Sheets通信失敗をサニタイズする", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.body instanceof URLSearchParams) return tokenResponse();
      throw new Error("SHEET CELL SECRET");
    });
    let error: unknown;
    try { await read(fetchMock); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: "FETCH_FAILED" });
    expect((error as Error).message).not.toMatch(/SHEET|CELL|SECRET|input-target/);
  });

  it("Sheets不正JSONをサニタイズする", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) =>
      init?.body instanceof URLSearchParams ? tokenResponse() : new Response("CELL RESPONSE SECRET"));
    let error: unknown;
    try { await read(fetchMock); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: "INVALID_RESPONSE" });
    expect((error as Error).message).not.toMatch(/CELL|RESPONSE|SECRET|input-target/);
  });

  it.each([null, [], "primitive", {}])("空または不正なSheets応答を拒否する", async (payload) => {
    await expect(read(fetchFor(payload))).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("Spreadsheet ID不一致を拒否する", async () => {
    await expect(read(fetchFor(spreadsheet({ spreadsheetId: "different-id" })))).rejects.toMatchObject({ code: "TARGET_MISMATCH" });
  });

  it("Spreadsheetタイトル不一致を拒否する", async () => {
    await expect(read(fetchFor(spreadsheet({ properties: { title: "別タイトル" } })))).rejects.toMatchObject({ code: "TITLE_MISMATCH" });
  });

  it.each([
    ["欠落", []],
    ["別シート", [{ properties: { title: "別シート" }, data: [{ rowData: [] }] }]],
    ["重複", [spreadsheet().sheets[0], spreadsheet().sheets[0]]],
  ])("調査データシートの%sを拒否する", async (_name, sheets) => {
    await expect(read(fetchFor(spreadsheet({ sheets })))).rejects.toMatchObject({ code: "SHEET_MISSING" });
  });

  it.each([
    ["data欠落", { properties: { title: analysisDataSheetTitle } }],
    ["data複数", { properties: { title: analysisDataSheetTitle }, data: [{ rowData: [] }, { rowData: [] }] }],
    ["rowData欠落", { properties: { title: analysisDataSheetTitle }, data: [{}] }],
    ["空rowData", { properties: { title: analysisDataSheetTitle }, data: [{ rowData: [] }] }],
    ["不正row", { properties: { title: analysisDataSheetTitle }, data: [{ rowData: [null] }] }],
    ["values欠落", { properties: { title: analysisDataSheetTitle }, data: [{ rowData: [{}] }] }],
    ["不正cell", { properties: { title: analysisDataSheetTitle }, data: [{ rowData: [{ values: [null] }] }] }],
    ["不正effectiveValue", { properties: { title: analysisDataSheetTitle }, data: [{ rowData: [{ values: [{ effectiveValue: [] }] }] }] }],
  ])("不正な%s構造を拒否する", async (_name, sheet) => {
    await expect(read(fetchFor(spreadsheet({ sheets: [sheet] })))).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("省略された行末セルを0で補わず短い行として渡す", async () => {
    const payload = spreadsheet({ sheets: [{
      properties: { title: analysisDataSheetTitle },
      data: [{ rowData: [
        { values: [cell({ stringValue: "A" }), cell({ stringValue: "B" })] },
        { values: [cell({ stringValue: "value" })] },
      ] }],
    }] });
    await expect(read(fetchFor(payload))).resolves.toEqual([["A", "B"], ["value"]]);
  });

  it("不正な値型と複数値を拒否する", async () => {
    for (const effectiveValue of [
      { numberValue: Number.POSITIVE_INFINITY },
      { numberValue: "1" },
      { boolValue: 1 },
      { stringValue: 1 },
      { stringValue: "a", numberValue: 1 },
    ]) {
      const payload = spreadsheet({ sheets: [{
        properties: { title: analysisDataSheetTitle },
        data: [{ rowData: [{ values: [cell(effectiveValue)] }] }],
      }] });
      await expect(read(fetchFor(payload))).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    }
  });

  it("既存AnalysisDataRepositoryへ渡して正式レコードへ変換できる", async () => {
    const headers = Object.values(analysisDataHeaders);
    const values: Record<string, unknown> = {
      [analysisDataHeaders.id]: "00000000-0000-4000-8000-000000000001",
      [analysisDataHeaders.registeredAt]: "2026-07-20T00:00:00+09:00",
      [analysisDataHeaders.measuredAt]: 46223,
      [analysisDataHeaders.fiscalYear]: 2026,
      [analysisDataHeaders.year]: 2026,
      [analysisDataHeaders.month]: 7,
      [analysisDataHeaders.surveyMonth]: "7月",
      [analysisDataHeaders.surveyPeriod]: "中旬",
      [analysisDataHeaders.dataStatus]: "正常",
      [analysisDataHeaders.inputMethod]: "手入力",
    };
    const encode = (value: unknown) => typeof value === "string"
      ? cell({ stringValue: value })
      : typeof value === "number"
        ? cell({ numberValue: value })
        : cell();
    const payload = spreadsheet({ sheets: [{
      properties: { title: analysisDataSheetTitle },
      data: [{ rowData: [
        { values: headers.map((header) => cell({ stringValue: header })) },
        { values: headers.map((header) => encode(values[header])) },
      ] }],
    }] });
    const repository = new AnalysisDataRepository(
      new GoogleSheetsApiAnalysisDataSource(fetchFor(payload)),
    );
    const records = await repository.getAll();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ id: values[analysisDataHeaders.id], fiscalYear: 2026 });
  });

  it("外部HTTPはtoken POSTとSheets GETだけでGVizへフォールバックしない", async () => {
    const fetchMock = fetchFor();
    await read(fetchMock);
    expect(fetchMock.mock.calls.map(([input, init]) => [String(input), init?.method])).toEqual([
      ["https://oauth2.googleapis.com/token", "POST"],
      [expect.stringContaining("https://sheets.googleapis.com/v4/spreadsheets/"), "GET"],
    ]);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("gviz"))).toBe(false);
  });

  it("構造化エラー型を公開する", () => {
    expect(new AnalysisDataSourceError("INVALID_RESPONSE", "fixed")).toMatchObject({
      name: "AnalysisDataSourceError",
      code: "INVALID_RESPONSE",
      message: "fixed",
    });
  });
});
