import { createSign } from "node:crypto";

type FetchImplementation = typeof fetch;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export class GoogleSheetsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleSheetsAuthError";
  }
}

const base64url = (value: string | Buffer): string =>
  Buffer.from(value).toString("base64url");

const createJwtAssertion = (email: string, privateKey: string, scope: string): string => {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64url(
      JSON.stringify({
        iss: email,
        scope,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  ].join(".");
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
};

export type GoogleServiceAccountCredentials = {
  email: string;
  privateKey: string;
  scope: string;
};

/**
 * Exchanges a Google service account key for an OAuth access token via the
 * JWT bearer flow. Callers own credential sourcing (Reader vs Writer env
 * vars) and error-code classification; this only centralizes the JWT/token
 * mechanics shared by every Google Sheets caller in this repo.
 */
export const fetchGoogleAccessToken = async (
  fetchImpl: FetchImplementation,
  credentials: GoogleServiceAccountCredentials,
  errorContext: string,
): Promise<string> => {
  let assertion: string;
  try {
    assertion = createJwtAssertion(credentials.email, credentials.privateKey, credentials.scope);
  } catch {
    throw new GoogleSheetsAuthError(`${errorContext}の署名準備に失敗しました。`);
  }
  let response: Response;
  try {
    response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
  } catch {
    throw new GoogleSheetsAuthError(`${errorContext}への接続に失敗しました。`);
  }
  if (!response.ok) {
    throw new GoogleSheetsAuthError(`${errorContext}に失敗しました: HTTP ${response.status}`);
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new GoogleSheetsAuthError(`${errorContext}の応答を解析できません。`);
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.access_token !== "string" ||
    parsed.access_token.trim() === ""
  ) {
    throw new GoogleSheetsAuthError(`${errorContext}の応答が不正です。`);
  }
  return parsed.access_token;
};
