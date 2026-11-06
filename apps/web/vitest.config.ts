import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
    // Postgres tests reset one shared database, so test files can't overlap.
    fileParallelism: false,
  },
});
