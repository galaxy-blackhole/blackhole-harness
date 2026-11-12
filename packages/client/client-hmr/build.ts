/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script CLASSIC/IIFE cho the <script>) — ban build chi nam trong profile cua app.
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";

import { EVENTS_ENDPOINT, PACKAGE_NAME } from "./src/ids.ts";

/** Nam dong header bat buoc cua repo, chen vao moi file sinh ra (`lib/*.js` cung bi cong header soi). */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TU DONG boi build.ts cua " + PACKAGE_NAME + " — khong sua tay",
  " */",
].join("\n");

/**
 * Gom log cua mot lan build hong thanh mot dong de doc.
 * @param result - ket qua build cua Bun.
 * @returns chuoi log da noi.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build nua host thanh mot file ESM duy nhat cho Node (peer de external).
 * @param out - thu muc dich.
 * @returns duong dan file `index.js`.
 * @throws khi Bun build that bai, hoac khi thieu export ma row phai co.
 */
async function buildHostHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    packages: "external",
    naming: "index.js",
    banner: GENERATED_HEADER,
  });
  if (!result.success) throw new Error("client-hmr: build nua host that bai: " + logsOf(result));
  const file = join(out, "index.js");
  const code = await Bun.file(file).text();
  for (const symbol of ["\"client-hmr\"", "clientModules", "webServer", "apply", EVENTS_ENDPOINT]) {
    if (!code.includes(symbol)) throw new Error("client-hmr: nua host thieu dau vet " + symbol);
  }
  return file;
}

/**
 * Build nua browser thanh MOT script classic (IIFE): bo nap tai bundle bang the `<script>` nen dau ra
 * KHONG duoc chua cu phap ESM — builder tu kiem lai thay vi tin vao cau hinh.
 * @param out - thu muc dich.
 * @returns duong dan file `client.js`.
 * @throws khi Bun build that bai, khi lot cu phap ESM, hoac khi thieu loi goi dang ky dung id.
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    outdir: out,
    target: "browser",
    format: "iife",
    naming: "client.js",
    banner: GENERATED_HEADER,
  });
  if (!result.success) throw new Error("client-hmr: build nua browser that bai: " + logsOf(result));
  const file = join(out, "client.js");
  const code = await Bun.file(file).text();
  const esmLine = code.split("\n").find((line) => /^\s*(import|export)\s/u.test(line));
  if (esmLine !== undefined) throw new Error("client-hmr: bundle client lot cu phap ESM: " + esmLine.trim().slice(0, 80));
  // Bo nap chi can thay DUNG HAI dau vet: bang module toan cuc, va mot loi goi `load({ id, factory })`.
  // (Build ra co the dat ten bien trung gian, nen KHONG doi chuoi `__ModuleLoader__.load` nguyen khoi.)
  if (!code.includes("__ModuleLoader__")) throw new Error("client-hmr: bundle client thieu bang module __ModuleLoader__");
  if (!/\.load\(\s*\{/u.test(code)) throw new Error("client-hmr: bundle client thieu loi goi load({ id, factory })");
  if (!code.includes(PACKAGE_NAME)) throw new Error("client-hmr: bundle client thieu id " + PACKAGE_NAME);
  return file;
}

/**
 * Build ca hai nua vao thu muc dich.
 * @param outDir - thu muc dich (mac dinh: `lib` canh package).
 * @returns duong dan file `index.js` da build.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const host = await buildHostHalf(out);
  await buildClientHalf(out);
  return host;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])));
}
