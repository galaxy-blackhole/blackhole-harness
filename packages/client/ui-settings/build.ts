/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build hai nua cua package ui-settings: lib/index.js (node ESM) va lib/client.js (script classic MOT id)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "./src/ids.ts";

/** Header nam dong bat buoc cua repo, chen vao file sinh ra. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-settings — khong sua tay",
  " */",
].join(String.fromCharCode(10));

/** Thu muc app host — noi co node_modules chua schemastery va cosmokit. */
function hostAppDir(): string {
  return join(import.meta.dir, "..", "..", "..", "apps", "host");
}

/**
 * Plugin resolve cho cac goi @deepseek-ai/* ma schemastery can (cosmokit).
 *
 * Ly do: schemastery nam trong apps/host/node_modules, va tu thu muc do node KHONG resolve duoc
 * cac goi anh em cung nam trong apps/host/node_modules (thuat toan node them node_modules vao
 * tung cap thu muc, nen apps/host/node_modules tro thanh apps/host/node_modules/node_modules).
 * Ta resolve tu apps/host — noi @deepseek-ai/cosmokit nam dung cho.
 * @returns plugin resolve cua Bun.
 */
function hostAppResolver(): {
  name: string;
  setup(build: {
    onResolve(
      filter: { filter: RegExp },
      run: (args: { path: string }) => { path: string } | undefined,
    ): void;
  }): void;
} {
  const wanted = ["@deepseek-ai/cosmokit"];
  return {
    name: "gbh-host-app-resolver",
    setup(build) {
      build.onResolve({ filter: /^@deepseek-ai\/[a-z0-9-]+$/ }, (args) => {
        if (!wanted.includes(args.path)) return undefined;
        try {
          return { path: Bun.resolveSync(args.path, hostAppDir()) };
        } catch {
          return undefined;
        }
      });
    },
  };
}

/**
 * Gom log cua mot lan build hong thanh mot dong.
 * @param result - ket qua build cua Bun.
 * @returns chuoi log da noi.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build nua host thanh mot file ESM (peer external de chi co mot instance trong tien trinh).
 * @param out - thu muc dich.
 * @returns duong dan file da build.
 */
async function buildHostHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!result.success) throw new Error("gbh-client-ui-settings: build nua host that bai: " + logsOf(result));
  const file = join(out, "index.js");
  writeFileSync(file, GENERATED_HEADER + String.fromCharCode(10) + String(await Bun.file(file).text()));
  return file;
}

/**
 * Build nua browser thanh script classic dang ky DUNG MOT id module.
 *
 * schemastery duoc NHUNG vao bundle nay (bang module cua browser khong co no; ban goc cung nhung
 * san). Day la peer duoc phep cua repo, lay tu node_modules cua chinh package (symlink).
 * @param out - thu muc dich.
 * @returns duong dan file da build.
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    packages: "bundle",
    plugins: [hostAppResolver()],
  });
  if (!result.success) throw new Error("gbh-client-ui-settings: build nua browser that bai: " + logsOf(result));
  const body = await result.outputs[0]?.text();
  if (body === undefined) throw new Error("gbh-client-ui-settings: build nua browser khong tra output");
  const lines = [
    GENERATED_HEADER,
    "(function () {",
    "  var factory = (function () {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    body,
    "    return function (require) { return module.exports.createPlugin(require); };",
    "  })();",
    "  var register = globalThis.__ModuleLoader__.load;",
    "  register({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "})();",
    "",
  ];
  const file = join(out, "client.js");
  writeFileSync(file, lines.join(String.fromCharCode(10)));
  return file;
}

/**
 * Build ca hai nua vao thu muc dich.
 * @param outDir - thu muc dich (mac dinh: lib canh package).
 * @returns danh sach file da build.
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  // 20/10/2026: nếu gói đã de-bundle (src/parts) thì CHÉP artefact, không build lại (xem tools/debundle-guard.ts).
  const daDebundle = copyIfDebundled(import.meta.dir, outDir ?? join(import.meta.dir, "lib"));
  if (daDebundle !== null) return daDebundle as never;
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  return [await buildHostHalf(out), await buildClientHalf(out)];
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])).join(" + "));
}
