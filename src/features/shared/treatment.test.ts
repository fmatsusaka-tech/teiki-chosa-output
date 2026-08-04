import { describe, expect, it } from "vitest";
import { normalizeTreatment } from "./treatment";

describe("normalizeTreatment", () => {
  it("treats blank, 無処理区, and 処理区なし as the same absence of a treatment", () => {
    expect(normalizeTreatment(null)).toBeNull();
    expect(normalizeTreatment("")).toBeNull();
    expect(normalizeTreatment("　")).toBeNull();
    expect(normalizeTreatment("無処理区")).toBeNull();
    expect(normalizeTreatment("処理区なし")).toBeNull();
  });

  it("keeps a real treatment value unchanged", () => {
    expect(normalizeTreatment("処理1")).toBe("処理1");
  });
});
