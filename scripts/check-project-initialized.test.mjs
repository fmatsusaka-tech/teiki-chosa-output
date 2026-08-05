import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectInitializationFailures } from "./check-project-initialized.mjs";

const roots = [];

function write(root, path, content) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

function makeInitializedProject() {
  const root = mkdtempSync(resolve(tmpdir(), "starter-check-"));
  roots.push(root);
  const docs = {
    "README.md": "# Citrus Survey App\n\nProject overview.\n",
    "VISION.md": "# Vision\n\nProject: Citrus Survey App\n",
    "REQUIREMENTS.md": "# Requirements\n\n## UC-001: Submit survey data\n",
    "ARCHITECTURE.md": "# Architecture\n\nWeb app and database.\n",
    "ROADMAP.md": "# Roadmap\n\n## Phase 1\n- [ ] MVP\n",
    "AGENTS.md": "# AGENTS.md\n\nProject name: Citrus Survey App\n",
    "docs/agents/HANDOFF.md": "# Agent Handoff\n\nIssue: #1\nReview Level: Low\n",
  };
  for (const [path, content] of Object.entries(docs)) write(root, path, content);
  write(root, "package.json", JSON.stringify({
    name: "citrus-survey-app",
    version: "0.1.0",
    description: "Survey data entry for citrus farms",
  }));
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

describe("collectInitializationFailures", () => {
  it("accepts an initialized project", () => {
    expect(collectInitializationFailures(makeInitializedProject())).toEqual([]);
  });

  it("accepts this repository's own root", () => {
    expect(collectInitializationFailures(resolve(import.meta.dirname, ".."))).toEqual([]);
  });

  it("rejects a starter README marker and title", () => {
    const root = makeInitializedProject();
    write(root, "README.md", "<!-- STARTER_PLACEHOLDER:README -->\n# AI Project Starter v4.5\n");
    const failures = collectInitializationFailures(root);
    expect(failures).toContain("README.md: STARTER_PLACEHOLDER remains");
    expect(failures).toContain("README.md: title is still AI Project Starter");
  });

  it("rejects the starter package identity", () => {
    const root = makeInitializedProject();
    write(root, "package.json", JSON.stringify({
      name: "ai-project-starter",
      version: "4.5.0",
      description: "Bootstrap starter for AI-assisted software development",
    }));
    const failures = collectInitializationFailures(root);
    expect(failures).toContain("package.json: project name is still ai-project-starter");
    expect(failures).toContain("package.json: project description is still the starter description");
  });

  it("reports a missing required file", () => {
    const root = makeInitializedProject();
    rmSync(resolve(root, "ROADMAP.md"));
    expect(collectInitializationFailures(root)).toContain("ROADMAP.md: required file is missing");
  });
});
