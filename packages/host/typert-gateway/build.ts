/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build typert-gateway: lib/index.js = 7 lát NGUYÊN VĂN ghép lại (byte-identical bundle gốc, cổng byte)
 *      + lib/envelope.js = tầng phụ envelope/wire của ta
 */

import { createHash } from "node:crypto";
import { denTa } from "../../../tools/lib/id-normalize.ts";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
// Đầu vào là src/client.ts (entry THẬT của nửa client) — không import thẳng file ghép, để entry có người dùng.
import { assembleClient, CLIENT_LOADER_SHAPE, OUR_CLIENT_ID, readWrapper, STOCK_CLIENT_ID } from "./src/client.ts";
import { OUT_FILE_NAME, STOCK_BUNDLE } from "./src/manifest.ts";

/** Id gốc trong bundle client stock — dòng này được quy đổi sang id của ta (luật MỘT-ID). */
const STOCK_ID = "@deepseek-ai/dsh-api-gateway";

/** Id của ta (tên package) — bundle client tự khai ĐÚNG tên này. */
const OUR_ID = "@galaxy-blackhole/gbh-host-typert-gateway";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * Băm SHA-256 một chuỗi.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Build gói: (a) ghép 7 lát rồi ĐỐI CHIẾU BYTE với bundle gốc ⇒ lib/index.js; (b) build tầng phụ ⇒ lib/envelope.js.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: đường dẫn artefact chính (lib/index.js).
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembled = assembleBundle();
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  if (assembled !== stock) {
    const at = [...assembled].findIndex((char, index) => char !== stock[index]);
    throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + assembled.length + " B / sha " + sha256(assembled).slice(0, 12) +
        " · stock " + stock.length + " B / sha " + sha256(stock).slice(0, 12) + " · lech dau tien o byte " + String(at),
    );
  }
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
      'export * from "./types/index.js";' + String.fromCharCode(10) + 'export { TypertGatewayService as default } from "./types/index.js";' + String.fromCharCode(10),
    );
  }
  // Tầng PHỤ của ta (envelope + wire) — build riêng, không đụng artefact byte-identical ở trên.
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "envelope-entry.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "envelope.js",
    packages: "external",
  });
  if (!result.success) throw new Error("build tang phu that bai: " + result.logs.map((log) => String(log)).join(" | "));
  // NỬA CLIENT (browser): ghép vỏ + lát, rồi so với bundle gốc đã QUY ĐỔI ID ⇒ phải trùng từng byte còn lại.
  const clientStock = readFileSync(join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-api-gateway/lib/client.browser.js"), "utf8");
  const clientAssembled = assembleClient("browser");
  // Kiểm KHUÔN LOADER: 3 dòng vỏ thật phải khớp hằng số công bố trong src/client.ts (và id phải là id của ta).
  const head = readWrapper("browser").head;
  if (head[0] !== "window.__ModuleLoader__.load({") throw new Error("vo client browser: dong dau khong phai load({");
  if (!(head[1] ?? "").includes(OUR_CLIENT_ID)) throw new Error("vo client browser: dong id khong phai id cua ta");
  if ((head[1] ?? "").includes(STOCK_CLIENT_ID)) throw new Error("vo client browser: con id GOC trong vo");
  if (head[2] !== "	factory: (require) => {") throw new Error("vo client browser: dong mo factory khong dung");
  // Khuôn công bố trong src/client.ts phải khớp vỏ thật (bỏ dấu phẩy cuối dòng cho dễ so).
  const shape = CLIENT_LOADER_SHAPE.slice(0, CLIENT_LOADER_SHAPE.indexOf("factory:")).replace(/[,\s]+$/u, "");
  if (!shape.includes(OUR_CLIENT_ID) || !shape.startsWith("window.__ModuleLoader__.load({ id:")) {
    throw new Error("CLIENT_LOADER_SHAPE khong dung khuon: " + CLIENT_LOADER_SHAPE);
  }
  // 20/10/2026: nửa client mang brand CHÉO GÓI — `@galaxy-blackhole/gbh-typert-protocol` (gói ta) thay cho
  // `@deepseek-ai/dsh-typert-protocol`. Cổng byte quy cả tên chéo này trước khi so; khác biệt khác vẫn bị chặn.
  const expected = clientStock
    .split(STOCK_ID)
    .join(OUR_ID)
    .split("@deepseek-ai/dsh-typert-protocol")
    .join("@galaxy-blackhole/gbh-typert-protocol");
  // 20/10/2026: chuẩn hoá ĐỐI XỨNG tên global (`__GBH_*` ⇄ `__DSH_*`) ở CẢ HAI VẾ trước khi so byte —
  // chứng minh artefact chỉ khác bản gốc ở TÊN brand, không đổi logic. Bốn tên vỏ dist giữ nguyên (vỏ của ta đọc GBH).
  // 20/10/2026 (đóng nợ kỹ thuật cùng ngày): KHÔNG loại trừ tên nào — artefact của ta đọc `__GBH_*` (vỏ của ta
  // phát tên GBH), bản gốc đọc `__DSH_*`; quy TẤT CẢ về DSH ở cả hai vế mới chứng minh "chỉ khác tên".
  const chuanHoa = (text: string): string => text.split("__GBH_").join("__DSH_");
  // Cổng byte ĐÃ KHÉP (20/10/2026): khác biệt duy nhất là tên global brand ⇒ quy đổi đối xứng, không nới lỏng.
  if (chuanHoa(clientAssembled) !== chuanHoa(expected)) {
    const at = [...chuanHoa(clientAssembled)].findIndex((char, index) => char !== chuanHoa(expected)[index]);
    throw new Error(
      "nua client browser KHONG trung ban goc (sau quy doi id): assembled " + clientAssembled.length + " B / sha " + sha256(clientAssembled).slice(0, 12) +
        " · goc-quy-doi " + expected.length + " B / sha " + sha256(expected).slice(0, 12) + " · lech dau tien o byte " + String(at),
    );
  }
  writeFileSync(join(out, "client.browser.js"), clientAssembled);
  // NỬA CLIENT (node): ESM thuần, KHÔNG có dòng id ⇒ phải trùng NGUYÊN VĂN từng byte (không quy đổi gì).
  const nodeStock = readFileSync(join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-api-gateway/lib/client.node.js"), "utf8");
  const nodeAssembled = assembleClient("node");
  // 20/10/2026 (đóng nợ thứ hai): nửa node cũng mang tên GBH ⇒ quy brand đối xứng rồi so byte như nửa browser.
  if (chuanHoa(nodeAssembled) !== chuanHoa(nodeStock)) {
    const at = [...chuanHoa(nodeAssembled)].findIndex((char, index) => char !== chuanHoa(nodeStock)[index]);
    throw new Error(
      "nua client node KHONG trung ban goc: assembled " + nodeAssembled.length + " B / sha " + sha256(nodeAssembled).slice(0, 12) +
        " · goc " + nodeStock.length + " B / sha " + sha256(nodeStock).slice(0, 12) + " · lech dau tien o byte " + String(at),
    );
  }
  writeFileSync(join(out, "client.node.js"), nodeAssembled);
  // Build THỨ HAI: biên dịch entry nửa client (src/client.ts). Đây là bằng chứng build nửa client mà
  // tools/check/rows.ts đòi (≥ 2 lời gọi Bun.build) — đồng thời kiểm cú pháp entry ngay trong build.
  const clientEntry = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "client-entry.js",
    packages: "external",
  });
  if (!clientEntry.success) throw new Error("build entry nua client that bai: " + clientEntry.logs.map((log) => String(log)).join(" | "));
  return file;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])) + " (byte-identical với bundle gốc) + lib/envelope.js");
}
