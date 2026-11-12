/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build api-job-controller: 4 artefact (host byte-identical + client + 2 typert ownership) + lib/types + 2 entry Bun.build
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { assembleClientBundle } from "./src/assemble-client.ts";
import { assembleTypert } from "./src/assemble-typert.ts";
import {
  CLIENT_ID_REPLACEMENTS,
  HOST_PARTS_DIR_NAME,
  OUT_CLIENT_FILE_NAME,
  OUT_FILE_NAME,
  OUT_TYPERT_HOST_FILE_NAME,
  OUT_TYPERT_REMOTE_FILE_NAME,
  PACKAGE_NAME,
  STOCK_BUNDLE,
  STOCK_CLIENT_BUNDLE,
  STOCK_ID,
  STOCK_TYPERT_HOST_BUNDLE,
  STOCK_TYPERT_REMOTE_BUNDLE,
  TYPERT_HOST_ID_REPLACEMENTS,
  TYPERT_HOST_PARTS_DIR_NAME,
  TYPERT_HOST_PART_FILES,
  TYPERT_REMOTE_ID_REPLACEMENTS,
  TYPERT_REMOTE_PARTS_DIR_NAME,
  TYPERT_REMOTE_PART_FILES,
} from "./src/manifest.ts";

/** Gốc repo (packages/host/api-job-controller ⇒ ../../..). */
const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * Băm SHA-256 một chuỗi.
 * Nhận: text — nội dung cần băm (UTF-8). Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Cổng BYTE TUYỆT ĐỐI cho nửa host (không được khác dù chỉ 1 byte).
 * Nhận: assembled — văn bản đã ghép; stock — văn bản gốc. Trả: không (ném khi lệch).
 */
function assertByteIdentical(assembled: string, stock: string): void {
  if (!Buffer.from(assembled, "utf8").equals(Buffer.from(stock, "utf8"))) {
    throw new Error(
      "ban ghep KHONG trung bundle goc: " + String(Buffer.byteLength(assembled)) + " B / sha " + sha256(assembled).slice(0, 16) +
        " · stock " + String(Buffer.byteLength(stock)) + " B / sha " + sha256(stock).slice(0, 16),
    );
  }
}

/**
 * Cổng OWNERSHIP cho client/typert: chuẩn hoá id của ta → id gốc rồi so TỪNG BYTE với bản gốc.
 * Nhận: assembled — văn bản đã ghép; stock — văn bản gốc; nhan — nhãn artefact để báo lỗi. Trả: không (ném khi lệch).
 */
function gateOwnership(assembled: string, stock: string, nhan: string, soLanDoi: number): void {
  const chuanHoa = assembled.split("@galaxy-blackhole/gbh-client-ui-primitives").join("@deepseek-ai/dsh-client-ui-primitives").split("@galaxy-blackhole/gbh-client-store").join("@deepseek-ai/dsh-client-store").split("@galaxy-blackhole/gbh-typert-generator").join("@deepseek-ai/dsh-typert-generator").split(PACKAGE_NAME).join(STOCK_ID).split("@galaxy-blackhole/gbh-host-typert-gateway").join("@deepseek-ai/dsh-api-gateway");
  if (!Buffer.from(chuanHoa, "utf8").equals(Buffer.from(stock, "utf8"))) {
    throw new Error(
      nhan + ": KHONG trung sau khi chuan hoa id: " + String(Buffer.byteLength(chuanHoa)) + " B / sha " + sha256(chuanHoa).slice(0, 16) +
        " · stock " + String(Buffer.byteLength(stock)) + " B / sha " + sha256(stock).slice(0, 16),
    );
  }
  // Số lần id của TA phải ĐÚNG bằng số chỗ đã đổi tên (client: 1 = dòng loader; typert: đổi toàn bộ).
  // KHÔNG dùng luật 'không còn id stock' cho client: bundle này có 6 lần id stock trong thân là DỮ LIỆU (package:, typeSymbol:, JSDoc).
  const dem = assembled.split(PACKAGE_NAME).length - 1;
  if (dem !== soLanDoi) throw new Error(nhan + ": so lan id cua ta = " + String(dem) + " nhung ky vong " + String(soLanDoi));
}

