export type FruitSizeCategory = "3S" | "2S" | "S" | "M" | "L" | "2L" | "3L";

/**
 * Diameter (mm) size thresholds, ordered smallest to largest. Each entry's
 * `lessThan` is the exclusive upper bound of its category (lower bound is the
 * previous entry's `lessThan`, inclusive). Update only this table to change
 * the size boundaries.
 */
const diameterSizeThresholds: readonly { lessThan: number; category: FruitSizeCategory }[] = [
  { lessThan: 50.0, category: "3S" },
  { lessThan: 55.0, category: "2S" },
  { lessThan: 61.0, category: "S" },
  { lessThan: 67.0, category: "M" },
  { lessThan: 73.0, category: "L" },
  { lessThan: 80.0, category: "2L" },
];
const largestDiameterSizeCategory: FruitSizeCategory = "3L";

/** Classifies a fruit diameter (mm) into a size category. Lower bound inclusive, upper bound exclusive. */
export const getFruitSizeCategory = (diameterMm: number | null | undefined): FruitSizeCategory | null => {
  if (diameterMm === null || diameterMm === undefined || !Number.isFinite(diameterMm)) return null;
  return diameterSizeThresholds.find((threshold) => diameterMm < threshold.lessThan)?.category ?? largestDiameterSizeCategory;
};
