/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id)
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assembleBundleFromDisk, ENTRY_FILE_NAME, wrapClientBundle } from "./src/assemble.ts";

/**
 * Gom log cua mot lan build hong thanh mot dong.
 * Nhan: result — ket qua build cua Bun.
 * Tra: chuoi log da noi.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Doc mot file UTF-8 thanh chuoi (khuon doc file ma assemble.ts nhan).
 * Nhan: path — duong dan file.
 * Tra: noi dung file.
 */
function readText(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Build nua host: bundle ESM tu src/index.ts ra lib/index.js.
 * Nhan: out — thu muc dich.
 * Tra: duong dan artifact da ghi.
 */
async function buildHostHalf(out: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!built.success) throw new Error("gbh-client-ui-trajectory: build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nua client theo ba buoc, va vi sao phai nhu vay:
 *   1. GHEP VAN BAN 12 lat nguyen van + bon module CSS thanh MOT than bundle (bundle goc la mot pham vi
 *      ham phang, cac lat tham chieu ten cua nhau — khong the la 12 module ESM).
 *   2. PHEP KIEM CU PHAP: ghi than bundle ra entry TAM roi cho Bun.build doc (target browser, format cjs,
 *      packages external). Mot lat bi cat sai se lam Bun.build that bai ngay tai day thay vi lam app
 *      trang luc boot. Ket qua bundle KHONG duoc dung lam artifact — xem ly do o buoc 3.
 *   3. ARTIFACT la than bundle NGUYEN VAN, chi boc them IIFE + loi goi load. ⚠️ 18/10/2026: KHONG giao
 *      than bundle cho bo bien doi cua Bun — no GO BINH LUAN va DOI THUT LE (tab ⇒ space, `let` ⇒ `var`
 *      o cap cao nhat), tuc lam mat bang chung doi chung TUNG BYTE voi ban goc. Ban goc cung chay nguyen
 *      van trong trinh duyet, nen giu nguyen van la lua chon dung ca ve ky thuat lan ve do luong.
 * Nhan: out — thu muc dich.
 * Tra: duong dan artifact da ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  const srcDir = join(import.meta.dir, "src");
  const body = assembleBundleFromDisk(srcDir, readText);
  const entryPath = join(out, ENTRY_FILE_NAME);
  writeFileSync(entryPath, body + "\n");
  const built = await Bun.build({
    entrypoints: [entryPath],
    target: "browser",
    format: "cjs",
    write: false,
    packages: "external",
    // write khong nam trong kieu BuildConfig cua ban Bun nay ⇒ ep kieu nhu ui-subagent/ui-goal (khuon da co trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("gbh-client-ui-trajectory: build nua client that bai: " + logsOf(built));
  if (built.outputs[0] === undefined) throw new Error("gbh-client-ui-trajectory: build nua client khong sinh output nao");
  rmSync(entryPath, { force: true });
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(body));
  return target;
}

/**
 * Build tron goi: ghi ca hai nua vao outDir (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ 18/10/2026: PHAI nhan outDir qua tham so dong lenh — apps/cli/src/mount.ts goi
 *   buildIfStale(pkg, join(dir, 'lib')) voi thu muc dich la BAN MOUNT trong profile. Hard-code
 *   join(import.meta.dir, 'lib') thi mount build ra lib/ cua repo roi chi ghi duoc package.json vao
 *   profile ⇒ profile THIEU lib/ ⇒ tang nap khong sinh entry, ma moi phep kiem khac deu xanh.
 * Nhan: outDir — thu muc dich (tuy chon).
 * Tra: { host, client } — duong dan hai artifact da ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}
