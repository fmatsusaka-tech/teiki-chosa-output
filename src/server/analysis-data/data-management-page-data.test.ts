import { describe, expect, it, vi } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { loadDataManagementPageData } from "./data-management-page-data";

const record = { id: "id-1", activationStatus: null, dataStatus: "取消" } as AnalysisDataRecord;

describe("loadDataManagementPageData", () => {
  it("returns a visibility summary when Input records load successfully", async () => {
    const result = await loadDataManagementPageData({ loadRecords: async () => [record], logError: vi.fn() });

    expect(result.dataError).toBeNull();
    expect(result.visibilitySummary).toMatchObject({ totalEnabledRecords: 1, hiddenFromEveryScreen: [{ id: "id-1" }] });
  });

  it("reports a sanitized error without leaking Input failure details", async () => {
    const logError = vi.fn();
    const result = await loadDataManagementPageData({
      loadRecords: async () => { throw new Error("input detail"); },
      logError,
    });

    expect(result.visibilitySummary).toBeNull();
    expect(result.dataError).toEqual(expect.any(String));
    expect(result.dataError).not.toContain("input detail");
    expect(logError).toHaveBeenCalled();
  });
});
