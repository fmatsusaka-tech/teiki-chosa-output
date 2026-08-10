import { describe, expect, it } from "vitest";
import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { buildAnalysisDataInventory } from "./analysis-data-inventory";

const record = (overrides: Partial<AnalysisDataRecord>): AnalysisDataRecord => ({
  id: "id-1", registeredAt: null, measuredAt: "2026-07-01", fiscalYear: 2026, year: 2026, month: 7,
  surveyMonth: "2026-07", surveyPeriod: "前半", orchard: "吉川", variety: "ゆら早生", treatment: null,
  notes: null, diameterCount: null, averageDiameter: 42.1, minimumDiameter: null, maximumDiameter: null,
  brix: 9.3, acidity: 1.4, brixAcidityRatio: null, dataStatus: "正常", activationStatus: null,
  inputMethod: "", enteredBy: null, source: null, ...overrides,
});

describe("buildAnalysisDataInventory", () => {
  it("treats blank and 有効 activation status as enabled", () => {
    const inventory = buildAnalysisDataInventory([
      record({ id: "blank", activationStatus: null }),
      record({ id: "enabled", activationStatus: "有効" }),
    ]);

    expect(inventory).toMatchObject({ totalRecords: 2, enabledRecords: 2, disabledRecords: 0, includedRecords: 2 });
    expect(inventory.entries.map((entry) => entry.state)).toEqual(["included", "included"]);
  });

  it("separates disabled records from enabled records excluded by data status", () => {
    const inventory = buildAnalysisDataInventory([
      record({ id: "disabled", activationStatus: "無効" }),
      record({ id: "cancelled", dataStatus: "取消" }),
      record({ id: "missing-brix", dataStatus: "糖度なし" }),
    ]);

    expect(inventory).toMatchObject({ totalRecords: 3, enabledRecords: 2, disabledRecords: 1, includedRecords: 1, excludedRecords: 1 });
    expect(inventory.entries).toMatchObject([
      { id: "disabled", state: "disabled", reason: "有効状態が「無効」" },
      { id: "cancelled", state: "excluded", reason: "データ状態が分析対象外（取消）" },
      { id: "missing-brix", state: "included", reason: "標準分析対象" },
    ]);
  });

  it("returns unique data statuses in Japanese sort order without mutating input", () => {
    const records = [record({ dataStatus: "正常" }), record({ id: "id-2", dataStatus: "酸度なし" }), record({ id: "id-3", dataStatus: "正常" })];
    const snapshot = structuredClone(records);

    const inventory = buildAnalysisDataInventory(records);

    expect(inventory.dataStatuses).toHaveLength(2);
    expect(new Set(inventory.dataStatuses)).toEqual(new Set(["正常", "酸度なし"]));
    expect(records).toEqual(snapshot);
  });
});
