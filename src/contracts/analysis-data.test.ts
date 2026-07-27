import { describe, expect, it } from "vitest";
import { analysisDataHeaders, isIncludedInStandardAnalysis } from "./analysis-data";

describe("analysis data contract", () => {
  it("uses 調査データ header names", () => {
    expect(analysisDataHeaders.id).toBe("登録ID");
    expect(analysisDataHeaders.averageDiameter).toBe("横径平均");
  });

  it("includes only 正常 records in standard analysis", () => {
    expect(isIncludedInStandardAnalysis({ dataStatus: "正常" })).toBe(true);
    expect(isIncludedInStandardAnalysis({ dataStatus: "要確認" })).toBe(false);
  });
});
