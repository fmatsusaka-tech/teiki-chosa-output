import { describe, expect, it, vi } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import type { PredictionMasterBundle } from "../../features/prediction-data/prediction-master.types";
import { createPredictionPageDataLoader } from "./prediction-page-data";

describe("createPredictionPageDataLoader", () => {
  it("InputとPrediction Masterを1回ずつ取得する", async () => {
    const getAll = vi.fn(async () => [] as AnalysisDataRecord[]);
    const read = vi.fn(async () => ({ models: [], coefficients: [] }) as PredictionMasterBundle);
    const load = createPredictionPageDataLoader({
      inputRepository: { getAll },
      masterRepository: { read },
      spreadsheetId: "masked-target",
      expectedDataVersion: "1.0.1",
    });

    await expect(load()).rejects.toThrow("予測モデル数が6件ではありません");
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith({
      spreadsheetId: "masked-target",
      expectedDataVersion: "1.0.1",
    });
  });

  it("設定不足時はRepositoryを呼ばない", async () => {
    const getAll = vi.fn();
    const read = vi.fn();
    const load = createPredictionPageDataLoader({
      inputRepository: { getAll },
      masterRepository: { read },
      spreadsheetId: undefined,
      expectedDataVersion: "1.0.1",
    });

    await expect(load()).rejects.toThrow("期待データ版が設定されていません");
    expect(getAll).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});
