import { describe, expect, it } from "vitest";
import { normalizeGridData } from "./google-sheets-reader";

describe("normalizeGridData", () => {
  it("1000行×56列を作り、空白行・空白セルと物理位置を維持する", () => {
    const grid = normalizeGridData([
      {
        startRow: 4,
        startColumn: 26,
        rowData: [
          {
            values: [
              { formattedValue: "AA5" },
              {},
              { formattedValue: "AC5" },
            ],
          },
          {},
          { values: [{ formattedValue: "AA7" }] },
        ],
      },
    ]);
    expect(grid).toHaveLength(1000);
    expect(grid.every((row) => row.length === 56)).toBe(true);
    expect(grid[4][26].formattedValue).toBe("AA5");
    expect(grid[4][27]).toEqual({});
    expect(grid[4][28].formattedValue).toBe("AC5");
    expect(grid[5][26]).toEqual({});
    expect(grid[6][26].formattedValue).toBe("AA7");
  });
});
