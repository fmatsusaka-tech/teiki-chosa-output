import { describe, expect, it, vi } from "vitest";
import { KishoWeatherRepositoryError, loadKishoWeatherRecords } from "./kisho-weather-repository";

const header = "年月日,降水量（湯浅）,平均気温（川辺）,降水量（川辺・比較用）";

describe("kisho weather repository", () => {
  it("uses a GET-only fixed weather source", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(`${header}\n2026/7/31,1,2,3`, { status: 200 });
    });
    await expect(loadKishoWeatherRecords(fetcher as typeof fetch)).resolves.toHaveLength(2);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("classifies network, HTTP, and malformed body failures without response contents", async () => {
    await expect(loadKishoWeatherRecords(vi.fn(async () => { throw new Error("secret body"); }) as typeof fetch)).rejects.toMatchObject({ code: "FETCH_FAILED" });
    await expect(loadKishoWeatherRecords(vi.fn(async () => new Response("secret body", { status: 503 })) as typeof fetch)).rejects.toMatchObject({ code: "FETCH_FAILED" });
    const malformed = await loadKishoWeatherRecords(vi.fn(async () => new Response("secret body", { status: 200 })) as typeof fetch).catch((error: unknown) => error);
    expect(malformed).toBeInstanceOf(KishoWeatherRepositoryError);
    expect((malformed as Error).message).not.toContain("secret body");
  });
});
