import { describe, expect, it } from "vitest";
import { getFruitSizeCategory } from "./fruit-size";

describe("getFruitSizeCategory", () => {
  it.each([
    [49.9, "3S"],
    [50.0, "2S"],
    [54.9, "2S"],
    [55.0, "S"],
    [60.9, "S"],
    [61.0, "M"],
    [66.9, "M"],
    [67.0, "L"],
    [72.9, "L"],
    [73.0, "2L"],
    [79.9, "2L"],
    [80.0, "3L"],
  ] as const)("classifies %smm as %s", (diameterMm, expected) => {
    expect(getFruitSizeCategory(diameterMm)).toBe(expected);
  });

  it("returns null for null", () => {
    expect(getFruitSizeCategory(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(getFruitSizeCategory(undefined)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(getFruitSizeCategory(NaN)).toBeNull();
  });
});
