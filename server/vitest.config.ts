import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Two projects (Section 12.3): fast offline unit, contract and connector
// tests in Node, and Worker integration tests inside the Workers runtime.
export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      include: ["src/core/**", "src/rag/**"],
      reporter: ["text-summary"],
      // NFR-13: at least 80% line coverage of the core library.
      thresholds: { lines: 80 },
    },
    projects: [
      { test: { name: "unit", include: ["test/unit/**/*.test.ts"], environment: "node" } },
      {
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.toml" } })],
        test: { name: "worker", include: ["test/worker/**/*.test.ts"] },
      },
    ],
  },
});
