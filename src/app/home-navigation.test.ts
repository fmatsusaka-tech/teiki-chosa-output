import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const featureScreens = [
  "./analysis/periodic-analysis-client.tsx",
  "./orchards/orchard-analysis-client.tsx",
  "./orchards/compare/orchard-comparison-client.tsx",
  "./predictions/prediction-dashboard.tsx",
  "./predictions/page.tsx",
];

describe("feature screen home navigation", () => {
  it.each(featureScreens)("links %s back to the home screen", (path) => {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    expect(source).toContain('className="home-link" href="/"');
    expect(source).toContain("← ホーム");
  });

  it("uses a clearly tappable text link", () => {
    const stylesheet = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
    expect(stylesheet).toMatch(/\.home-link\s*\{[^}]*min-height:\s*36px/);
    expect(stylesheet).toMatch(/\.home-link\s*\{[^}]*text-decoration:\s*none/);
  });
});
