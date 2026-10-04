import { defineConfig } from "vitest/config";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["server/tests/**/*.test.ts", "client/src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["server/tests/setup.ts"],
    env: {
      NODE_ENV: "test",
      DATA_DIR: path.join(os.tmpdir(), `eclipse-rock-test-${process.pid}`),
      APP_SECRET: "test-secret-test-secret-test-secret-123",
    },
  },
});
