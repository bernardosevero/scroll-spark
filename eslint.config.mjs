import eslint from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const SERVER_ONLY = ["drizzle-orm", "drizzle-orm/*", "@neondatabase/*", "@anthropic-ai/*"];
const HOSTS = ["next", "next/*", "wxt", "wxt/*", "#imports"];
const ALL_NODE = ["node:*"];

/** Builds a no-restricted-imports rule that names the layer's boundary in its message. */
function boundary(layer, group, extra = {}) {
  return {
    "no-restricted-imports": [
      "error",
      {
        ...extra,
        patterns: [
          ...(extra.patterns ?? []),
          { group, message: `${layer}. See "Where code goes" in AGENTS.md.` },
          { group: ["../../*"], message: "Import across features through package exports." },
        ],
      },
    ],
  };
}

export default defineConfig([
  globalIgnores([
    "**/.next/**",
    "**/.output/**",
    "**/.wxt/**",
    "**/.turbo/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/next-env.d.ts",
    "apps/web/drizzle/**",
  ]),

  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "no-console": "error",
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Read configuration through apps/web/src/server/env.ts.",
        },
      ],
    },
  },

  // `expect(fake.method)` passes a method around on purpose.
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: { "@typescript-eslint/unbound-method": "off" },
  },

  {
    files: ["**/*.mjs", "**/*.config.ts"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { "no-restricted-properties": "off" },
  },

  // Packages expose files through package.json `exports`, so barrels have no job to do.
  {
    files: ["apps/*/src/**/index.{ts,tsx}", "packages/*/src/**/index.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "Program", message: "Name the file after what it holds; no barrel files." },
      ],
    },
  },

  // Hosts need default exports for their frameworks. Shared packages use named ones.
  {
    files: ["packages/*/src/**/*.{ts,tsx}"],
    ignores: ["packages/*/src/**/index.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "ExportDefaultDeclaration", message: "Use a named export." },
      ],
    },
  },

  // Layer boundaries.
  {
    files: ["packages/core/src/**/*.{ts,tsx}"],
    rules: boundary("core is portable business logic with injected dependencies", [
      "react",
      "react-dom",
      "motion",
      "motion/*",
      "@trpc/*",
      "@tanstack/*",
      "@scroll-spark/api",
      "@scroll-spark/api/*",
      "@scroll-spark/ui",
      "@scroll-spark/ui/*",
      ...HOSTS,
      ...ALL_NODE,
      ...SERVER_ONLY,
    ]),
  },
  {
    files: ["packages/api/src/**/*.{ts,tsx}"],
    rules: boundary("api routers forward to services and hold no I/O", [
      "@scroll-spark/ui",
      "@scroll-spark/ui/*",
      "motion",
      "motion/*",
      ...HOSTS,
      ...ALL_NODE,
      ...SERVER_ONLY,
    ]),
  },
  {
    files: ["packages/ui/src/**/*.{ts,tsx}"],
    rules: boundary("ui renders props and holds no data access", [
      "@trpc/*",
      "@tanstack/*",
      "@scroll-spark/api",
      "@scroll-spark/api/*",
      ...HOSTS,
      ...ALL_NODE,
      ...SERVER_ONLY,
    ]),
  },
  {
    files: ["apps/extension/src/**/*.{ts,tsx}"],
    rules: boundary("the extension is a thin client of the API", [
      "next",
      "next/*",
      "@scroll-spark/api/router",
      "@scroll-spark/api/init",
      ...ALL_NODE,
      ...SERVER_ONLY,
    ]),
  },
  {
    files: ["apps/web/src/app/**/*.{ts,tsx}", "apps/web/src/features/**/*.{ts,tsx}"],
    rules: boundary("pages and features reach the database and SDKs through src/server", [
      ...SERVER_ONLY,
    ]),
  },

  // Next.js rules apply to the website only.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [nextVitals],
    settings: { next: { rootDir: "apps/web" } },
  },
  {
    files: ["apps/web/src/server/env.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  {
    files: ["apps/web/src/server/logger.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["apps/web/e2e/**/*.ts", "apps/web/playwright.config.ts", "**/*.pg.test.ts"],
    rules: { "no-restricted-properties": "off" },
  },
]);
