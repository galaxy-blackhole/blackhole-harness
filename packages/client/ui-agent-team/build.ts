/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build HAI nửa của package: lib/index.js (nửa host, node ESM) và lib/client.js (nửa browser, script
 *      classic đăng ký MỘT id module, CSS nhúng bằng define)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { wrapClientBundle } from "./src/client-registration.ts";
import { PACKAGE_NAME } from "./src/ids.ts";

/** CSS của TeamAction — nguồn sự thật duy nhất, nhúng vào bundle bằng `define` chứ không chép lại. */
const CSS_FILE = join(import.meta.dir, "src", "TeamAction.module.css");
/** CSS RIÊNG của hàng toolview `set_team_limits` (ADR 0013) — tệp riêng, không đụng CSS verbatim của gốc. */
const SET_LIMITS_CSS_FILE = join(import.meta.dir, "src", "set-team-limits.module.css");

/**
 * Gom log của một lần build hỏng thành một dòng.
 * Nhận: kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build cả hai nửa của package vào một thư mục đích.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package.json).
 * Trả: { host, client } — đường dẫn hai file đã build.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  const hostResult = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  } as Parameters<typeof Bun.build>[0]);
  if (!hostResult.success) throw new Error(PACKAGE_NAME + ": build nua host that bai: " + logsOf(hostResult));
  const clientResult = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
    define: {
      __GBH_AGENT_TEAM_CSS__: JSON.stringify(readFileSync(CSS_FILE, "utf8")),
      __GBH_SET_LIMITS_CSS__: JSON.stringify(readFileSync(SET_LIMITS_CSS_FILE, "utf8")),
    },
  } as Parameters<typeof Bun.build>[0]);
  if (!clientResult.success) throw new Error(PACKAGE_NAME + ": build nua client that bai: " + logsOf(clientResult));
  const bundle = clientResult.outputs[0];
  if (bundle === undefined) throw new Error(PACKAGE_NAME + ": build nua client khong sinh output nao");
  const clientPath = join(out, "client.js");
  writeFileSync(clientPath, wrapClientBundle(await bundle.text(), PACKAGE_NAME));
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-* (cổng đảo ngược bắt buộc).
  await renameClientArtifact(join(import.meta.dir, "lib", "client.js"));
  return { host: join(out, "index.js"), client: clientPath };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host + " + " + built.client);
}
