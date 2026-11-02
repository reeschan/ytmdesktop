import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// https://vitest.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "~shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
      "~assets": fileURLToPath(new URL("./src/assets", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
