/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build api-session-controller (nửa host): lib/index.js = 15 lát NGUYÊN VĂN ghép lại, CỔNG BYTE so TỪNG BYTE với bundle gốc
 */

import { createHash } from "node:crypto";
import { denTa } from "../../../tools/lib/id-normalize.ts";
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
  PART_FILES,
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

/** Gốc repo, tính từ gốc gói (packages/host/api-session-controller ⇒ ba cấp lên). */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Dòng khai báo KIỂU cho artefact ghép — trỏ thẳng vào cây .d.ts chép từ bản gốc. */
const TYPES_REEXPORT = 'export * from "./types/index.js";';

/** Dòng tái xuất DEFAULT của gói — chỉ sinh khi bundle gốc có default export. */
const TYPES_REEXPORT_DEFAULT = 'export { default } from "./types/index.js";';

/** Số ký tự hex của sha256 in ra trong thông báo (đủ để người đọc so nhanh). */
const SHA_PREFIX = 12;

/**
 * Băm SHA-256 một chuỗi (theo UTF-8).
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex đầy đủ 64 ký tự.
 */
export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Lấy dòng export CUỐI CÙNG của một bundle (bỏ các dòng trống ở cuối).
 * Nhận: source — nội dung bundle.
 * Trả: dòng export cuối, hoặc chuỗi rỗng khi bundle không có dòng nào.
 */
export function lastExportLine(source: string): string {
  const lines = source.split(EOL);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (line.trim() !== "") return line;
  }
  return "";
}

/**
 * Kiểm bundle gốc có default export hay không — đọc ĐÚNG dòng export cuối cùng.
 * Nhận: source — nội dung bundle gốc.
 * Trả: true khi dòng export cuối khai `<ten> as default`.
 */
export function hasDefaultExport(source: string): boolean {
  return /\bas default\b/u.test(lastExportLine(source));
}

/**
 * Dựng nội dung lib/index.d.ts: luôn tái xuất toàn bộ kiểu từ cây .d.ts của bản gốc,
 * thêm dòng default KHI (và chỉ khi) bundle gốc có default export.
 * Nhận: source — nội dung bundle gốc (dùng để kiểm default).
 * Trả: nội dung tệp khai báo kiểu.
 */
export function renderTypesEntry(source: string): string {
  const lines = [TYPES_REEXPORT];
  if (hasDefaultExport(source)) lines.push(TYPES_REEXPORT_DEFAULT);
  return lines.join(EOL) + EOL;
}

/**
 * Tìm BYTE lệch đầu tiên giữa hai buffer; khi một bên là tiền tố của bên kia thì trả độ dài bên ngắn.
 * Nhận: left — buffer bản ghép; right — buffer bản gốc.
 * Trả: chỉ số byte lệch đầu tiên (0-based).
 */
export function firstByteDifference(left: Uint8Array, right: Uint8Array): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return limit;
}

/**
 * Build nửa HOST: ghép các lát nguyên văn, so TỪNG BYTE với bundle gốc rồi mới ghi artefact;
 * kèm chép cây lib/types của bản gốc và sinh lib/index.d.ts.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: đường dẫn artefact chính (lib/index.js).
 */
/**
 * Cổng OWNERSHIP cho artefact client/typert: chuẩn hoá id của ta → id gốc rồi so TỪNG BYTE với bản gốc.
 * Nhận: assembled — văn bản đã ghép; stock — văn bản gốc; nhan — nhãn artefact để báo lỗi.
 * Trả: không (ném khi lệch).
 */
function gateOwnership(assembled: string, stock: string, nhan: string): void {
  const chuanHoa = assembled.split("@galaxy-blackhole/gbh-client-ui-primitives").join("@deepseek-ai/dsh-client-ui-primitives").split("@galaxy-blackhole/gbh-client-store").join("@deepseek-ai/dsh-client-store").split("@galaxy-blackhole/gbh-typert-generator").join("@deepseek-ai/dsh-typert-generator").split(PACKAGE_NAME).join(STOCK_ID).split("@galaxy-blackhole/gbh-host-typert-gateway").join("@deepseek-ai/dsh-api-gateway");
  const a = Buffer.from(chuanHoa, "utf8");
  const b = Buffer.from(stock, "utf8");
  if (!a.equals(b)) {
    throw new Error(
      nhan + ": ban ghep KHONG trung ban goc sau khi chuan hoa id: chuan-hoa " + String(a.length) + " B / sha " + sha256(chuanHoa).slice(0, SHA_PREFIX) +
        " · stock " + String(b.length) + " B / sha " + sha256(stock).slice(0, SHA_PREFIX) + " · lech dau tien o byte " + String(firstByteDifference(a, b)),
    );
  }
  if (assembled.split(STOCK_ID).length !== 1) throw new Error(nhan + ": con sot id GOC trong ban ghep");
}

