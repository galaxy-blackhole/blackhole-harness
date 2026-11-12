/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Build HAI nửa của package ui-session-delete: lib/index.js (nửa host, node ESM) và lib/client.js
 *      (nửa browser, script classic đăng ký MỘT id module).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readFileSync } from "node:fs";

import { wrapClientBundle } from "./src/client-registration.ts";
import { PACKAGE_NAME } from "./src/ids.ts";

/** CSS của row (hai lớp "nguy hiểm") — nguồn sự thật duy nhất, nhúng vào bundle bằng define. */
const CSS_FILE = join(import.meta.dir, "src", "dialog.module.css");

/**
 * Gom log của một lần build hỏng thành một dòng.
 * Nhận: result — kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build cả hai nửa của package vào một thư mục đích.
 * Nhận: outDir — thư mục đích (mặc định lib cạnh package; mount truyền thư mục profile qua argv[2]).
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
      __GBH_SESSION_DELETE_CSS__: JSON.stringify(readFileSync(CSS_FILE, "utf8")),
    },
  } as Parameters<typeof Bun.build>[0]);
  if (!clientResult.success) throw new Error(PACKAGE_NAME + ": build nua client that bai: " + logsOf(clientResult));
  const bundle = clientResult.outputs[0];
  if (bundle === undefined) throw new Error(PACKAGE_NAME + ": build nua client khong sinh output nao");
  const clientPath = join(out, "client.js");
  writeFileSync(clientPath, wrapClientBundle(await bundle.text(), PACKAGE_NAME));
  return { host: join(out, "index.js"), client: clientPath };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host + " + " + built.client);
}
