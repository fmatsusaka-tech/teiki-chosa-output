import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STARTER_MARKER = "STARTER_PLACEHOLDER";

const requiredFiles = [
  "README.md",
  "VISION.md",
  "REQUIREMENTS.md",
  "ARCHITECTURE.md",
  "ROADMAP.md",
  "AGENTS.md",
  "docs/agents/HANDOFF.md",
];

// AI Project Starterのスキャフォールド用プレースホルダ。本リポジトリは
// Bootstrapではなく既存プロジェクト導入モード（docs/agents/ADOPT_EXISTING_PROJECT.md）
// で初期化したため、docs/input配下の要件原文保全チェックは対象外とする。
const placeholderPatterns = [
  /\[名称\]/,
  /\[誰が、どんな場面で、何に困っているか\]/,
  /\[このプロダクトが解決すること\]/,
  /\[主利用者 \/ 管理者 \/ 関係者\]/,
  /\[定量指標\]/,
  /\[定性指標\]/,
  /\[明確な非対象\]/,
  /UC-001: \[名称\]/,
  /Issue: 未設定/,
  /Primary role \/ agent: 未設定/,
  /Review Level: 未設定/,
  /YYYY-MM-DD HH:MM TZ/,
];

export function collectInitializationFailures(root) {
  const failures = [];

  for (const file of requiredFiles) {
    const path = resolve(root, file);
    if (!existsSync(path)) {
      failures.push(`${file}: required file is missing`);
      continue;
    }

    const content = readFileSync(path, "utf8");
    if (content.includes(STARTER_MARKER)) {
      failures.push(`${file}: ${STARTER_MARKER} remains`);
    }
    for (const pattern of placeholderPatterns) {
      if (pattern.test(content)) failures.push(`${file}: unresolved placeholder ${pattern}`);
    }
  }

  const readmePath = resolve(root, "README.md");
  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, "utf8");
    if (/^#\s+AI Project Starter(?:\s|$)/m.test(readme)) {
      failures.push("README.md: title is still AI Project Starter");
    }
  }

  const packagePath = resolve(root, "package.json");
  if (!existsSync(packagePath)) {
    failures.push("package.json: required file is missing");
  } else {
    try {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      if (packageJson.name === "ai-project-starter") {
        failures.push("package.json: project name is still ai-project-starter");
      }
      const description = String(packageJson.description ?? "");
      if (/AI-assisted.*starter|Bootstrap starter|AI Project Starter/i.test(description)) {
        failures.push("package.json: project description is still the starter description");
      }
    } catch (error) {
      failures.push(`package.json: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  return failures;
}

export function runInitializationCheck({ root }) {
  return { failures: collectInitializationFailures(root) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const root = resolve(import.meta.dirname, "..");
  const result = runInitializationCheck({ root });

  if (result.failures.length > 0) {
    console.error("Project initialization is incomplete:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("Project initialization check passed.");
}
