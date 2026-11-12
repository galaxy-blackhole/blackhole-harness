/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build api-terminal-controller: lib/index.js = 7 lát NGUYÊN VĂN ghép lại (byte-identical bundle gốc, cổng byte)
 *      + lib/types (chép từ bản gốc) + lib/index.d.ts (khai báo kiểu trỏ vào cây vừa chép)
 */

import { createHash } from "node:crypto";
import { denTa } from "../../../tools/lib/id-normalize.ts";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { assembleClientBundle } from "./src/assemble-client.ts";
import { assembleTypert } from "./src/assemble-typert.ts";
import {
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

/** Gốc repo (packages/host/api-terminal-controller ⇒ ../../..). */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/**
 * Băm SHA-256 một chuỗi.
 * Nhận: text — nội dung cần băm (UTF-8).
 * Trả: chuỗi hex đầy đủ 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Tìm vị trí BYTE lệch đầu tiên giữa hai văn bản UTF-8.
 * Nhận: left — văn bản thứ nhất; right — văn bản thứ hai.
 * Trả: chỉ số byte 0-based của chỗ lệch đầu tiên; -1 khi phần chung trùng hết (khác độ dài).
 */
function firstDifferingByte(left: string, right: string): number {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  const common = Math.min(a.length, b.length);
  for (let index = 0; index < common; index += 1) if (a[index] !== b[index]) return index;
  return -1;
}

/**
 * Cổng BYTE: đối chiếu bản ghép với bundle gốc, lệch một byte là ném lỗi kèm số đo hai bên.
 * Nhận: assembled — văn bản vừa ghép từ các lát; stock — nội dung bundle gốc (CHỈ ĐỌC).
 * Trả: không trả gì; ném Error khi lệch nội dung hoặc lệch độ dài.
 */
export function assertByteIdentical(assembled: string, stock: string): void {
  if (assembled === stock) return;
  const at = firstDifferingByte(assembled, stock);
  throw new Error(
    "ban ghep KHONG trung bundle goc: assembled " + Buffer.byteLength(assembled, "utf8") + " B / sha " + sha256(assembled).slice(0, 12) +
      " · stock " + Buffer.byteLength(stock, "utf8") + " B / sha " + sha256(stock).slice(0, 12) +
      " · lech dau tien o byte " + (at < 0 ? "khong co (khac DO DAI)" : String(at)),
  );
}

/**
 * Build gói: (1) ghép 7 lát nguyên văn; (2) cổng byte với bundle gốc; (3) ghi lib/index.js;
 * (4) chép cây lib/types của bản gốc; (5) sinh lib/index.d.ts trỏ vào cây kiểu vừa chép.
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
  if (!Buffer.from(chuanHoa, "utf8").equals(Buffer.from(stock, "utf8"))) {
    throw new Error(nhan + ": ban ghep KHONG trung ban goc sau khi chuan hoa id: chuan-hoa " + String(Buffer.byteLength(chuanHoa)) + " B / sha " + sha256(chuanHoa).slice(0, 12) + " · stock " + String(Buffer.byteLength(stock)) + " B / sha " + sha256(stock).slice(0, 12));
  }
  if (assembled.split(STOCK_ID).length !== 1) throw new Error(nhan + ": con sot id GOC trong ban ghep");
}

/**
 * Build TOÀN BỘ bốn artefact: nửa host (index.js, byte-identical) · nửa client (client.js, quy đổi id) ·
 * hai entry typert (typert.host.js · typert.remote-client.js, quy đổi ownership) + chép kiểu gốc + 2 entry Bun.build.
 * Nhận: outDir — thư mục đích (mặc định <gói>/lib).
 * Trả: đường dẫn lib/index.js vừa ghi.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembled = assembleBundle();
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  assertByteIdentical(assembled, stock);
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, denTa(typeof assembled === "string" ? assembled : Buffer.from(assembled).toString("utf8")));
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (existsSync(stockTypes)) {
    cpSync(stockTypes, join(out, "types"), { recursive: true });
    // Khai báo KIỂU cho artefact ghép: trỏ thẳng vào cây .d.ts vừa chép ⇒ consumer giữ ĐÚNG kiểu của bản gốc,
    // không phải viết lại kiểu bằng tay (tránh lệch). Tệp nằm trong lib/ (sinh tự động, không git).
    writeFileSync(
      join(out, "index.d.ts"),
      'export * from "./types/index.js";' + EOL + 'export { TerminalController as default } from "./types/index.js";' + EOL,
    );
  }
  // Artefact 2/4: nửa CLIENT (vỏ + 10 lát) — chỉ khác bản gốc đúng đoạn id, kiểm bằng cổng ownership.
  const clientStock = readFileSync(join(REPO, STOCK_CLIENT_BUNDLE), "utf8");
  const client = assembleClientBundle();
  gateOwnership(client, clientStock, OUT_CLIENT_FILE_NAME);
  writeFileSync(join(out, OUT_CLIENT_FILE_NAME), client);
  // Artefact 3/4 + 4/4: hai entry typert (dấu mảnh có thể nằm cuối dòng ⇒ assembleTypert).
  const typertHostStock = readFileSync(join(REPO, STOCK_TYPERT_HOST_BUNDLE), "utf8");
  const typertHost = assembleTypert(join(import.meta.dir, "src", TYPERT_HOST_PARTS_DIR_NAME), TYPERT_HOST_PART_FILES);
  gateOwnership(typertHost, typertHostStock, OUT_TYPERT_HOST_FILE_NAME);
  writeFileSync(join(out, OUT_TYPERT_HOST_FILE_NAME), typertHost);
  const typertRemoteStock = readFileSync(join(REPO, STOCK_TYPERT_REMOTE_BUNDLE), "utf8");
  const typertRemote = assembleTypert(join(import.meta.dir, "src", TYPERT_REMOTE_PARTS_DIR_NAME), TYPERT_REMOTE_PART_FILES);
  gateOwnership(typertRemote, typertRemoteStock, OUT_TYPERT_REMOTE_FILE_NAME);
  writeFileSync(join(out, OUT_TYPERT_REMOTE_FILE_NAME), typertRemote);
  // Kiểu typert của bản gốc (2 tệp .d.ts ở lib root) — chép nguyên để consumer giữ đúng kiểu.
  for (const ten of ["typert.host.d.ts", "typert.remote-client.d.ts"]) {
    const nguon = join(REPO, STOCK_TYPERT_HOST_BUNDLE.replace(/lib\/typert\.host\.js$/u, "lib/") + ten);
    if (existsSync(nguon)) cpSync(nguon, join(out, ten));
  }
  // Bun.build THỨ NHẤT (thật, có người dùng): entry nguồn ⇒ lib/index-entry.js (check:rows đối chiếu export).
  const sourceBuild = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    naming: "index-entry.js",
    target: "bun",
    format: "esm",
    packages: "external",
  });
  if (!sourceBuild.success) throw new Error("Bun.build entry nguon that bai: " + sourceBuild.logs.map(String).join(" | "));
  // Bun.build THỨ HAI: entry nửa client ⇒ lib/client-entry.js.
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
  console.log("built " + (await buildPackage(process.argv[2])) + " · 4 artefact (host byte-identical + client/typert ownership) + lib/types + entry");
}