/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-api-remotes: lib/index.js = nửa HOST (Bun.build) · lib/client.js = nửa
 *      BROWSER ghép CƠ HỌC 1:1 từ 24 part nguyên văn + vỏ loader, CHỈ đổi dòng id module sang id của ta,
 *      có CỔNG BYTE so với bundle gốc đã quy đổi id (lệch 1 byte là DỪNG).
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleClient, CLIENT_LOADER_SHAPE, OUR_CLIENT_ID, readWrapper, STOCK_CLIENT_ID } from "./src/client.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Bundle gốc (CHỈ ĐỌC) — oracle của cổng byte. */
const STOCK_CLIENT = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-remotes", "lib", "client.js");

/**
 * Băm sha256 một chuỗi UTF-8 để ghi bằng chứng byte.
 * Nhận: text — chuỗi cần băm.
 * Trả: chuỗi hex sha256.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Vị trí ký tự ĐẦU TIÊN khác nhau giữa hai chuỗi (báo lỗi cổng byte có địa chỉ).
 * Nhận: left — chuỗi thực tế; right — chuỗi mong đợi.
 * Trả: chỉ số ký tự đầu tiên khác, hoặc -1 khi bằng nhau.
 */
function firstDifference(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) if (left[index] !== right[index]) return index;
  return left.length === right.length ? -1 : limit;
}

/**
 * Build nửa BROWSER: ghép part, kiểm KHUÔN VỎ, kiểm id, rồi so CỔNG BYTE với bundle gốc đã quy đổi id.
 * Nhận: outDir — thư mục lib đích.
 * Trả: không; ném lỗi (kèm địa chỉ byte + sha256 hai bên) khi lệch cổng.
 */
export function buildClient(outDir: string): void {
  const stock = readFileSync(STOCK_CLIENT, "utf8");
  const assembled = assembleClient();
  // CỔNG 1: KHUÔN VỎ — 3 dòng đầu phải đúng khuôn công bố, id là id CỦA TA, không còn id gốc.
  const head = readWrapper().head;
  if (head[0] !== "window.__ModuleLoader__.load({") throw new Error("vỏ client: dòng đầu không phải load({");
  if (!(head[1] ?? "").includes(OUR_CLIENT_ID)) throw new Error("vỏ client: dòng id không phải id của ta");
  if ((head[1] ?? "").includes(STOCK_CLIENT_ID)) throw new Error("vỏ client: còn id GỐC trong vỏ");
  if (head[2] !== "	factory: (require) => {") throw new Error("vỏ client: dòng mở factory không đúng");
  const shape = CLIENT_LOADER_SHAPE.slice(0, CLIENT_LOADER_SHAPE.indexOf("factory:")).replace(/[,\s]+$/u, "");
  if (!shape.includes(OUR_CLIENT_ID) || !shape.startsWith("window.__ModuleLoader__.load({ id:")) {
    throw new Error("CLIENT_LOADER_SHAPE không đúng khuôn: " + CLIENT_LOADER_SHAPE);
  }
  // CỔNG 2: BYTE — bản ghép phải bằng bundle gốc ĐÃ QUY ĐỔI ID (tiền lệ typert-gateway).
  const expected = stock.split(STOCK_CLIENT_ID).join(OUR_CLIENT_ID);
  if (assembled !== expected) {
    throw new Error(
      "nửa client KHÔNG trùng bản gốc (sau quy đổi id): ghép " +
        String(assembled.length) +
        " B / sha " +
        sha256(assembled) +
        " · gốc-quy-đổi " +
        String(expected.length) +
        " B / sha " +
        sha256(expected) +
        " · lệch đầu tiên ở ký tự " +
        String(firstDifference(assembled, expected)) +
        " — DỪNG build",
    );
  }
  // CỔNG 2b: OWNERSHIP — mọi typeSymbol/package của GÓI TA mà bundle client trích dẫn phải trỏ id CỦA TA.
  // Part vẫn NGUYÊN VĂN (luật de-bundle: evidence byte ở trên), phép đổi chạy SAU cổng byte nên bằng chứng không mất.
  // Bảng dưới: [id stock của gói ta, id ta]. Số kỳ vọng đo TỪ CHÍNH bundle gốc (không hard-code).
  const OWNERSHIP: readonly (readonly [stockId: string, oursId: string])[] = [
    ["@deepseek-ai/dsh-llm", "@galaxy-blackhole/gbh-llm"],
    ["@deepseek-ai/dsh-cordis-host-runner", "@galaxy-blackhole/gbh-host-cordis-host-runner"],
  ];
  let owned = assembled;
  for (const [stockId, oursId] of OWNERSHIP) {
    const expectedCount = stock.split(stockId).length - 1;
    const pattern = new RegExp(stockId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") + "(?![A-Za-z0-9_-])", "gu");
    owned = owned.replace(pattern, oursId);
    const stockLeft = owned.split(stockId).length - 1;
    const oursCount = owned.split(oursId).length - 1;
    if (stockLeft !== 0 || oursCount !== expectedCount) {
      throw new Error("cổng ownership " + stockId + ": còn id stock " + String(stockLeft) + " lần, id ta " + String(oursCount) + " lần (kỳ vọng 0/" + String(expectedCount) + ") — DỪNG build");
    }
  }
  // CỔNG 3: id gốc phải BIẾN MẤT, id ta xuất hiện ĐÚNG MỘT lần (luật MỘT-ID).
  const stockLeft = owned.split(STOCK_CLIENT_ID).length - 1;
  const oursCount = owned.split(OUR_CLIENT_ID).length - 1;
  if (stockLeft !== 0 || oursCount !== 1) {
    throw new Error("cổng id: id gốc còn " + String(stockLeft) + " lần, id ta " + String(oursCount) + " lần (kỳ vọng 0/1) — DỪNG build");
  }
  writeFileSync(join(outDir, "client.js"), owned);
  console.log(
    "client: " +
      String(owned.length) +
      " ký tự (gốc " +
      String(stock.length) +
      ", +" +
      String(owned.length - stock.length) +
      " byte do id dài hơn + ownership llm) · sha256 " +
      sha256(owned) +
      " · id gốc còn lại: 0 lần",
  );
}

/**
 * Build package thành hai đầu ra: lib/index.js (host) + lib/client.js (browser).
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package).
 * Trả: đường dẫn file host đã build.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const host = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!host.success) throw new Error("build nửa host thất bại: " + host.logs.map((log) => String(log)).join(" | "));
  buildClient(out);
  // Build THỨ HAI: biên dịch entry nửa client (src/client.ts) — đây là bằng chứng build nửa client mà
  // tools/check/rows.ts đòi (≥ 2 lời gọi Bun.build), đồng thời kiểm cú pháp entry ngay trong build.
  const clientEntry = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "client-entry.js",
    packages: "external",
  });
  if (!clientEntry.success) throw new Error("build entry nửa client thất bại: " + clientEntry.logs.map((log) => String(log)).join(" | "));
  return join(out, "index.js");
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])));
}
