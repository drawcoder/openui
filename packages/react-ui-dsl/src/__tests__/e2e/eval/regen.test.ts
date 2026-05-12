import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { generateDsl } = vi.hoisted(() => ({
  generateDsl: vi.fn(),
}));

vi.mock("../llm.ts", () => ({
  generateDsl,
  getConfiguredLlmModel: vi.fn(() => "test-model"),
}));

vi.mock("./run-manifest.ts", () => ({
  markPhaseDone: vi.fn(),
}));

import { regenFixtures, snapshotsDirForSuite } from "./regen.ts";
import type { BenchmarkCase } from "../benchmark-loader.ts";

const stagingBase = resolve(__dirname, ".regen-staging");
const snapshotsDir = snapshotsDirForSuite("e2e");

function makeFixture(id: string): BenchmarkCase {
  return { id, prompt: `render ${id}`, dataModel: {}, evalHints: [], taxonomy: [] };
}

describe("regenFixtures", () => {
  const testRunId = `test_${Date.now()}`;

  beforeEach(() => {
    generateDsl.mockReset();
    process.env["LLM_API_KEY"] = "test-key";
  });

  afterEach(() => {
    const stagingDir = resolve(stagingBase, testRunId);
    if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true, force: true });
    delete process.env["LLM_API_KEY"];
    delete process.env["EVAL_REGEN_CONCURRENCY"];
  });

  it("writes all generated DSL files to snapshots dir on full success", async () => {
    const fixtures = [makeFixture("f-a"), makeFixture("f-b")];
    generateDsl.mockResolvedValue("root = Gauge()");

    const snapshotA = resolve(snapshotsDir, "f-a.dsl");
    const snapshotB = resolve(snapshotsDir, "f-b.dsl");
    // clean up before and after
    [snapshotA, snapshotB].forEach((p) => { if (existsSync(p)) rmSync(p); });

    try {
      const { success } = await regenFixtures(fixtures, { runId: testRunId, suite: "e2e" });
      expect(success).toBe(true);
      expect(existsSync(snapshotA)).toBe(true);
      expect(existsSync(snapshotB)).toBe(true);
    } finally {
      [snapshotA, snapshotB].forEach((p) => { if (existsSync(p)) rmSync(p); });
    }
  });

  it("throws and preserves staging when any fixture fails", async () => {
    const fixtures = [makeFixture("f-ok"), makeFixture("f-fail")];
    generateDsl.mockImplementation(async ({ prompt }: { prompt: string }) => {
      if (prompt.includes("f-fail")) throw new Error("api error");
      return "root = Gauge()";
    });

    const stagingDir = resolve(stagingBase, testRunId);
    await expect(regenFixtures(fixtures, { runId: testRunId, suite: "e2e" })).rejects.toThrow("f-fail");
    // staging kept for debugging
    expect(existsSync(stagingDir)).toBe(true);
    // snapshot for f-ok must NOT have been written (atomic: all-or-nothing)
    expect(existsSync(resolve(snapshotsDir, "f-ok.dsl"))).toBe(false);
  });

  it("respects EVAL_REGEN_CONCURRENCY cap", async () => {
    process.env["EVAL_REGEN_CONCURRENCY"] = "2";
    let active = 0;
    let peak = 0;

    generateDsl.mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return "root = X()";
    });

    const fixtures = Array.from({ length: 6 }, (_, i) => makeFixture(`fc-${i}`));
    const snapshotPaths = fixtures.map((f) => resolve(snapshotsDir, `${f.id}.dsl`));

    try {
      await regenFixtures(fixtures, { runId: testRunId, suite: "e2e" });
      expect(peak).toBeLessThanOrEqual(2);
    } finally {
      snapshotPaths.forEach((p) => { if (existsSync(p)) rmSync(p); });
    }
  });
});
