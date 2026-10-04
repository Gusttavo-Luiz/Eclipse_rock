import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

// Cada processo de teste usa a própria pasta de dados: arquivos rodam em paralelo e alguns apagam a pasta ao terminar.
const dir = path.join(os.tmpdir(), `eclipse-rock-test-${process.pid}-${process.env.VITEST_POOL_ID ?? 0}`);
process.env.DATA_DIR = dir;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
