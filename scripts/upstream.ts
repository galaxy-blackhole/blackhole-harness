/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Pin ban DSH tham chieu: clone dung commit da ghi nhan vao vendor/dsh-reference (chi doc)
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/// Upstream repository of the harness this project mirrors.
const UPSTREAM = "https://github.com/deepseek-ai/deepseek-harness.git";

/// File that records the pinned commit; the single source of truth for the reference build.
const PIN_FILE = join(import.meta.dir, "..", "docs", "UPSTREAM.md");

/// Target directory inside the repository; git-ignored because it is large and read-only.
const TARGET = join(import.meta.dir, "..", "vendor", "dsh-reference");

/** Reads the pinned commit hash out of docs/UPSTREAM.md (first 40-hex token found). */
function pinnedCommit(): string {
  const text = readFileSync(PIN_FILE, "utf8");
  const match = text.match(/\b[0-9a-f]{40}\b/);
  if (!match) {
    throw new Error(`no 40-character commit hash found in ${PIN_FILE}`);
  }
  return match[0];
}

/**
 * Clones the pinned commit into `vendor/dsh-reference` when it is missing.
 * Deliberately a read-only mirror: the harness source is reference material, never a build input.
 */
function main(): number {
  const commit = pinnedCommit();
  if (existsSync(TARGET)) {
    console.log(`vendor/dsh-reference đã có (pin ${commit})`);
    return 0;
  }
  mkdirSync(join(import.meta.dir, "..", "vendor"), { recursive: true });
  const steps: [string, ...string[]][] = [
    ["git", "init", TARGET],
    ["git", "-C", TARGET, "remote", "add", "origin", UPSTREAM],
    ["git", "-C", TARGET, "fetch", "--depth", "1", "origin", commit],
    ["git", "-C", TARGET, "checkout", "FETCH_HEAD"],
  ];
  for (const step of steps) {
    const [program, ...args] = step;
    const run = Bun.spawnSync([program, ...args], { stdout: "inherit", stderr: "inherit" });
    if (run.exitCode !== 0) {
      console.error(`lệnh thất bại: ${program} ${args.join(" ")}`);
      return run.exitCode ?? 1;
    }
  }
  console.log(`đã pin DSH ${commit} vào vendor/dsh-reference`);
  return 0;
}

process.exit(main());
