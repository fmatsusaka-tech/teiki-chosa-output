import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  predictionCoefficientHeaders,
  predictionCoefficientSheetTitle,
  predictionMasterSpreadsheetTitle,
  predictionMetricOrder,
  predictionModelHeaders,
  predictionModelOrder,
  predictionModelSheetTitle,
  sourceSheetByMetric,
} from "../../features/prediction-data/prediction-master-contract";
import {
  createGoogleSheetsPredictionMasterRepository,
  PredictionMasterRepositoryError,
  predictionMasterRepositoryScope,
} from "./google-sheets-prediction-master-repository";

const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const originalKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
const originalWriterEmail = process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL;
const originalWriterKey = process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY;
const privateKey = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
}).privateKey;
const version = "1.0.0";
const generatedAt = "2026-08-01T12:34:56+09:00";

beforeEach(() => {
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "reader-test@example.invalid";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
  process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL = "must-not-use@example.invalid";
  process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY = "must-not-use";
});

afterEach(() => {
  const restore = (name: string, value: string | undefined): void => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore("GOOGLE_SERVICE_ACCOUNT_EMAIL", originalEmail);
  restore("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", originalKey);
  restore("PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL", originalWriterEmail);
  restore("PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY", originalWriterKey);
  vi.restoreAllMocks();
});

const effective = (value: string | number | boolean): object => ({
  effectiveValue:
    typeof value === "boolean"
      ? { boolValue: value }
      : typeof value === "number"
        ? { numberValue: value }
        : { stringValue: value },
});

const rows = (values: (string | number | boolean)[][]): object[] =>
  values.map((row) => ({ values: row.map(effective) }));

const spreadsheet = (overrides: Record<string, unknown> = {}): object => ({
  spreadsheetId: "target-id",
  properties: { title: predictionMasterSpreadsheetTitle },
  sheets: [
    {
      properties: { title: predictionModelSheetTitle },
      data: [
        {
          rowData: rows([
            [...predictionModelHeaders],
            ...predictionModelOrder.map((model) => [
              model, model, "01-03", true, "", "", version, generatedAt,
            ]),
          ]),
        },
      ],
    },
    {
      properties: { title: predictionCoefficientSheetTitle },
      data: [
        {
          rowData: rows([
            [...predictionCoefficientHeaders],
            ...predictionMetricOrder.flatMap((metric) =>
              predictionModelOrder.flatMap((model) =>
                ["01-01", "01-02", "01-03"].map((monthDay, index) => [
                  metric, model, monthDay, index + 1, sourceSheetByMetric[metric],
                  `'${sourceSheetByMetric[metric]}'!A${index + 1}`, version, generatedAt,
                ]),
              ),
            ),
          ]),
        },
      ],
    },
  ],
  ...overrides,
});

