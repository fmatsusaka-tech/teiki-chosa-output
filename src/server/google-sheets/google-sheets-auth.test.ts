import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { fetchGoogleAccessToken, GoogleSheetsAuthError, isRecord } from "./google-sheets-auth";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const credentials = { email: "reader@example.invalid", privateKey: pem, scope: "https://www.googleapis.com/auth/spreadsheets.readonly" };

const tokenResponse = (body: unknown = { access_token: "mock-token" }, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("fetchGoogleAccessToken", () => {
  it("signs a JWT bearer assertion and returns the access token", async () => {
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(String(_input)).toBe("https://oauth2.googleapis.com/token");
      expect(init?.method).toBe("POST");
      const assertion = (init?.body as URLSearchParams).get("assertion")!;
      const payload = JSON.parse(Buffer.from(assertion.split(".")[1]!, "base64url").toString("utf8"));
      expect(payload).toMatchObject({ iss: credentials.email, scope: credentials.scope });
      return tokenResponse();
    });
    await expect(fetchGoogleAccessToken(fetchMock, credentials, "テスト認証")).resolves.toBe("mock-token");
  });

  it("wraps a signing failure without leaking the private key", async () => {
    const error = await fetchGoogleAccessToken(
      vi.fn() as typeof fetch,
      { ...credentials, privateKey: "PRIVATE-KEY-SECRET invalid" },
      "テスト認証",
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GoogleSheetsAuthError);
    expect((error as Error).message).toBe("テスト認証の署名準備に失敗しました。");
    expect((error as Error).message).not.toMatch(/PRIVATE-KEY-SECRET|DECODER|PEM/);
  });

  it("wraps a transport failure without leaking the underlying error", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("JWT TOKEN SECRET"); });
    const error = await fetchGoogleAccessToken(fetchMock as typeof fetch, credentials, "テスト認証").catch((caught: unknown) => caught);
    expect(error).toMatchObject({ message: "テスト認証への接続に失敗しました。" });
  });

  it("includes the HTTP status when the token endpoint rejects the request", async () => {
    const fetchMock = vi.fn(async () => tokenResponse({}, 500));
    await expect(fetchGoogleAccessToken(fetchMock as typeof fetch, credentials, "テスト認証")).rejects.toMatchObject({
      message: expect.stringContaining("HTTP 500"),
    });
  });

  it("rejects an unparsable response body", async () => {
    const fetchMock = vi.fn(async () => new Response("TOKEN RESPONSE SECRET", { status: 200 }));
    const error = await fetchGoogleAccessToken(fetchMock as typeof fetch, credentials, "テスト認証").catch((caught: unknown) => caught);
    expect((error as Error).message).toBe("テスト認証の応答を解析できません。");
  });

  it.each([null, [], "primitive", {}, { access_token: 1 }, { access_token: "  " }])(
    "rejects a malformed access_token payload %j",
    async (body) => {
      const fetchMock = vi.fn(async () => tokenResponse(body));
      const error = await fetchGoogleAccessToken(fetchMock as typeof fetch, credentials, "テスト認証").catch((caught: unknown) => caught);
      expect((error as Error).message).toBe("テスト認証の応答が不正です。");
    },
  );
});

describe("isRecord", () => {
  it("accepts plain objects and rejects arrays, null, and primitives", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("string")).toBe(false);
  });
});
