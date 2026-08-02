import { describe, expect, it, vi } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { loadPeriodicAnalysisPageData } from "./periodic-analysis-page-data";

const record = { id: "id-1" } as AnalysisDataRecord;

describe("loadPeriodicAnalysisPageData", () => {
  it("returns Input records and prediction results when both sources are valid", async () => {
    const prediction = { id: "id-1" } as never;
    const bundle = {} as never;
    const buildPredictions = vi.fn(() => [prediction]);
    const result = await loadPeriodicAnalysisPageData({
      loadRecords: async () => [record],
      loadPredictionMaster: async () => ({ bundle, expectedDataVersion: "1.0.1" }),
      buildPredictions,
      logError: vi.fn(),
    });
    expect(result).toEqual({ records: [record], predictions: [prediction], dataError: null, predictionError: null });
    expect(buildPredictions).toHaveBeenCalledWith([record], bundle, "1.0.1");
  });

  it("treats Input failures as a page-level failure without loading predictions", async () => {
    const loadPredictionMaster = vi.fn();
    const result = await loadPeriodicAnalysisPageData({
      loadRecords: async () => { throw new Error("input detail"); },
      loadPredictionMaster,
      logError: vi.fn(),
    });
    expect(result).toMatchObject({ records: [], predictions: [], dataError: expect.any(String), predictionError: null });
    expect(loadPredictionMaster).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("input detail");
  });

  it.each(["authentication failed", "dataVersion mismatch"])("keeps Input data when Prediction Master reports %s", async (detail) => {
    const result = await loadPeriodicAnalysisPageData({
      loadRecords: async () => [record],
      loadPredictionMaster: async () => { throw new Error(detail); },
      logError: vi.fn(),
    });
    expect(result).toMatchObject({ records: [record], predictions: [], dataError: null, predictionError: expect.any(String) });
    expect(result.predictionError).not.toContain(detail);
  });
});
