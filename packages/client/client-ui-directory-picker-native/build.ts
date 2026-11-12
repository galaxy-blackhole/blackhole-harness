/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build client-ui-directory-picker-native: 2 artefact (host byte-identical + client ownership) + lib/types + 2 lời gọi Bun.build TÁCH RỜI
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { assembleClientBundle } from "./src/assemble-client.ts";
import {
  CLIENT_ID_REPLACEMENTS,
  HOST_PARTS_DIR_NAME,
  OUT_CLIENT_FILE_NAME,
  OUT_FILE_NAME,
  PACKAGE_NAME,
  STOCK_BUNDLE,
  STOCK_CLIENT_BUNDLE,
  STOCK_ID,
} from "./src/manifest.ts";

/** Gốc repo (packages/client/client-ui-directory-picker-native ⇒ ../../.. ⇒ repo root). */
const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * Băm SHA-256 một chuỗi.
 * Nhận: text — nội dung cần băm (UTF-8). Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Cổng BYTE TUYỆT ĐỐI cho nửa host.
 * Nhận: assembled — văn bản ghép; stock — văn bản gốc. Trả: không (ném khi lệch).
 */
function assertByteIdentical(assembled: string, stock: string): void {
  if (!Buffer.from(assembled, "utf8").equals(Buffer.from(stock, "utf8"))) {
    throw new Error("host: KHONG trung bundle goc: " + String(Buffer.byteLength(assembled)) + " B / sha " + sha256(assembled).slice(0, 16));
  }
}

/**
 * Cổng OWNERSHIP cho nửa client: chuẩn hoá id ta→stock rồi so byte + kiểm ĐÚNG số lần id ta.
 * Nhận: assembled — văn bản ghép; stock — văn bản gốc; soLanDoi — số lần id ta kỳ vọng. Trả: không (ném khi lệch).
 */
function gateOwnership(assembled: string, stock: string, soLanDoi: number): void {
  // Số lần id của TA phải ĐÚNG bằng số chỗ đã đổi tên (gói này: 1 — chỉ dòng loader).
  // KHÔNG dùng luật 'không còn id stock': thân bundle có id stock là DỮ LIỆU (CSS module tagId, dataset.plugin).
  const chuanHoa = assembled.split("@galaxy-blackhole/gbh-client-ui-primitives").join("@deepseek-ai/dsh-client-ui-primitives").split("@galaxy-blackhole/gbh-client-store").join("@deepseek-ai/dsh-client-store").split("@galaxy-blackhole/gbh-typert-generator").join("@deepseek-ai/dsh-typert-generator").split(PACKAGE_NAME).join(STOCK_ID);
  if (!Buffer.from(chuanHoa, "utf8").equals(Buffer.from(stock, "utf8"))) {
    throw new Error("client: KHONG trung sau khi chuan hoa id: " + String(Buffer.byteLength(chuanHoa)) + " B / sha " + sha256(chuanHoa).slice(0, 16));
  }
  const dem = assembled.split(PACKAGE_NAME).length - 1;
  if (dem !== soLanDoi) throw new Error("client: so lan id cua ta = " + String(dem) + " nhung ky vong " + String(soLanDoi));
}

/**
 * Build hai artefact + kiểu + hai entry Bun.build.
 * Nhận: outDir — thư mục đích (mặc định <gói>/lib). Trả: đường dẫn lib/index.js.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  // 1/2 — nửa host: ghép lát NGUYÊN VĂN, cổng byte tuyệt đối.
  const assembled = assembleBundle(join(import.meta.dir, "src", HOST_PARTS_DIR_NAME));
  assertByteIdentical(assembled, readFileSync(join(REPO, STOCK_BUNDLE), "utf8"));
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, assembled);
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (existsSync(stockTypes)) {
    cpSync(stockTypes, join(out, "types"), { recursive: true });
    writeFileSync(join(out, "index.d.ts"), 'export * from "./types/index.js";' + String.fromCharCode(10));
  }
  // 2/2 — nửa client (chỉ đổi dòng loader; các id stock trong thân là DỮ LIỆU).
  const client = assembleClientBundle();
  gateOwnership(client, readFileSync(join(REPO, STOCK_CLIENT_BUNDLE), "utf8"), CLIENT_ID_REPLACEMENTS);
  writeFileSync(join(out, OUT_CLIENT_FILE_NAME), client);
  // Bun.build THỨ NHẤT: entry nguồn ⇒ lib/index-entry.js.
  const sourceBuild = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "index.ts")], outdir: out, naming: "index-entry.js", target: "bun", format: "esm", packages: "external" });
  if (!sourceBuild.success) throw new Error("Bun.build entry nguon that bai: " + sourceBuild.logs.map(String).join(" | "));
  // Bun.build THỨ HAI (TÁCH RỜI): entry nửa client ⇒ lib/client-entry.js.
  const clientBuild = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "client.ts")], outdir: out, naming: "client-entry.js", target: "browser", format: "esm", packages: "external" });
  if (!clientBuild.success) throw new Error("Bun.build entry nua client that bai: " + clientBuild.logs.join(" | "));
  return file;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])) + " · 2 artefact + types + 2 entry");
}

// 19/10/2026 (task-153 lô 3 — Lead duyệt): đổi TÊN BIẾN GLOBAL __DSH_* → __DSH_* trong ARTEFACT.
// Cổng: assertRenameOnly + giữ nguyên DIST_READ_NAMES (__GBH_BOOT__ v.v. — vỏ SPA dist đang đọc).
const OUT_DIR = process.argv[2] ?? join(import.meta.dir, "lib");
const ART_client_js = join(OUT_DIR, "client.js" );

