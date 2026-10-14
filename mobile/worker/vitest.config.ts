import { defineConfig } from "vitest/config";

// Os testes correm em Node 22, que ja tem Request, Response e crypto.subtle
// globais -- o handler nao usa nada que so exista no runtime da Cloudflare.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
