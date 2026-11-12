/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Dung baseline DSH stock lam oracle doc lap
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// 21/10/2026 (task-196): KHONG dung APP_PROFILE_BUNDLES cua apps/cli nua — tu khi chuyen sang bundle-native, danh
// sach do la "@galaxy-blackhole/gbh-bundle" (goi cua TA) va DSH stock KHONG the resolve. Oracle phai chay bundle STOCK.
const APP_PROFILE_BUNDLES: readonly string[] = [
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "@deepseek-ai/dsh-experimental-plugin-market-bundle",
  "@deepseek-ai/dsh-experimental-agent-team-profile",
  "@deepseek-ai/dsh-experimental-terminal-bundle",
  "@deepseek-ai/dsh-experimental-session-search",
  "@deepseek-ai/dsh-experimental-inspector-profile",
  "@deepseek-ai/dsh-experimental-auto-review",
  "@deepseek-ai/dsh-experimental-tool-worktree",
  "@deepseek-ai/dsh-experimental-cot-translation-bundle",
  "@deepseek-ai/dsh-experimental-ralph-bundle",
  "@deepseek-ai/dsh-experimental-session-titles-bundle",
  "@deepseek-ai/dsh-experimental-voice-input-bundle",
];
import { resolveNodeRuntime } from "../../apps/cli/src/runtime.ts";

/** Thư mục home RIÊNG của bản stock — không bao giờ là `~/.galaxy/blackhole` hay `~/.galaxy/gbh`. */
export const STOCK_HOME = "/tmp/stock-home";

/** Tên profile stock dưới `$STOCK_HOME/profiles`. */
export const STOCK_PROFILE = "stock";

/** Cổng riêng của oracle; KHÔNG dùng 5439 của app ta. */
export const STOCK_PORT = 5466;

/** Nơi ghi bằng chứng JSON/PNG. */
export const EVIDENCE_DIR = join(import.meta.dir, "..", "..", "docs", "evidence", "stock-baseline");

/** Một lần boot stock đã sẵn sàng phục vụ. */
export interface StockBaseline {
  /** URL có `?token=` do harness in ra. */
  url: string;
  /** Cổng đã bind. */
  port: number;
  /** PID tiến trình harness stock. */
  pid: number;
  /** Binary Node dùng để boot. */
  node: string;
  /** Phiên bản Node. */
  nodeVersion: string;
  /** Thời điểm boot (ISO). */
  startedAt: string;
  /** Danh sách bundle stock đã khai trong profile. */
  bundles: readonly string[];
  /** Đường dẫn tệp log stdout/stderr của tiến trình. */
  logPath: string;
}

/**
 * Ghi profile stock tối thiểu: chỉ `dsh.profile.bundles`, đúng danh sách APP_PROFILE_BUNDLES gốc.
 * @returns đường dẫn thư mục profile vừa ghi.
 */
export function ensureStockProfile(): string {
  const dir = join(STOCK_HOME, "profiles", STOCK_PROFILE);
  mkdirSync(dir, { recursive: true });
  const manifest = {
    name: "dsh-profile-stock-oracle",
    private: true,
    dependencies: {},
    dsh: { profile: { bundles: [...APP_PROFILE_BUNDLES] } },
  };
  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return dir;
}

/**
 * Rút URL có token từ output harness.
 * @param text - output tích luỹ.
 * @returns URL hoặc undefined khi chưa in.
 */
export function extractStockUrl(text: string): string | undefined {
  return /https?:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9._~+/=-]+/u.exec(text)?.[0];
}

/**
 * Boot DSH stock và chờ tới khi nó in URL có token.
 * @param options - cổng (mặc định {@link STOCK_PORT}) và hạn chờ mili-giây.
 * @returns thông tin boot đã sẵn sàng.
 */
export async function bootStockBaseline(options: { port?: number; timeoutMs?: number } = {}): Promise<{
  baseline: StockBaseline;
  child: ChildProcess;
  stop: () => void;
}> {
  const port = options.port ?? STOCK_PORT;
  const timeoutMs = options.timeoutMs ?? 120_000;
  ensureStockProfile();
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const runtime = resolveNodeRuntime();
  const logPath = join(EVIDENCE_DIR, "stock-boot.log");
  const args = ["--profile", STOCK_PROFILE, "--no-open", "--host", "127.0.0.1", "--port", String(port)];
  const bin = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
  const child = spawn(runtime.bin, [bin, ...args], {
    env: { ...process.env, DSH_HOME: STOCK_HOME },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const onData = (chunk: Buffer): void => {
    output += chunk.toString("utf8");
    writeFileSync(logPath, output, "utf8");
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  const started = Date.now();
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setInterval(() => {
      const found = extractStockUrl(output);
      if (found !== undefined) {
        clearInterval(timer);
        resolve(found);
        return;
      }
      if (child.exitCode !== null || Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error("stock boot failed; log: " + logPath + "\n" + output.slice(-2000)));
      }
    }, 250);
  });
  const baseline: StockBaseline = {
    url,
    port,
    pid: child.pid ?? 0,
    node: runtime.bin,
    nodeVersion: runtime.version,
    startedAt: new Date().toISOString(),
    bundles: APP_PROFILE_BUNDLES,
    logPath,
  };
  writeFileSync(join(EVIDENCE_DIR, "stock-boot.json"), JSON.stringify(baseline, null, 2) + "\n", "utf8");
  writeFileSync(join(STOCK_HOME, "ready-url.txt"), url + "\n", "utf8");
  const stop = (): void => {
    if (child.exitCode === null) child.kill("SIGTERM");
  };
  return { baseline, child, stop };
}

/**
 * Cổng 5466 đã có ai phục vụ chưa (dùng để tránh boot trùng).
 * @returns true khi có HTTP trả lời (401/303 đều tính).
 */
export function stockPortBusy(): boolean {
  const probe = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "2", `http://127.0.0.1:${STOCK_PORT}/`], { encoding: "utf8" });
  return (probe.stdout ?? "").trim() === "401" || (probe.stdout ?? "").trim() === "303";
}

/**
 * Đọc lại baseline đã ghi (dùng cho journeys khi stock đã chạy sẵn).
 * @returns baseline hoặc undefined nếu chưa có.
 */
export function readStockBaseline(): StockBaseline | undefined {
  const path = join(EVIDENCE_DIR, "stock-boot.json");
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as StockBaseline;
}

if (import.meta.main) {
  const reuse = process.argv.includes("--reuse") && stockPortBusy();
  if (reuse) {
    const existing = readStockBaseline();
    console.log("stock oracle đã chạy sẵn: " + (existing?.url ?? "(chưa có JSON)"));
    process.exit(0);
  }
  const booted = await bootStockBaseline();
  console.log("stock oracle: " + booted.baseline.url);
  console.log("node " + booted.baseline.nodeVersion + " · pid " + String(booted.baseline.pid) + " · log " + booted.baseline.logPath);
  const shutdown = (): void => {
    booted.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