const tokenResponse = (): Response =>
  new Response(JSON.stringify({ access_token: "mock-access-token" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const successFetch = (body: object = spreadsheet()): ReturnType<typeof vi.fn> =>
  vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) =>
    init?.body instanceof URLSearchParams
      ? tokenResponse()
      : new Response(JSON.stringify(body), { status: 200 }),
  );

describe("Google Sheets Prediction Master Repository", () => {
  it("Reader認証とreadonlyスコープでA:HだけをGETしBundleを返す", async () => {
    const fetchMock = successFetch();
    const repository = createGoogleSheetsPredictionMasterRepository(
      fetchMock as typeof fetch,
    );
    const bundle = await repository.read({
      spreadsheetId: "target-id",
      expectedDataVersion: version,
    });
    expect(bundle.models).toHaveLength(6);
    expect(bundle.coefficients).toHaveLength(54);

    const tokenCall = fetchMock.mock.calls[0];
    const assertion = (tokenCall[1]?.body as URLSearchParams).get("assertion") ?? "";
    const payload = JSON.parse(
      Buffer.from(assertion.split(".")[1], "base64url").toString("utf8"),
    ) as { scope: string; iss: string };
    expect(payload.scope).toBe(predictionMasterRepositoryScope);
    expect(payload.iss).toBe("reader-test@example.invalid");

    const [url, init] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(init.method).toBe("GET");
    expect(url.searchParams.getAll("ranges")).toEqual([
      `'${predictionModelSheetTitle}'!A:H`,
      `'${predictionCoefficientSheetTitle}'!A:H`,
    ]);
    expect(fetchMock.mock.calls.filter((call) => {
      const method = call[1]?.method;
      return ["POST", "PATCH", "PUT", "DELETE"].includes(method) &&
        !(call[1]?.body instanceof URLSearchParams);
    })).toHaveLength(0);
  });

  it("Writer資格情報を参照しない", async () => {
    delete process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL;
    delete process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY;
    const repository = createGoogleSheetsPredictionMasterRepository(
      successFetch() as typeof fetch,
    );
    await expect(
      repository.read({ spreadsheetId: "target-id", expectedDataVersion: version }),
    ).resolves.toMatchObject({ models: expect.any(Array) });
  });

  it.each([
    ["Spreadsheet ID", spreadsheet({ spreadsheetId: "different-id" }), "TARGET_MISMATCH"],
    ["タイトル", spreadsheet({ properties: { title: "不正タイトル" } }), "TITLE_MISMATCH"],
  ])("%s不一致を拒否する", async (_name, body, code) => {
    const repository = createGoogleSheetsPredictionMasterRepository(
      successFetch(body) as typeof fetch,
    );
    await expect(
      repository.read({ spreadsheetId: "target-id", expectedDataVersion: version }),
    ).rejects.toMatchObject({ code });
  });

  it.each([
    ["両方", []],
    ["片方", (spreadsheet() as { sheets: object[] }).sheets.slice(0, 1)],
  ])("正式シート%s欠落を拒否する", async (_name, sheets) => {
    const repository = createGoogleSheetsPredictionMasterRepository(
      successFetch(spreadsheet({ sheets })) as typeof fetch,
    );
    await expect(
      repository.read({ spreadsheetId: "target-id", expectedDataVersion: version }),
    ).rejects.toMatchObject({ code: "SHEET_MISSING" });
  });

  it.each([
    [401, "AUTHENTICATION_FAILED"],
    [403, "AUTHENTICATION_FAILED"],
  ])("認証HTTP %iを分類しサニタイズする", async (status, code) => {
    const fetchMock = vi.fn(async () =>
      new Response("private-key jwt target-id", { status }),
    );
    const repository = createGoogleSheetsPredictionMasterRepository(
      fetchMock as typeof fetch,
    );
    let error: unknown;
    try {
      await repository.read({ spreadsheetId: "target-id", expectedDataVersion: version });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(PredictionMasterRepositoryError);
    expect(error).toMatchObject({ code });
    expect((error as Error).message).not.toMatch(/private-key|jwt|target-id|@/);
  });

  it.each([
    [403, "ACCESS_DENIED"],
    [500, "SPREADSHEET_FETCH_FAILED"],
  ])("Sheets HTTP %iを分類しサニタイズする", async (status, code) => {
    const fetchMock = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit) =>
        init?.body instanceof URLSearchParams
          ? tokenResponse()
          : new Response("mock-access-token target-id", { status }),
    );
    const repository = createGoogleSheetsPredictionMasterRepository(
      fetchMock as typeof fetch,
    );
    let error: unknown;
    try {
      await repository.read({ spreadsheetId: "target-id", expectedDataVersion: version });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code });
    expect((error as Error).message).not.toMatch(/mock-access-token|target-id|@/);
  });

  it("認証通信失敗とSheets通信失敗を分類する", async () => {
    const authenticationFailure = createGoogleSheetsPredictionMasterRepository(
      vi.fn(async () => { throw new Error("secret transport detail"); }) as typeof fetch,
    );
    await expect(
      authenticationFailure.read({ spreadsheetId: "target-id", expectedDataVersion: version }),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });

    const sheetsFailure = createGoogleSheetsPredictionMasterRepository(
      vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
        if (init?.body instanceof URLSearchParams) return tokenResponse();
        throw new Error("secret transport detail");
      }) as typeof fetch,
    );
    await expect(
      sheetsFailure.read({ spreadsheetId: "target-id", expectedDataVersion: version }),
    ).rejects.toMatchObject({ code: "SPREADSHEET_FETCH_FAILED" });
  });
});
