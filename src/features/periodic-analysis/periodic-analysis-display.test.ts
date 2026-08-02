import { describe, expect, it } from "vitest";
import { formatDifference } from "./periodic-analysis-display";

describe("formatDifference", () => {
  it.each([
    [1.25, 1, { text: "+1.3", tone: "positive" }],
    [-1.25, 1, { text: "-1.3", tone: "negative" }],
    [0, 1, { text: "0.0", tone: "neutral" }],
    [null, 1, { text: "—", tone: "missing" }],
  ] as const)("formats %s without inferring the tone from text", (value, digits, expected) => {
    expect(formatDifference(value, digits)).toEqual(expected);
  });
});
