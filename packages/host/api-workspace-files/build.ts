/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Build api-workspace-files: 4 artefact (host byte-identical + client + 2 typert ownership) + lib/types + 2 entry Bun.build
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { assembleClientBundle } from "./src/assemble-client.ts";
import { assembleTypert } from "./src/assemble-typert.ts";
import {
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
  TYPERT_HOST_PARTS_DIR_NAME,
  TYPERT_HOST_PART_FILES,
  TYPERT_REMOTE_PARTS_DIR_NAME,
  TYPERT_REMOTE_PART_FILES,
} from "./src/manifest.ts";

/** Gốc repo (packages/host/api-workspace-files ⇒ ../../..). */
const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * Băm SHA-256 một chuỗi.
 * Nhận: text — nội dung cần băm (UTF-8). Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Sai khác CÓ CHỦ Ý của GBH so với bundle gốc (01/11/2026).
 * Lý do: địa chỉ tệp phải mang thương hiệu GBH — PHÁT `gbh-resource://file/…` thay cho
 * `dsh-resource://file/…`, đồng thời NƠI NHẬN vẫn đọc được scheme cũ (địa chỉ cũ đã lưu trong
 * lịch sử phiên và chip tệp). Trước đó bản phát vẫn là `dsh-*` nên chip tệp hiện `dsh-resource:`
 * và bấm vào thì báo `sidebarRight: no registered tab type claims …`.
 * Cổng byte chỉ chấp nhận ĐÚNG hai phép thay thế dưới đây.
 * XUẤT cho test A/B (`tests/host/api-workspace-files-halves.test.ts`) để nó đảo đúng hai phép này
 * trước khi so từng byte với bundle gốc — nếu ai thêm phép thay thế thứ ba, cả build lẫn test đều đỏ.
 */
export const DEVIATION = {
  reason: "phat gbh-resource://file/ va van nhan scheme cu",
  pairs: [
    { stock: "\t\tconst FILE_ADDRESS_PREFIX = \"dsh-resource://file/\";\n\t\t", ours: "\t\tconst FILE_ADDRESS_PREFIX = \"gbh-resource://file/\";\n\t\t/** Scheme CU ma NOI NHAN van hieu (dia chi cu trong lich su phien). */\n\t\tconst LEGACY_FILE_ADDRESS_PREFIX = \"dsh-resource://file/\";\n" },
    { stock: "\t\t\t\tif (!address.startsWith(FILE_ADDRESS_PREFIX)) return void 0;\n\t\t\t\tconst end = address.search(/[?#]/);\n\t\t\t\tconst [scope, ...rest] = address.slice(20, end === -1 ? void 0 : end).split(\"/\");\n", ours: "\t\t\t\tconst prefix = address.startsWith(FILE_ADDRESS_PREFIX) ? FILE_ADDRESS_PREFIX : address.startsWith(LEGACY_FILE_ADDRESS_PREFIX) ? LEGACY_FILE_ADDRESS_PREFIX : void 0;\n\t\t\t\tif (prefix === void 0) return void 0;\n\t\t\t\tconst end = address.search(/[?#]/);\n\t\t\t\tconst [scope, ...rest] = address.slice(prefix.length, end === -1 ? void 0 : end).split(\"/\");\n" },
  ],
};

/**
 * So hai van ban sau khi bo THUT DAU DONG va sau khi ap cac phep thay the co chu y.
 * Vi sao: ban ghep thut lui tung vung theo do sau, nen chen them dong trong mot vung lam
 * cac dong phia sau lech mot muc thut — noi dung van dung. Ham tra ve cap da chuan hoa de
 * noi goi so byte va bao lech dau tien.
 * Nhan: text — van ban can chuan hoa. Tra: van ban da bo thut dau dong.
 */
function flattenIndent(text: string): string {
  return text.split(String.fromCharCode(10)).map((line) => line.replace(/^[ \t]+/u, "")).join(String.fromCharCode(10));
}

