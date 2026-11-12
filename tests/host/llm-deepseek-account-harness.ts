/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Harness của tests/host/llm-deepseek-account.test.ts: dựng BẢN CỦA TA từ ARTEFACT đã build trong
 *      một thư mục có symlink node_modules/@deepseek-ai → apps/host/node_modules/@deepseek-ai, nên artefact
 *      dùng CHUNG lớp lỗi (LlmError/HarnessError) và chung Symbol của dsh-scope với kernel; kèm probe
 *      bundle cho helper nội bộ `parseModelListing` và bộ đọc tên export của artefact.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/llm-deepseek-account/build.ts";

/** Bề mặt export của gói (Config/apply/inject/name) dưới dạng CHÍNH kiểu của src. */
export type AccountModule = typeof import("../../packages/host/llm-deepseek-account/src/index.ts");
/** Helper nội bộ của gói, nạp từ probe bundle (peer external ⇒ cùng lớp lỗi kernel). */
export interface AccountProbe {
  /** Đọc thân danh sách model; ném `LlmError` của kernel khi thân hỏng. */
  readonly parseModelListing: typeof import("../../packages/host/llm-deepseek-account/src/listing.ts").parseModelListing;
}
/** Bản của ta đã nạp từ artefact: bề mặt plugin, probe helper, đường dẫn artefact, và cách dọn. */
export interface AccountUnderTest {
  /** Bề mặt export của artefact. */
  readonly module: AccountModule;
  /** Helper nội bộ nạp từ probe bundle. */
  readonly probe: AccountProbe;
  /** Đường dẫn artefact đã build (dùng cho ca "không bundle dsh-llm"). */
  readonly artifactFile: string;
  /** Xoá thư mục tạm chứa artefact + probe. */
  cleanup(): void;
}

/** Thư mục gói của ta — nguồn của probe `parseModelListing`. */
const PKG_DIR = join(import.meta.dir, "..", "..", "packages", "host", "llm-deepseek-account");
/**
 * Thư mục @deepseek-ai của KERNEL — nguồn DUY NHẤT cấp peer cho artefact của ta.
 * Vì sao (01/11/2026): gói workspace phân giải peer qua root node_modules/.bun còn kernel nằm ở
 * apps/host/node_modules; hai bản sao VẬT LÝ của cùng lớp ⇒ mọi phép `x instanceof kernel.LlmError`
 * TRƯỢT (cờ `kernelClass` ở resolveAuth/admit, và lỗi của `parseModelListing`). Dựng artefact trong thư
 * mục có symlink node_modules/@deepseek-ai → kernel (pattern tests/host/shell.test.ts) thì hai bên dùng
 * CHUNG một lớp lỗi.
 */
const KERNEL_AI = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai");

/**
 * Build gói vào thư mục tạm NGOÀI repo (lượt chạy bị NGẮT không để rác trong gói — rác sẽ làm đỏ cổng
 * header/file-length), symlink @deepseek-ai sang kernel + `semver` sang bản của gói, rồi nạp artefact +
 * probe `parseModelListing`.
 * Nhận: không.
 * Trả: bề mặt plugin + probe + đường dẫn artefact + hàm dọn thư mục tạm.
 * @throws {Error} khi probe build thất bại (kèm log của Bun).
 */
export async function loadAccountUnderTest(): Promise<AccountUnderTest> {
  const runDir = mkdtempSync(join(tmpdir(), "gbh-llm-deepseek-account-run-"));
  const artifactFile = await buildPackage(runDir);
  mkdirSync(join(runDir, "node_modules"), { recursive: true });
  symlinkSync(KERNEL_AI, join(runDir, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(runDir, "node_modules", "@galaxy-blackhole"), "dir");
  // `semver` KHÔNG thuộc @deepseek-ai (thư viện bên thứ ba) — trỏ về bản cài của chính gói để artefact
  // phân giải được y như trong profile.
  symlinkSync(join(PKG_DIR, "node_modules", "semver"), join(runDir, "node_modules", "semver"), "dir");
  const loaded = (await import(pathToFileURL(artifactFile).href)) as AccountModule;
  // Probe RIÊNG cho helper nội bộ (không nằm trong bề mặt export của gói): bundle với peer external nên
  // nó phân giải `@deepseek-ai/dsh-llm` qua đúng symlink kernel ở trên.
  const probeSource = join(runDir, "listing-probe.ts");
  writeFileSync(probeSource, "export { parseModelListing } from " + JSON.stringify(join(PKG_DIR, "src", "listing.ts")) + ";" + String.fromCharCode(10));
  const probeOut = join(runDir, "probe");
  const built = await Bun.build({ entrypoints: [probeSource], outdir: probeOut, target: "node", format: "esm", naming: "listing-probe.js", packages: "external" });
  if (!built.success) throw new Error("probe build thất bại: " + built.logs.map((log) => String(log)).join(" | "));
  const probe = (await import(pathToFileURL(join(probeOut, "listing-probe.js")).href)) as AccountProbe;
  return {
    module: loaded,
    probe,
    artifactFile,
    cleanup: () => {
      rmSync(runDir, { recursive: true, force: true });
    },
  };
}

/**
 * Liệt kê tên export của một file ESM đã build — đúng hai khuôn mà `check:rows` dùng.
 * Nhận: text — nội dung artefact.
 * Trả: tên export đã sắp xếp (gồm cả `default`).
 */
export function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}
