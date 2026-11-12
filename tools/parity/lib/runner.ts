/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chạy dump-config và quản lý tiến trình server (boot oracle B, dò cổng, thăm HTTP)
 */

import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";

import { fileExists, log, resolveNodeBin } from "./paths.ts";
import { runtimeVersion, stockTarget } from "./targets.ts";
import type { DumpTarget } from "./targets.ts";

/** Kết quả một lần chạy `--dump-config`. */
export interface DumpRun {
  /** Target đã chạy. */
  target: DumpTarget;
  /** true khi chạy xong và có stdout. */
  ok: boolean;
  /** Nội dung YAML in ra. */
  raw: string;
  /** Lý do khi `ok = false`. */
  error?: string;
  /** Thời gian chạy (ms). */
  durationMs: number;
  /** Version harness đọc từ package.json của bin. */
  version: string | null;
}

/**
 * Dựng argv cho `--dump-config` của một target.
 * @param target target cần chạy.
 * @returns mảng tham số truyền cho node.
 */
export function dumpArgs(target: DumpTarget): string[] {
  const args = [target.bin, "--profile", target.profile];
  for (const patch of target.patches) args.push("--patch", patch);
  args.push("--dump-config");
  return args;
}

/**
 * Chạy `dsh --profile <p> [--patch …] --dump-config` cho một target.
 * @param target target cần dump.
 * @returns kết quả kèm stdout thô.
 */
