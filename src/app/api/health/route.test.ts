import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns only the public health status", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("does not use fetch or read secrets", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const originalEnv = { ...process.env };

    try {
      const response = GET();
      await expect(response.json()).resolves.toEqual({ status: "ok" });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(process.env).toEqual(originalEnv);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
