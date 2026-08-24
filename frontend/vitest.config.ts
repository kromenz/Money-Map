import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Modulos puros, sem DOM -- nao e preciso jsdom.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
