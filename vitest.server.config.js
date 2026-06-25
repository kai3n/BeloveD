import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.js"],
    setupFiles: ["server/__tests__/setup.js"],
    fileParallelism: false,
    hookTimeout: 30000,
  },
});
