import { describe, expect, it } from "vitest";
import { analysisDataHeaders, isIncludedInAnalysis } from "./analysis-data";

describe("analysis data contract", () => {
  it("uses 調査データ header names", () => {
    expect(analysisDataHeaders.id).toBe("登録ID");
    expect(analysisDataHeaders.averageDiameter).toBe("横径平均");
  });

  it("includes standard and missing-observation statuses, with 要確認 opt-in", () => {
    for (const status of ["正常", "横径なし", "糖度なし", "酸度なし"]) {
      expect(isIncludedInAnalysis({ dataStatus: status })).toBe(true);
    }
    expect(isIncludedInAnalysis({ dataStatus: "要確認" })).toBe(false);
    expect(isIncludedInAnalysis({ dataStatus: "要確認" }, { includeNeedsReview: true })).toBe(true);
    expect(isIncludedInAnalysis({ dataStatus: "取消" })).toBe(false);
    expect(isIncludedInAnalysis({ dataStatus: "削除" })).toBe(false);
    expect(isIncludedInAnalysis({ dataStatus: "未知" })).toBe(false);
  });
});
