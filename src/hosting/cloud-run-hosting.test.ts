import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

describe("Cloud Run hosting configuration", () => {
  it("uses standalone output without GitHub Pages path settings", () => {
    const config = read("next.config.ts");

    expect(config).toContain('output: "standalone"');
    expect(config).not.toContain("basePath");
    expect(config).not.toContain("assetPrefix");
    expect(config).not.toContain("teiki-chosa-system");
    expect(config).not.toContain('output: "export"');
  });

  it("retires the Pages workflow without changing the verification workflow permissions", () => {
    expect(existsSync(resolve(root, ".github/workflows/nextjs.yml"))).toBe(false);

    const ci = read(".github/workflows/ci.yml");
    expect(ci).not.toContain("pages: write");
    expect(ci).not.toContain("id-token: write");
    expect(ci).toContain("docker build --tag teiki-chosa-output:test .");
  });

  it("runs the standalone server as a non-root user", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain("FROM node:20-bookworm-slim");
    expect(dockerfile).toContain("RUN npm ci");
    expect(dockerfile).toContain("ENV PORT=8080");
    expect(dockerfile).toContain("ENV HOSTNAME=0.0.0.0");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
    expect(dockerfile).not.toMatch(/(?:ARG|ENV)\s+.*(?:PRIVATE_KEY|SERVICE_ACCOUNT|SECRET)/);
  });

  it("excludes local credentials and Git history from the Docker context", () => {
    const dockerignore = read(".dockerignore");

    for (const required of [
      ".git",
      ".github",
      ".next",
      "out",
      "node_modules",
      ".prediction-cli",
      ".env",
      ".env.*",
      "**/*.json",
      "!package.json",
      "!package-lock.json",
      "!tsconfig.json",
      "!tsconfig.scripts.json",
      "**/*service-account*.json",
      "**/*private-key*.json",
      "**/*.pem",
      "**/*.key",
    ]) {
      expect(dockerignore.split(/\r?\n/)).toContain(required);
    }
  });
});
