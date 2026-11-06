import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// The files here don't exist, so type-aware rules step aside and the real config does the rest.
const eslint = new ESLint({
  cwd: ROOT,
  overrideConfig: [tseslint.configs.disableTypeChecked],
});

async function messagesFor(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map(({ ruleId }) => ruleId);
}

describe("layer boundaries", () => {
  it.each([
    ["packages/core/src/x.ts", 'import "react";'],
    ["packages/core/src/x.ts", 'import "node:fs";'],
    ["packages/core/src/x.ts", 'import "drizzle-orm";'],
    ["packages/core/src/x.ts", 'import "@scroll-spark/ui/reveal";'],
    ["packages/api/src/x.ts", 'import "@anthropic-ai/sdk";'],
    ["packages/ui/src/x.tsx", 'import "@scroll-spark/api/react";'],
    ["apps/extension/src/x.ts", 'import "@scroll-spark/api/router";'],
    ["apps/web/src/features/x.tsx", 'import "drizzle-orm";'],
    ["packages/core/src/a/x.ts", 'import "../../b/y";'],
  ])("%s refuses %s", async (filePath, code) => {
    await expect(messagesFor(filePath, code)).resolves.toContain("no-restricted-imports");
  });

  it("keeps allowed imports working", async () => {
    const code = 'import "zod";\nimport "../errors/app-error";\n';

    await expect(messagesFor("packages/core/src/ping/x.ts", code)).resolves.not.toContain(
      "no-restricted-imports",
    );
  });
});

describe("code rules", () => {
  it.each([
    ["packages/core/src/x.ts", "process.env.X;", "no-restricted-properties"],
    ["packages/core/src/x.ts", "console.log(1);", "no-console"],
    ["packages/core/src/index.ts", "export {};", "no-restricted-syntax"],
    ["packages/core/src/x.ts", "export default 1;", "no-restricted-syntax"],
  ])("%s refuses %s", async (filePath, code, rule) => {
    await expect(messagesFor(filePath, code)).resolves.toContain(rule);
  });
});
