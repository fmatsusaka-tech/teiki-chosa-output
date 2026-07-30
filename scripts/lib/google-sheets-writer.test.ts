import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  predictionMasterSpreadsheetTitle,
  type PredictionMasterBatchUpdate,
} from "../../src/features/prediction-data/prediction-master-writer";
import { googleSheetsReadOnlyScope } from "./google-sheets-reader";
import {
  createGoogleSheetsWriterProvider,
  googleSheetsWriterScope,
} from "./google-sheets-writer";

const originalEmail = process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL;
const originalKey = process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY;
const privateKey = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
}).privateKey;

beforeEach(() => {
  process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL =
    "writer-test@example.invalid";
  process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
});

afterEach(() => {
  if (originalEmail === undefined) {
    delete process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL;
  } else {
    process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL = originalEmail;
  }
  if (originalKey === undefined) {
    delete process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY;
  } else {
    process.env.PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY = originalKey;
  }
  vi.restoreAllMocks();
});

const tokenResponse = (): Response =>
  new Response(JSON.stringify({ access_token: "mock-access-token" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const emptyBatch: PredictionMasterBatchUpdate = { requests: [] };

describe("Google Sheets Writer Provider", () => {
  it("Readerはreadonly、Writerはspreadsheetsだけを使用する", async () => {
    let assertedScope = "";
    const fetchMock = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit) => {
        const body = init?.body;
        if (body instanceof URLSearchParams) {
          const assertion = body.get("assertion") ?? "";
          const payload = JSON.parse(
            Buffer.from(assertion.split(".")[1], "base64url").toString("utf8"),
          ) as { scope?: string };
          assertedScope = payload.scope ?? "";
          return tokenResponse();
        }
        return new Response(
          JSON.stringify({
            spreadsheetId: "output-id",
            properties: { title: predictionMasterSpreadsheetTitle },
            sheets: [],
          }),
          { status: 200 },
        );
      },
    ) as typeof fetch;
    const provider = createGoogleSheetsWriterProvider(fetchMock);
    await provider.getMetadata("output-id");
    expect(googleSheetsReadOnlyScope).toBe(
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    );
    expect(googleSheetsWriterScope).toBe(
      "https://www.googleapis.com/auth/spreadsheets",
    );
    expect(assertedScope).toBe(googleSheetsWriterScope);
  });

  it.each([400, 401, 403, 429, 500, 503])(
    "batch API HTTP %iを秘密情報なしで失敗させる",
    async (status) => {
      const fetchMock = vi.fn(
        async (_input: URL | RequestInfo, init?: RequestInit) => {
          if (init?.body instanceof URLSearchParams) return tokenResponse();
          return new Response("mock-access-token private-key jwt", { status });
        },
      ) as typeof fetch;
      const provider = createGoogleSheetsWriterProvider(fetchMock);
      let error: unknown;
      try {
        await provider.batchUpdate("output-id", emptyBatch);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain(`HTTP ${status}`);
      expect(message).not.toContain("mock-access-token");
      expect(message).not.toContain("private-key");
      expect(message).not.toContain("jwt");
      expect(message).not.toContain("output-id");
    },
  );

  it("batch更新は1回のSheets POSTだけを送る", async () => {
    const methods: string[] = [];
    const fetchMock = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit) => {
        if (init?.body instanceof URLSearchParams) return tokenResponse();
        methods.push(init?.method ?? "GET");
        return new Response("{}", { status: 200 });
      },
    ) as typeof fetch;
    const provider = createGoogleSheetsWriterProvider(fetchMock);
    await provider.batchUpdate("output-id", emptyBatch);
    expect(methods).toEqual(["POST"]);
  });
  it("batch送信後の通信切断を適用状態不明エラーへ変換する", async () => {
    let sheetsCalls = 0;
    const fetchMock = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit) => {
        if (init?.body instanceof URLSearchParams) return tokenResponse();
        sheetsCalls += 1;
        throw new TypeError("network timeout with sensitive transport detail");
      },
    ) as typeof fetch;
    const provider = createGoogleSheetsWriterProvider(fetchMock);
    await expect(
      provider.batchUpdate("output-id", emptyBatch),
    ).rejects.toMatchObject({
      name: "PredictionMasterBatchStateUnknownError",
    });
    expect(sheetsCalls).toBe(1);
  });
});
