import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./orchard-analysis-client.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../globals.css", import.meta.url), "utf8");

describe("orchard analysis cascading filters", () => {
  it("renders variety, orchard, and treatment controls in that order", () => {
    const variety = component.indexOf("<label>品種");
    const orchard = component.indexOf("<label>園地");
    const treatment = component.indexOf("<label>区");

    expect(variety).toBeGreaterThan(-1);
    expect(orchard).toBeGreaterThan(variety);
    expect(treatment).toBeGreaterThan(orchard);
    expect(component).not.toContain("園地・処理区");
  });

  it("uses a single-column control flow on smartphone widths", () => {
    expect(stylesheet).toMatch(/\.orchard-filters\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  });
});
