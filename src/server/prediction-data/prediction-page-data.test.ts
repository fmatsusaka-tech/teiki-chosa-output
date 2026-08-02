import { describe, expect, it, vi } from "vitest";
import type { PredictionMasterBundle } from "../../features/prediction-data/prediction-master.types";
import { createPredictionPageDataLoader } from "./prediction-page-data";

describe("createPredictionPageDataLoader", () => {
  it("Prediction Masterだけを1回取得する", async () => {
    const read = vi.fn(async () => ({ models: [], coefficients: [] }) as PredictionMasterBundle);
    const load = createPredictionPageDataLoader({
      masterRepository: { read },
      spreadsheetId: "masked-target",
      expectedDataVersion: "1.0.1",
    });

    await expect(load()).resolves.toEqual({
      bundle: { models: [], coefficients: [] },
      expectedDataVersion: "1.0.1",
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith({
      spreadsheetId: "masked-target",
      expectedDataVersion: "1.0.1",
    });
  });

  it("設定不足時はRepositoryを呼ばない", async () => {
    const read = vi.fn();
    const load = createPredictionPageDataLoader({
      masterRepository: { read },
      spreadsheetId: undefined,
      expectedDataVersion: "1.0.1",
    });

    await expect(load()).rejects.toThrow("期待データ版が設定されていません");
    expect(read).not.toHaveBeenCalled();
  });
});