export function runDumpConfig(target: DumpTarget): DumpRun {
  const startedAt = Date.now();
  const version = runtimeVersion(target.bin);
  if (!fileExists(target.bin)) {
    return { target, ok: false, raw: "", error: "không thấy runtime: " + target.bin, durationMs: 0, version };
  }
  const missingPatches = target.patches.filter((patch) => !fileExists(patch));
  const probe = spawnSync(resolveNodeBin(), dumpArgs(target), {
    cwd: target.cwd,
    env: { ...process.env, DSH_HOME: target.home },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  const raw = probe.stdout ?? "";
  const durationMs = Date.now() - startedAt;
  if (probe.error !== undefined && probe.error !== null && raw.trim() === "") {
    return { target, ok: false, raw, error: "spawn lỗi: " + probe.error.message, durationMs, version };
  }
  if (raw.trim() === "") {
    const stderr = (probe.stderr ?? "").trim().split("\n").slice(-3).join(" | ");
    return { target, ok: false, raw, error: "không có stdout (exit " + String(probe.status) + "): " + stderr, durationMs, version };
  }
  if (missingPatches.length > 0) {
    log("cảnh báo: thiếu patch cho", target.key + ":", missingPatches.join(", "));
  }
  return { target, ok: true, raw, durationMs, version };
}

/**
 * Thăm một URL bằng HTTP GET ngắn.
 * @param url URL cần thăm.
 * @param timeoutMs thời gian chờ tối đa.
 * @returns trạng thái "có server trả lời" và mã HTTP (0 nếu không kết nối được).
 */
export async function httpProbe(url: string, timeoutMs = 4000): Promise<{ up: boolean; status: number; error?: string }> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
    return { up: true, status: response.status };
  } catch (error) {
    return { up: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Tiến trình oracle B do parity tự boot. */
export interface StockServer {
  /** true khi server đã lên và in ra URL. */
  ok: boolean;
  /** Tiến trình con (null nếu không spawn). */
  child: ChildProcess | null;
  /** Launch token đọc từ stdout (chỉ dùng trong bộ nhớ). */
  launchToken: string;
  /** Ghi chú cho report. */
  note: string;
  /** Các dòng stdout đã bắt được (đã lọc, không chứa token). */
  outputLines: string[];
}

/**
 * Bóc launch token từ một dòng stdout mà không bao giờ lưu lại cả dòng.
 * @param line một dòng stdout của harness.
 * @returns token, hoặc chuỗi rỗng.
 */
export function parseLaunchToken(line: string): string {
  const marker = "?token=";
  const at = line.indexOf(marker);
  if (at === -1) return "";
  let token = "";
  for (const char of line.slice(at + marker.length)) {
    const allowed =
      (char >= "a" && char <= "z") ||
      (char >= "A" && char <= "Z") ||
      (char >= "0" && char <= "9") ||
      char === "-" ||
      char === "_";
    if (!allowed) break;
    token += char;
  }
  return token;
}

/**
 * Bỏ mọi token khỏi một dòng stdout trước khi đưa vào report.
 * @param line dòng stdout.
 * @returns dòng đã thay token bằng `<token>`.
 */
export function redactTokens(line: string): string {
  const token = parseLaunchToken(line);
  if (token === "") return line.trim();
  return line.split(token).join("<token>").trim();
}

/**
 * Boot oracle B (profile `web` nguyên bản) trên một cổng, đợi tới khi harness in URL xác thực.
 * @param target target dump của oracle B (dùng bin + home + profile).
 * @param port cổng sẽ listen.
 * @param timeoutMs thời gian chờ tối đa.
 * @returns tiến trình con + launch token (không ghi token ra đâu khác).
 */
export async function startStockServer(target: DumpTarget, port: number, timeoutMs = 45_000): Promise<StockServer> {
  if (!fileExists(target.bin)) return { ok: false, child: null, launchToken: "", note: "không thấy runtime " + target.bin, outputLines: [] };
  const args = [target.bin, "--profile", target.profile, "--port", String(port), "--no-open"];
  const child = spawn(resolveNodeBin(), args, {
    cwd: target.cwd,
    env: { ...process.env, DSH_HOME: target.home },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const outputLines: string[] = [];
  let token = "";
  const onLine = (chunk: Buffer): void => {
    for (const line of chunk.toString("utf8").split("\n")) {
      if (line.trim() === "") continue;
      const found = parseLaunchToken(line);
      if (found !== "" && token === "") token = found;
      if (outputLines.length < 12) outputLines.push(redactTokens(line));
    }
  };
  child.stdout?.on("data", onLine);
  child.stderr?.on("data", onLine);
  const deadline = Date.now() + timeoutMs;
  let answered = false;
  // DSH in URL xác thực ngay khi server sẵn sàng, nên ta chờ đúng dòng đó thay vì chờ cổng mở
  // (cổng mở trước khi in URL, và lúc đó request chưa token sẽ nhận 401).
  while (Date.now() < deadline) {
    if (token !== "") {
      return { ok: true, child, launchToken: token, note: "parity tự boot (pid " + String(child.pid ?? 0) + ")", outputLines };
    }
    const probe = await httpProbe("http://127.0.0.1:" + String(port) + "/", 1500);
    answered = answered || probe.up;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (answered) {
    return { ok: true, child, launchToken: "", note: "server đã lên nhưng không bắt được token → dùng cookie mint", outputLines };
  }
  return { ok: false, child, launchToken: token, note: "quá hạn " + String(timeoutMs) + "ms mà server chưa lên", outputLines };
}

/**
 * Bảo đảm oracle B đang chạy trên cổng của nó: nếu chưa thì tự boot (dùng home tạm, cùng slug workspace).
 * @param port cổng của oracle B.
 * @returns tiến trình con (null nếu đã có sẵn) và cờ cho biết có phải tự boot.
 */
export async function ensureStockServer(port: number): Promise<{ child: ChildProcess | null; bootedHere: boolean; note: string }> {
  const probe = await httpProbe("http://127.0.0.1:" + String(port) + "/", 3000);
  if (probe.up) return { child: null, bootedHere: false, note: "oracle B đã chạy sẵn trên cổng " + String(port) };
  const server = await startStockServer(stockTarget(), port);
  return {
    child: server.child,
    bootedHere: true,
    note: server.ok ? "đã boot oracle B: " + server.note : "KHÔNG boot được oracle B: " + server.note,
  };
}

/**
 * Dừng tiến trình con nếu còn sống.
 * @param child tiến trình con.
 * @returns không trả gì.
 */
export function stopChild(child: ChildProcess | null): void {
  if (child === null || child.exitCode !== null) return;
  child.kill("SIGTERM");
}
