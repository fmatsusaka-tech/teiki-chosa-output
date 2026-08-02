import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./periodic-analysis-client.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../globals.css", import.meta.url), "utf8");

describe("periodic analysis table layout", () => {
  it("uses one horizontal scroll container for the heading and every row", () => {
    expect(component.match(/className="analysis-table-scroll"/g)).toHaveLength(1);
    expect(component).not.toContain("analysis-scroll-area");
    expect(component).toContain("group.rows.map");
    expect(stylesheet).toMatch(/\.analysis-table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  });

  it("keeps the identity cells visible without making the page itself scroll", () => {
    expect(stylesheet).toMatch(/\.analysis-table-scroll\s*\{[^}]*max-width:\s*100%/);
    expect(stylesheet).toMatch(/\.analysis-identity\s*\{[^}]*position:\s*sticky[^}]*left:\s*0/);
  });
});
