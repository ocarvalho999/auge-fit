import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(__dirname, "src"),
  "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          include: ["supabase/tests/**/*.test.ts", "tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["supabase/tests/support/global-setup.ts"],
          hookTimeout: 120_000,
          fileParallelism: false,
          testTimeout: 60_000,
        },
      },
    ],
  },
});
