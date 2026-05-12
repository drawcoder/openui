import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateDsl, getConfiguredLlmModel } from "../llm.ts";
import type { BenchmarkCase } from "../benchmark-loader.ts";
import { markPhaseDone } from "./run-manifest.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVAL_DIR = resolve(__dirname);

export interface RegenOptions {
  runId: string;
  suite: "e2e" | "fuzz" | "benchmark";
  fixtureIds?: string[];
  concurrency?: number;
  strictness?: "standard" | "strict";
}

function getStagingDir(runId: string): string {
  return resolve(EVAL_DIR, ".regen-staging", runId);
}

function resolveConcurrency(totalFixtures: number): number {
  const raw = process.env["EVAL_REGEN_CONCURRENCY"];
  const parsed = raw === undefined ? 6 : Number(raw);
  const safe = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 6;
  return Math.max(1, Math.min(safe, totalFixtures));
}

export function snapshotsDirForSuite(suite: "e2e" | "fuzz" | "benchmark"): string {
  if (suite === "fuzz") return resolve(__dirname, "../fuzz-snapshots");
  if (suite === "benchmark") return resolve(__dirname, "../benchmark-snapshots");
  return resolve(__dirname, "../snapshots");
}

interface RegenResult {
  fixtureId: string;
  success: boolean;
  error?: string;
}

async function regenFixture(
  fixture: BenchmarkCase,
  stagingDir: string,
  strictness: "standard" | "strict",
): Promise<RegenResult> {
  const apiKey = process.env["LLM_API_KEY"];
  if (!apiKey) {
    return {
      fixtureId: fixture.id,
      success: false,
      error: "LLM_API_KEY is not set",
    };
  }

  try {
    const dsl = await generateDsl({
      prompt: fixture.prompt,
      dataModel: fixture.dataModel as Record<string, unknown>,
      strictness,
      model: getConfiguredLlmModel(),
      apiKey,
    });

    const stagingPath = resolve(stagingDir, `${fixture.id}.dsl`);
    writeFileSync(stagingPath, dsl, "utf-8");

    return { fixtureId: fixture.id, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      fixtureId: fixture.id,
      success: false,
      error: message,
    };
  }
}

/**
 * Generate DSL for fixtures concurrently with staging + atomic rename.
 * All fixtures must succeed before any file is written to the snapshot directory.
 */
export async function regenFixtures(
  fixtures: BenchmarkCase[],
  options: RegenOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<{ results: RegenResult[]; success: boolean }> {
  const concurrency = options.concurrency ?? resolveConcurrency(fixtures.length);
  const strictness = options.strictness ?? "standard";
  const stagingDir = getStagingDir(options.runId);

  // Create staging directory
  mkdirSync(stagingDir, { recursive: true });

  const results: RegenResult[] = new Array(fixtures.length);
  let cursor = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= fixtures.length) return;
      results[i] = await regenFixture(fixtures[i]!, stagingDir, strictness);
      completed++;
      onProgress?.(completed, fixtures.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  // Check if all succeeded
  const allSuccess = results.every((r) => r.success);

  if (allSuccess) {
    // Atomic rename: move all staging files to snapshot directory
    const snapshotsDir = snapshotsDirForSuite(options.suite);
    mkdirSync(snapshotsDir, { recursive: true });

    for (const result of results) {
      const stagingPath = resolve(stagingDir, `${result.fixtureId}.dsl`);
      const targetPath = resolve(snapshotsDir, `${result.fixtureId}.dsl`);
      renameSync(stagingPath, targetPath);
    }

    // Clean up staging directory
    rmSync(stagingDir, { recursive: true, force: true });

    // Mark phase as done
    markPhaseDone(options.runId, "regen");

    return { results, success: true };
  } else {
    // Keep staging for debugging, report failures
    const failed = results.filter((r) => !r.success);
    const failedIds = failed.map((r) => r.fixtureId);
    const failedErrors = failed.map((r) => `${r.fixtureId}: ${r.error}`);

    throw new Error(
      `Regen failed for ${failed.length} fixture(s): ${failedIds.join(", ")}\n` +
        `Staging files preserved at: ${stagingDir}\n` +
        `Errors:\n${failedErrors.join("\n")}`,
    );
  }
}

/**
 * Continue regen for fixtures that don't have snapshots yet.
 * Used for recovery after partial regen.
 */
export async function regenMissingFixtures(
  fixtures: BenchmarkCase[],
  options: RegenOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<{ results: RegenResult[]; success: boolean }> {
  const snapshotsDir = snapshotsDirForSuite(options.suite);
  const missing = fixtures.filter(
    (f) => !existsSync(resolve(snapshotsDir, `${f.id}.dsl`)),
  );

  if (missing.length === 0) {
    console.log(`[regen] All ${fixtures.length} fixtures already have snapshots.`);
    return { results: [], success: true };
  }

  console.log(`[regen] ${missing.length} fixtures missing snapshots, generating...`);
  return regenFixtures(missing, options, onProgress);
}