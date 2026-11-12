/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build typert-registry: BA artefact (host byte-identical + client BROWSER +5 B + client NODE byte-identical)
 *      + lib/types + 2 entry Bun.build. Gói BA artefact đầu tiên của repo (client KÉP browser/node).
 */

import { createHash } from "node:crypto";
import { denTa } from "../../../tools/lib/id-normalize.ts";

/** 05/11/2026 (P1b): artefact ghi ra mang id CUA TA; cong byte van so tren ban ghep nguyen van. */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { assembleClientBundle } from "./src/assemble-client.ts";
import {
  CLIENT_BROWSER_ID_REPLACEMENTS,
  CLIENT_NODE_PARTS_DIR_NAME,
  CLIENT_NODE_PART_FILES,
  HOST_PARTS_DIR_NAME,
  OUT_CLIENT_BROWSER_FILE_NAME,
  OUT_CLIENT_NODE_FILE_NAME,
  OUT_FILE_NAME,
  PACKAGE_NAME,
  STOCK_BUNDLE,
  STOCK_CLIENT_BROWSER_BUNDLE,
  STOCK_CLIENT_NODE_BUNDLE,
  STOCK_ID,
} from "./src/manifest.ts";

/** Gốc repo (packages/host/typert-registry ⇒ ../../..). */
const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * Băm SHA-256 một chuỗi.
 * Nhận: text — nội dung cần băm (UTF-8). Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Cổng BYTE TUYỆT ĐỐI (host + client node: id stock chỉ nằm trong JSDoc nên artefact phải trùng byte).
 * Nhận: assembled — văn bản ghép; stock — văn bản gốc. Trả: không (ném khi lệch).
 */
function assertByteIdentical(assembled: string, stock: string): void {
  if (!Buffer.from(assembled, "utf8").equals(Buffer.from(stock, "utf8"))) {
    throw new Error("ban ghep KHONG trung bundle goc: " + String(Buffer.byteLength(assembled)) + " B / sha " + sha256(assembled).slice(0, 16) + " · stock " + String(Buffer.byteLength(stock)) + " B / sha " + sha256(stock).slice(0, 16));
  }
}

/**
 * Cổng OWNERSHIP cho client browser: chuẩn hoá id ta→stock rồi so byte + kiểm ĐÚNG số lần id ta.
 * Nhận: assembled — văn bản ghép; stock — văn bản gốc; nhan — nhãn artefact; soLanDoi — số lần id ta kỳ vọng.
 * Trả: không (ném khi lệch).
 */
function gateOwnership(assembled: string, stock: string, nhan: string, soLanDoi: number): void {
  const chuanHoa = assembled.split("@galaxy-blackhole/gbh-client-ui-primitives").join("@deepseek-ai/dsh-client-ui-primitives").split("@galaxy-blackhole/gbh-client-store").join("@deepseek-ai/dsh-client-store").split("@galaxy-blackhole/gbh-typert-generator").join("@deepseek-ai/dsh-typert-generator").split(PACKAGE_NAME).join(STOCK_ID);
  if (!Buffer.from(chuanHoa, "utf8").equals(Buffer.from(stock, "utf8"))) {
    throw new Error(nhan + ": KHONG trung sau khi chuan hoa id: " + String(Buffer.byteLength(chuanHoa)) + " B / sha " + sha256(chuanHoa).slice(0, 16) + " · stock " + String(Buffer.byteLength(stock)) + " B / sha " + sha256(stock).slice(0, 16));
  }
  const dem = assembled.split(PACKAGE_NAME).length - 1;
  if (dem !== soLanDoi) throw new Error(nhan + ": so lan id cua ta = " + String(dem) + " nhung ky vong " + String(soLanDoi));
}

/**
 * Build ba artefact + kiểu + hai entry Bun.build.
 * Nhận: outDir — thư mục đích (mặc định <gói>/lib). Trả: đường dẫn lib/index.js.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  // 1/3 — nửa host (byte-identical).
  const host = assembleBundle(join(import.meta.dir, "src", HOST_PARTS_DIR_NAME));
  assertByteIdentical(host, readFileSync(join(REPO, STOCK_BUNDLE), "utf8"));
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, host);
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (existsSync(stockTypes)) {
    cpSync(stockTypes, join(out, "types"), { recursive: true });
    writeFileSync(join(out, "index.d.ts"), 'export * from "./types/index.js";' + String.fromCharCode(10) + 'export { TypertRegistry as default } from "./types/index.js";' + String.fromCharCode(10));
  }
  // 2/3 — client BROWSER (vỏ + 3 lát; chỉ khác dòng loader).
  const browser = assembleClientBundle();
  gateOwnership(browser, readFileSync(join(REPO, STOCK_CLIENT_BROWSER_BUNDLE), "utf8"), OUT_CLIENT_BROWSER_FILE_NAME, CLIENT_BROWSER_ID_REPLACEMENTS);
  writeFileSync(join(out, OUT_CLIENT_BROWSER_FILE_NAME), browser);
  // 3/3 — client NODE (ESM thuần, ghép 4 lát, byte-identical).
  const node = assembleBundle(join(import.meta.dir, "src", CLIENT_NODE_PARTS_DIR_NAME), CLIENT_NODE_PART_FILES);
  assertByteIdentical(node, readFileSync(join(REPO, STOCK_CLIENT_NODE_BUNDLE), "utf8"));
  writeFileSync(join(out, OUT_CLIENT_NODE_FILE_NAME), node);
  // Bun.build THỨ NHẤT: entry nguồn ⇒ lib/index-entry.js (check:rows đối chiếu export).
  const sourceBuild = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "index.ts")], outdir: out, naming: "index-entry.js", target: "bun", format: "esm", packages: "external" });
  if (!sourceBuild.success) throw new Error("Bun.build entry nguon that bai: " + sourceBuild.logs.map(String).join(" | "));
  // Bun.build THỨ HAI: entry nửa client browser ⇒ lib/client-entry.js.
  const clientBuild = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "client.ts")], outdir: out, naming: "client-entry.js", target: "browser", format: "esm", packages: "external" });
  if (!clientBuild.success) throw new Error("Bun.build entry nua client that bai: " + clientBuild.logs.map(String).join(" | "));
  return file;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])) + " · 3 artefact (host byte-id + browser +5B + node byte-id) + types + entry");
}