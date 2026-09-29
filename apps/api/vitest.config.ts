import { defineConfig } from "vitest/config";

const TEST_DB = "postgres://convivium:convivium@localhost:5432/convivium_test";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Una sola base compartida: los archivos corren en serie.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: TEST_DB,
      JWT_SECRET: "clave-solo-para-pruebas-123456",
      CONVIVIUM_MODE: "edge",
      LOG_LEVEL: process.env.LOG_LEVEL ?? "silent",
    },
  },
});
