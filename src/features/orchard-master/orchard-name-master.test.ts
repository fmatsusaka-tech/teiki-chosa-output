import { describe, expect, it } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { applyOrchardNameMaster, decodeOrchardNameMaster, orchardNameMasterHeaders } from "./orchard-name-master";

const row = (overrides: Record<number, unknown> = {}): unknown[] => {
  const result: unknown[] = ["１２号無処理", "12号無処理", "12号", "候補区", "rule", "12号", "高", "確認済み", "", "", ""];
  for (const [index, value] of Object.entries(overrides)) result[Number(index)] = value;
  return result;
};

const record = { orchard: "１２号無処理", treatment: "Input処理" } as AnalysisDataRecord;

describe("decodeOrchardNameMaster", () => {
  it("prioritizes confirmed columns and falls back to candidate columns", () => {
    const mappings = decodeOrchardNameMaster([orchardNameMasterHeaders, row({ 8: "確認名", 9: "確認区" }), row({ 0: "候補のみ", 2: "候補名", 3: "候補区" })]);
    expect(mappings).toMatchObject([
      { officialOrchard: "確認名", treatment: "確認区" },
      { officialOrchard: "候補名", treatment: "候補区" },
    ]);
  });

  it.each(["未確認", "保留", "統合しない"])("keeps the original orchard for %s", (status) => {
    expect(decodeOrchardNameMaster([orchardNameMasterHeaders, row({ 7: status })])[0]).toMatchObject({ officialOrchard: "１２号無処理", treatment: null, status });
  });

  it("rejects duplicate originals and a missing official name", () => {
    expect(() => decodeOrchardNameMaster([orchardNameMasterHeaders, row(), row()])).toThrow("重複");
    expect(() => decodeOrchardNameMaster([orchardNameMasterHeaders, row({ 2: "", 8: "" })])).toThrow("正式園地名");
  });
});

describe("applyOrchardNameMaster", () => {
  it("applies the confirmed orchard name and preserves the input object", () => {
    const before = structuredClone(record);
    const [result] = applyOrchardNameMaster([record], decodeOrchardNameMaster([orchardNameMasterHeaders, row({ 8: "12号", 9: "無処理" })]));
    expect(result).toMatchObject({ orchard: "12号", originalOrchard: "１２号無処理" });
    expect(record).toEqual(before);
  });

  it("keeps the record's own treatment even when a confirmed mapping has a different one (one orchard can have many real treatments)", () => {
    const [result] = applyOrchardNameMaster([record], decodeOrchardNameMaster([orchardNameMasterHeaders, row({ 8: "12号", 9: "無処理" })]));
    expect(result.treatment).toBe("Input処理");
  });

  it("falls back to the mapping's treatment only when the record's own treatment is blank", () => {
    const blankTreatmentRecord = { orchard: "１２号無処理", treatment: null } as AnalysisDataRecord;
    const [result] = applyOrchardNameMaster([blankTreatmentRecord], decodeOrchardNameMaster([orchardNameMasterHeaders, row({ 8: "12号", 9: "無処理" })]));
    expect(result.treatment).toBe("無処理");
  });

  it("keeps a blank treatment blank when neither the record nor the mapping has one", () => {
    const blankTreatmentRecord = { orchard: "１２号無処理", treatment: null } as AnalysisDataRecord;
    const [result] = applyOrchardNameMaster([blankTreatmentRecord], decodeOrchardNameMaster([orchardNameMasterHeaders, row({ 3: "", 8: "12号" })]));
    expect(result.treatment).toBeNull();
  });
});
