import { describe, expect, it, vi } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { loadNormalizedAnalysisRecords } from "./normalized-analysis-records";

const record = { orchard: "原名", treatment: "元処理" } as AnalysisDataRecord;

describe("loadNormalizedAnalysisRecords", () => {
  it("applies a confirmed mapping, keeping the record's own treatment", async () => {
    await expect(loadNormalizedAnalysisRecords([record], { loadMappings: async () => [{ originalOrchard: "原名", officialOrchard: "正式名", treatment: "処理A", status: "確認済み", precipitationStation: null, temperatureStation: null }], logError: vi.fn() })).resolves.toMatchObject({
      records: [{ orchard: "正式名", treatment: "元処理", originalOrchard: "原名" }], orchardMasterWarning: null,
    });
  });

  it("keeps Input names and returns one sanitized warning when the master fails", async () => {
    const result = await loadNormalizedAnalysisRecords([record], { loadMappings: async () => { throw new Error("low-level secret"); }, logError: vi.fn() });
    expect(result).toMatchObject({ records: [{ orchard: "原名", treatment: "元処理", originalOrchard: "原名" }], orchardMasterWarning: expect.any(String) });
    expect(result.orchardMasterWarning).not.toContain("low-level secret");
  });

  it("障害ログへ低レベル例外やセル値を渡さない", async () => {
    const logError = vi.fn();
    await loadNormalizedAnalysisRecords([record], {
      loadMappings: async () => { throw new Error("sensitive cell content"); },
      logError,
    });

    expect(logError).toHaveBeenCalledWith("Failed to apply orchard name master", "CONTRACT_ERROR");
    expect(JSON.stringify(logError.mock.calls)).not.toContain("sensitive cell content");
  });
});
