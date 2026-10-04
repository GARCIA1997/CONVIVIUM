import { BaseSequencer, type WorkspaceSpec } from "vitest/node";
import { defineConfig } from "vitest/config";

/** Orden fijo por nombre: los archivos comparten la base y dependen del estado que deja el anterior. */
class ByName extends BaseSequencer {
  async sort(files: WorkspaceSpec[]) {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
}

const TEST_DB = "postgres://convivium:convivium@localhost:5432/convivium_test";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Una sola base compartida: los archivos corren en serie.
    fileParallelism: false,
    sequence: { sequencer: ByName },
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