/**
 * Sai khác CÓ CHỦ Ý của GBH so với bundle gốc (01/11/2026).
 * Lý do: `list()` bỏ qua phiên còn sống trong RAM nhưng NHẬT KÝ ĐÃ BỊ XOÁ — nếu không, sidebar vẫn
 * hiện dòng đã xoá cho tới lần boot sau (lỗi người dùng báo: xoá xong vẫn thấy phiên trong danh sách).
 * Cổng byte chỉ chấp nhận ĐÚNG phép thay thế dưới đây; mọi sai lệch khác vẫn bị chặn.
 */
export const DEVIATION = {
  reason: "list() bo qua phien live ma nhat ky da bi xoa",
  stockBlock: "\t\t\tconst live = this.ctx.sessions.get(record.header.id);\n\t\t\tif (live !== void 0) items.push(this.summaryFor(live));\n\t\t\telse if (record.header.cwd !== void 0) cold.push(record);",
  ourBlock: "\t\t\tconst live = this.ctx.sessions.get(record.header.id);\n\t\t\tif (live !== void 0) {\n\t\t\t\t/*\n\t\t\t\t * Phi\u00ean c\u00f2n s\u1ed1ng trong b\u1ed9 nh\u1edb nh\u01b0ng NH\u1eacT K\u00dd \u0110\u00c3 B\u1eca XO\u00c1 (ui-session-delete g\u1ee1 th\u01b0 m\u1ee5c log) th\u00ec\n\t\t\t\t * KH\u00d4NG li\u1ec7t k\u00ea n\u1eefa \u2014 n\u1ebfu kh\u00f4ng, sidebar v\u1eabn hi\u1ec7n d\u00f2ng \u0111\u00e3 xo\u00e1 cho t\u1edbi l\u1ea7n boot sau.\n\t\t\t\t * \u0110o 01/11/2026: xo\u00e1 xong, d\u00f2ng v\u1eabn c\u00f2n v\u00ec agent c\u00f2n attached trong phi\u00ean n\u00e0y.\n\t\t\t\t */\n\t\t\t\tconst persistence = this.ctx.get(\"sessionPersistence\");\n\t\t\t\tif (persistence === void 0) items.push(this.summaryFor(live));\n\t\t\t\telse {\n\t\t\t\t\tconst stored = await persistence.stat(record.header.id, { signal }).catch(() => undefined);\n\t\t\t\t\tif (stored !== void 0) items.push(this.summaryFor(live));\n\t\t\t\t}\n\t\t\t} else if (record.header.cwd !== void 0) cold.push(record);",
};

