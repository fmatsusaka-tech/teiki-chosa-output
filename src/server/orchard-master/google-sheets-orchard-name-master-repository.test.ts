import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { orchardMasterSpreadsheetTitle, orchardNameMasterHeaders, orchardNameMasterSheetTitle } from "../../features/orchard-master/orchard-name-master";
import { createGoogleSheetsOrchardNameMasterRepository, OrchardMasterRepositoryError, orchardMasterReaderScope } from "./google-sheets-orchard-name-master-repository";

const original = {
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  target: process.env.ORCHARD_MASTER_SPREADSHEET_ID,
  writer: process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL,
};
const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } }).privateKey;

beforeEach(() => {
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "reader@example.invalid";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
  process.env.ORCHARD_MASTER_SPREADSHEET_ID = "orchard-target";
  process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL = "writer-must-not-be-used@example.invalid";
});
afterEach(() => {
  for (const [name, value] of Object.entries({ GOOGLE_SERVICE_ACCOUNT_EMAIL: original.email, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: original.key, ORCHARD_MASTER_SPREADSHEET_ID: original.target, PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL: original.writer })) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  vi.restoreAllMocks();
});

const responseBody = (overrides: Record<string, unknown> = {}) => ({
  spreadsheetId: "orchard-target",
  properties: { title: orchardMasterSpreadsheetTitle },
  sheets: [{ properties: { title: orchardNameMasterSheetTitle }, data: [{ rowData: [
    { values: orchardNameMasterHeaders.map((formattedValue) => ({ formattedValue })) },
    { values: ["１２号", "12号", "12号", "", "rule", "12号", "高", "確認済み", "12号", "", ""].map((formattedValue) => ({ formattedValue })) },
  ] }] }],
  ...overrides,
});

const fetchMock = (sheetResponse: Response = Response.json(responseBody())) => vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  if (String(input).includes("oauth2.googleapis.com")) return Response.json({ access_token: "reader-token" });
  expect(init?.method).toBe("GET");
  expect(String(input)).toContain(encodeURIComponent(orchardNameMasterSheetTitle));
  expect(String(input)).toContain("A%3AK");
  expect(init?.headers).toEqual({ authorization: "Bearer reader-token" });
  return sheetResponse;
});

describe("GoogleSheetsOrchardNameMasterRepository", () => {
  it("uses Reader credentials, readonly scope, and a fixed GET range", async () => {
    const fetchImpl = fetchMock();
    await expect(createGoogleSheetsOrchardNameMasterRepository(fetchImpl).read()).resolves.toMatchObject([{ originalOrchard: "１２号", officialOrchard: "12号" }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(orchardMasterReaderScope).toBe("https://www.googleapis.com/auth/spreadsheets.readonly");
    expect(fetchImpl.mock.calls.flatMap((call) => [String(call[0]), JSON.stringify(call[1])]).join(" ")).not.toContain("writer-must-not-be-used");
  });

  it.each([
    [403, "ACCESS_DENIED"],
    [500, "FETCH_FAILED"],
  ] as const)("classifies HTTP %s", async (status, code) => {
    await expect(createGoogleSheetsOrchardNameMasterRepository(fetchMock(new Response("secret-body", { status }))).read()).rejects.toMatchObject({ code });
  });

  it("rejects malformed responses without exposing IDs or response bodies", async () => {
    const error = await createGoogleSheetsOrchardNameMasterRepository(fetchMock(new Response("secret-body", { status: 200 }))).read().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OrchardMasterRepositoryError);
    expect(error).toMatchObject({ code: "INVALID_RESPONSE" });
    expect(String(error)).not.toContain("secret-body");
    expect(String(error)).not.toContain("orchard-target");
  });

  it.each([
    [responseBody({ spreadsheetId: "other" }), "TARGET_MISMATCH"],
    [responseBody({ properties: { title: "other" } }), "TITLE_MISMATCH"],
    [responseBody({ sheets: [] }), "SHEET_MISSING"],
  ] as const)("rejects target contract violations", async (body, code) => {
    await expect(createGoogleSheetsOrchardNameMasterRepository(fetchMock(Response.json(body))).read()).rejects.toMatchObject({ code });
  });
});