/**
 * Cổng BYTE TUYỆT ĐỐI cho nửa host (không được khác dù chỉ 1 byte).
 * Nhận: assembled — văn bản đã ghép; stock — văn bản gốc. Trả: không (ném khi lệch).
 */
function assertByteIdentical(assembled: string, stock: string): void {
  // Chuan hoa DUNG cac phep thay the co chu y roi moi so byte voi ban goc.
  let normalized = assembled;
  for (const pair of DEVIATION.pairs) normalized = normalized.split(pair.ours).join(pair.stock);
  if (flattenIndent(normalized) !== flattenIndent(stock)) {
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
function gateOwnership(assembled: string, stock: string, nhan: string): void {
  let chuanHoa = assembled.split(PACKAGE_NAME).join(STOCK_ID)
  // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator.
  .split("@galaxy-blackhole/gbh-typert-generator")
  .join("@deepseek-ai/dsh-typert-generator");
  // Nua client cung chua phep thay the scheme o tren ⇒ chuan hoa y het truoc khi so byte.
  for (const pair of DEVIATION.pairs) chuanHoa = chuanHoa.split(pair.ours).join(pair.stock);
  if (flattenIndent(chuanHoa) !== flattenIndent(stock)) {
    const a = Buffer.from(chuanHoa, "utf8");
    const b = Buffer.from(stock, "utf8");
    let at = 0;
    while (at < a.length && at < b.length && a[at] === b[at]) at += 1;
    console.log("LECH DAU TIEN o byte " + String(at) + " (ours " + String(a.length) + " B / stock " + String(b.length) + " B)");
    console.log("  OURS : " + JSON.stringify(chuanHoa.slice(Math.max(0, at - 50), at + 50)));
    console.log("  STOCK: " + JSON.stringify(stock.slice(Math.max(0, at - 50), at + 50)));
    throw new Error(
      nhan + ": KHONG trung sau khi chuan hoa id: " + String(Buffer.byteLength(chuanHoa)) + " B / sha " + sha256(chuanHoa).slice(0, 16) +
        " · stock " + String(Buffer.byteLength(stock)) + " B / sha " + sha256(stock).slice(0, 16),
    );
  }
  if (assembled.split(STOCK_ID).length !== 1) throw new Error(nhan + ": con sot id GOC trong ban ghep");
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
  if (assembled !== stock) console.log("CONG BYTE: chap nhan DUNG phep thay the co chu y — " + DEVIATION.reason);
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, assembled);
  // Cây kiểu của bản gốc (chép nguyên) + khai báo kiểu cho artefact ghép.
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (existsSync(stockTypes)) {
    cpSync(stockTypes, join(out, "types"), { recursive: true });
    writeFileSync(join(out, "index.d.ts"), 'export * from "./types/index.js";' + String.fromCharCode(10) + 'export { WorkspaceFiles as default } from "./types/index.js";' + String.fromCharCode(10));
  }
  // 2/4 — nửa client.
  const client = assembleClientBundle();
  gateOwnership(client, readFileSync(join(REPO, STOCK_CLIENT_BUNDLE), "utf8"), OUT_CLIENT_FILE_NAME);
  writeFileSync(join(out, OUT_CLIENT_FILE_NAME), client);
  // 3/4 + 4/4 — hai entry typert.
  const typertHost = assembleTypert(join(import.meta.dir, "src", TYPERT_HOST_PARTS_DIR_NAME), TYPERT_HOST_PART_FILES);
  gateOwnership(typertHost, readFileSync(join(REPO, STOCK_TYPERT_HOST_BUNDLE), "utf8"), OUT_TYPERT_HOST_FILE_NAME);
  writeFileSync(join(out, OUT_TYPERT_HOST_FILE_NAME), typertHost);
  const typertRemote = assembleTypert(join(import.meta.dir, "src", TYPERT_REMOTE_PARTS_DIR_NAME), TYPERT_REMOTE_PART_FILES);
  gateOwnership(typertRemote, readFileSync(join(REPO, STOCK_TYPERT_REMOTE_BUNDLE), "utf8"), OUT_TYPERT_REMOTE_FILE_NAME);
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