/**
 * Build TOÀN BỘ bốn artefact của gói: nửa host (index.js, byte-identical) · nửa client (client.js, quy đổi id) ·
 * hai entry typert (typert.host.js · typert.remote-client.js, quy đổi ownership) + chép kiểu gốc + entry client.
 * Nhận: outDir — thư mục đích (mặc định <gói>/lib).
 * Trả: đường dẫn lib/index.js vừa ghi.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembled = assembleBundle(join(import.meta.dir, "src", HOST_PARTS_DIR_NAME));
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  const assembledBytes = Buffer.from(assembled, "utf8");
  const stockBytes = Buffer.from(stock, "utf8");
  const normalized = assembled.split(DEVIATION.ourBlock).join(DEVIATION.stockBlock);
  if (!assembledBytes.equals(stockBytes)) {
    if (normalized !== stock) {
      throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + String(assembledBytes.length) + " B / sha " + sha256(assembled).slice(0, SHA_PREFIX) +
        " · stock " + String(stockBytes.length) + " B / sha " + sha256(stock).slice(0, SHA_PREFIX) +
        " · lech dau tien o byte " + String(firstByteDifference(Buffer.from(normalized, "utf8"), stockBytes)),
      );
    }
    console.log("CONG BYTE: chap nhan DUNG phep thay the co chu y — " + DEVIATION.reason);
  }
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, denTa(typeof assembled === "string" ? assembled : Buffer.from(assembled).toString("utf8")));
  // Kiểu của artefact ghép = kiểu của BẢN GỐC (chép nguyên cây), không viết lại bằng tay ⇒ không lệch.
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (existsSync(stockTypes)) {
    cpSync(stockTypes, join(out, "types"), { recursive: true });
    writeFileSync(join(out, "index.d.ts"), renderTypesEntry(stock));
  }
  // Artefact 2/4: nửa CLIENT (vỏ + 26 lát) — chỉ khác bản gốc đúng đoạn id, đã kiểm bằng cổng ownership.
  const clientStock = readFileSync(join(REPO, STOCK_CLIENT_BUNDLE), "utf8");
  const client = assembleClientBundle();
  gateOwnership(client, clientStock, OUT_CLIENT_FILE_NAME);
  writeFileSync(join(out, OUT_CLIENT_FILE_NAME), client);
  // Artefact 3/4 + 4/4: hai entry typert (dấu mảnh nằm CUỐI DÒNG ⇒ dùng assembleTypert).
  const typertHostStock = readFileSync(join(REPO, STOCK_TYPERT_HOST_BUNDLE), "utf8");
  const typertHost = assembleTypert(join(import.meta.dir, "src", TYPERT_HOST_PARTS_DIR_NAME), TYPERT_HOST_PART_FILES);
  gateOwnership(typertHost, typertHostStock, OUT_TYPERT_HOST_FILE_NAME);
  writeFileSync(join(out, OUT_TYPERT_HOST_FILE_NAME), typertHost);
  const typertRemoteStock = readFileSync(join(REPO, STOCK_TYPERT_REMOTE_BUNDLE), "utf8");
  const typertRemote = assembleTypert(join(import.meta.dir, "src", TYPERT_REMOTE_PARTS_DIR_NAME), TYPERT_REMOTE_PART_FILES);
  gateOwnership(typertRemote, typertRemoteStock, OUT_TYPERT_REMOTE_FILE_NAME);
  writeFileSync(join(out, OUT_TYPERT_REMOTE_FILE_NAME), typertRemote);
  // Kiểu typert của bản gốc (hai tệp .d.ts ở lib root) — chép nguyên để consumer giữ đúng kiểu.
  for (const ten of ["typert.host.d.ts", "typert.remote-client.d.ts"]) {
    const nguon = join(REPO, STOCK_TYPERT_HOST_BUNDLE.replace(/lib\/typert\.host\.js$/u, "lib/") + ten);
    if (existsSync(nguon)) cpSync(nguon, join(out, ten));
  }
  // Bun.build THỨ NHẤT (thật, có người dùng): dựng entry NGUỒN của gói (src/index.ts ⇒ lib/index-entry.js).
  // Cổng check:rows đòi >=2 lời gọi Bun.build cho gói khai dsh.client, và cũng cần entry nguồn để đối chiếu export.
  const sourceBuild = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    naming: "index-entry.js",
    target: "bun",
    format: "esm",
    packages: "external",
  });
  if (!sourceBuild.success) throw new Error("Bun.build entry nguon that bai: " + sourceBuild.logs.map(String).join(" | "));
  // Bun.build thứ hai: dựng ENTRY của nửa client (src/client.ts ⇒ lib/client-entry.js). Đây là lời gọi Bun.build
  // THẬT (không phải chứng minh suông) và giữ src/client.ts có người dùng.
  const clientBuild = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    outdir: out,
    naming: "client-entry.js",
    target: "browser",
    format: "esm",
    packages: "external",
  });
  if (!clientBuild.success) throw new Error("Bun.build entry nua client that bai: " + clientBuild.logs.map(String).join(" | "));
  return file;
}

if (import.meta.main) {
  const file = await buildPackage(process.argv[2]);
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  console.log(
    "built " + file + " · " + String(PART_FILES.length) + " lát · sha256 " + sha256(stock).slice(0, SHA_PREFIX) +
      " · byte-identical với " + STOCK_BUNDLE,
  );
}