/**
 * Build bốn artefact + kiểu + hai entry Bun.build.
 * Nhận: outDir — thư mục đích (mặc định <gói>/lib). Trả: đường dẫn lib/index.js.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  // 1/4 — nửa host: ghép 4 lát NGUYÊN VĂN, cổng byte tuyệt đối.
  const assembled = assembleBundle(join(import.meta.dir, "src", HOST_PARTS_DIR_NAME));
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  assertByteIdentical(assembled, stock);
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, assembled);
  // Cây kiểu của bản gốc (chép nguyên) + khai báo kiểu cho artefact ghép.
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (existsSync(stockTypes)) {
    cpSync(stockTypes, join(out, "types"), { recursive: true });
    writeFileSync(join(out, "index.d.ts"), 'export * from "./types/index.js";' + String.fromCharCode(10) + 'export { JobController as default } from "./types/index.js";' + String.fromCharCode(10));
  }
  // 2/4 — nửa client.
  const client = assembleClientBundle();
  gateOwnership(client, readFileSync(join(REPO, STOCK_CLIENT_BUNDLE), "utf8"), OUT_CLIENT_FILE_NAME, CLIENT_ID_REPLACEMENTS);
  writeFileSync(join(out, OUT_CLIENT_FILE_NAME), client);
  // 3/4 + 4/4 — hai entry typert.
  const typertHost = assembleTypert(join(import.meta.dir, "src", TYPERT_HOST_PARTS_DIR_NAME), TYPERT_HOST_PART_FILES);
  gateOwnership(typertHost, readFileSync(join(REPO, STOCK_TYPERT_HOST_BUNDLE), "utf8"), OUT_TYPERT_HOST_FILE_NAME, TYPERT_HOST_ID_REPLACEMENTS);
  writeFileSync(join(out, OUT_TYPERT_HOST_FILE_NAME), typertHost);
  const typertRemote = assembleTypert(join(import.meta.dir, "src", TYPERT_REMOTE_PARTS_DIR_NAME), TYPERT_REMOTE_PART_FILES);
  gateOwnership(typertRemote, readFileSync(join(REPO, STOCK_TYPERT_REMOTE_BUNDLE), "utf8"), OUT_TYPERT_REMOTE_FILE_NAME, TYPERT_REMOTE_ID_REPLACEMENTS);
  writeFileSync(join(out, OUT_TYPERT_REMOTE_FILE_NAME), typertRemote);
  for (const ten of ["typert.host.d.ts", "typert.remote-client.d.ts"]) {
    const nguon = join(REPO, STOCK_TYPERT_HOST_BUNDLE.replace(/lib\/typert\.host\.js$/u, "lib/") + ten);
    if (existsSync(nguon)) cpSync(nguon, join(out, ten));
  }
  // Bun.build THỨ NHẤT: entry nguồn ⇒ lib/index-entry.js (check:rows đối chiếu export).
  const sourceBuild = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "index.ts")], outdir: out, naming: "index-entry.js", target: "bun", format: "esm", packages: "external" });
  if (!sourceBuild.success) throw new Error("Bun.build entry nguon that bai: " + sourceBuild.logs.map(String).join(" | "));
  // Bun.build THỨ HAI: entry nửa client ⇒ lib/client-entry.js.
  const clientBuild = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "client.ts")], outdir: out, naming: "client-entry.js", target: "browser", format: "esm", packages: "external" });
  if (!clientBuild.success) throw new Error("Bun.build entry nua client that bai: " + clientBuild.logs.map(String).join(" | "));
  return file;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])) + " · 4 artefact (host byte-identical + client/typert ownership) + types + entry");
}