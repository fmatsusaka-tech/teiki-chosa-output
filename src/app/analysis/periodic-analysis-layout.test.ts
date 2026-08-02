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

  it("keeps the column headings in normal table flow instead of pushing them over data rows", () => {
    expect(stylesheet).toMatch(/\.analysis-column-headings\s*\{[^}]*position:\s*relative/);
    expect(stylesheet).not.toMatch(/\.analysis-column-headings\s*\{[^}]*top:\s*140px/);
    expect(stylesheet).not.toMatch(/\.analysis-column-headings\s*\{[^}]*top:/);
  });

  it("offers selectable Yuasa and Kawabe rainfall stations", () => {
    expect(component).toContain("降水地点");
    expect(component).toContain('<option value="yuasa">湯浅</option>');
    expect(component).toContain('<option value="kawabe">川辺</option>');
    expect(component).not.toContain("analysis-future-option");
  });
});
