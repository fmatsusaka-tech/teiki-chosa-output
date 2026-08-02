import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./orchard-comparison-client.tsx", import.meta.url), "utf8");

describe("orchard comparison cascading filters", () => {
  it("renders variety, orchard, and treatment controls in that order", () => {
    const variety = component.indexOf("<label>品種");
    const orchard = component.indexOf("<label>園地");
    const treatment = component.indexOf("<label>区");

    expect(variety).toBeGreaterThan(-1);
    expect(orchard).toBeGreaterThan(variety);
    expect(treatment).toBeGreaterThan(orchard);
    expect(component).not.toContain("園地・処理区");
  });

  it("offers all treatments without merging or averaging records", () => {
    expect(component).toContain('<option value="all">すべて</option>');
    expect(component).toContain('treatment: value === "all" ? undefined');
  });
});
