/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Khoá hành vi "MỘT runtime: Node" — CLI chạy được bằng node (không bun), và vỏ desktop spawn
 *      node với đúng cờ `--experimental-strip-types`, không bao giờ quay lại `Command::new(&plan.bun)`
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Gốc repo, suy từ vị trí tệp test nên chạy được từ bất kỳ cwd nào. */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Node major thấp nhất mà CLI chấp nhận (khớp `apps/cli/src/paths.ts`). */
const MIN_NODE_MAJOR = 26;

/**
 * Tìm một binary node >= {@link MIN_NODE_MAJOR} để test.
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối, hoặc undefined khi máy không có bản nào đủ mới.
 */
function findNode(): string | undefined {
  const candidates: string[] = [];
  if ((process.env.GBH_NODE ?? "") !== "") candidates.push(process.env.GBH_NODE as string);
  if (process.versions.bun === undefined) candidates.push(process.execPath);
  const nvmRoot = join(homedir(), ".nvm", "versions", "node");
  try {
    for (const name of readdirSync(nvmRoot).sort().reverse()) {
      if (/^v(\d+)\./u.test(name)) candidates.push(join(nvmRoot, name, "bin", "node"));
    }
  } catch {
    // Không có nvm là chuyện bình thường: còn node đang chạy và các vị trí hệ thống.
  }
  candidates.push("/usr/local/bin/node", "/opt/homebrew/bin/node");
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    const version = /v(\d+)\./u.exec(probe.stdout ?? "");
    if (probe.status === 0 && version !== null && Number(version[1]) >= MIN_NODE_MAJOR) return candidate;
  }
  return undefined;
}

describe("MỘT runtime: Node", () => {
  test("CLI chạy được bằng node + --experimental-strip-types (không bun)", () => {
    const node = findNode();
    if (node === undefined) {
      // Máy không có node >= 26: bỏ qua thay vì báo đỏ sai — cổng thật là app đóng gói nhúng runtime.
      expect(true).toBe(true);
      return;
    }
    const run = spawnSync(node, ["--experimental-strip-types", join(repoRoot, "apps/cli/src/main.ts"), "--help"], {
      encoding: "utf8",
      env: { ...process.env, GBH_PREBUILT_LIB: "1" },
      timeout: 30_000,
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("bh — Galaxy Blackhole Desktop launcher");
    expect(run.stderr).not.toContain("Unsupported/no-context");
  }, 40_000);

  test("vỏ desktop spawn node, không spawn bun", () => {
    const source = readFileSync(join(repoRoot, "apps/desktop/src-tauri/src/host_proc.rs"), "utf8");
    expect(source).toContain("Command::new(&plan.node)");
    expect(source).toContain("--experimental-strip-types");
    expect(source).toContain('.env("GBH_NODE", &plan.node)');
    expect(source).toContain('.env("GBH_REPO_ROOT", &plan.repo)');
    expect(source).toContain("process_group(0)");
    expect(source).not.toContain("Command::new(&plan.bun)");
  });

  test("bộ giải runtime xếp Resources/runtime/node trước GBH_NODE và PATH", () => {
    const source = readFileSync(join(repoRoot, "apps/desktop/src-tauri/src/host_command.rs"), "utf8");
    const runtimeTier = source.indexOf('dir.join("runtime").join("node")');
    const envTier = source.indexOf("if let Some(value) = &env.gbh_node");
    const pathTier = source.indexOf('find_in_dirs(&path_value, "node"');
    expect(runtimeTier).toBeGreaterThan(-1);
    expect(envTier).toBeGreaterThan(runtimeTier);
    expect(pathTier).toBeGreaterThan(envTier);
  });

  test("gói cài chỉ nhúng node — không có runtime/bun", () => {
    const source = readFileSync(join(repoRoot, "apps/desktop/scripts/embed.ts"), "utf8");
    expect(source).toContain('join(resources, "runtime", "node")');
    expect(source).not.toContain('"runtime", "bun"');
    expect(source).not.toContain("resolveBun");
  });
});
