/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc De-bundle NHANH cho nửa client: sinh lát nguyên văn từ bundle gốc rồi build lại artefact của ta
 *      (quy id stock → id ta + brand rename + CHUẨN HOÁ ID SEED cho mọi require()), kèm CỔNG BYTE hai chiều.
 *      Dùng cho các gói còn thiếu nội dung trong docs/CONVERSION-GAPS.md. KHÔNG sửa tay lát nào.
 *      ⚠️ 08/11/2026 (Lead chốt): CHỈ dùng cho gói cắt lát CHUNG `part-NN.ts`. Gói có `src/manifest.ts` khai
 *      `PART_FILES` tên NGỮ NGHĨA thì CẤM chạy (chạy sẽ xoá mất 40+ lát có tên, sự cố ui-schedule) — công cụ
 *      nay TỰ CHẶN trước khi ghi bất cứ tệp nào.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { splitStockBundle } from "./gen-client-parts.ts";
import { chuanHoaIdSeed } from "./lib/id-normalize.ts";
import { applyBrandRename, reverseBrandRename } from "../packages/tools/brand-rename/src/index.ts";

/** Gốc repo (tools ⇒ ..). */
const REPO = join(import.meta.dir, "..");

/** Header 5 dòng + dòng ghi chú sinh tự động cho artefact client. */
const HEADER = [
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 20/10/2026",
  " * desc Nửa client — sinh từ lát NGUYÊN VĂN của bundle gốc (tools/debundle-client.ts), quy id + brand",
  " */",
].join(String.fromCharCode(10));

/**
 * Đọc các lát nguyên văn (bỏ header 5–7 dòng + dòng @ts-nocheck) rồi nối lại thành thân bundle gốc.
 * Nhận: partsDir — thư mục `src/parts`. Trả: văn bản bundle gốc (không header).
 */
export function readParts(partsDir: string): string {
  const files = readdirSorted(partsDir);
  const bodies = files.map((file) => {
    const text = readFileSync(file, "utf8");
    const lines = text.split(String.fromCharCode(10));
    const start = lines.findIndex((line) => line.includes("@ts-nocheck"));
    const body = lines.slice(start + 1);
    // Generator chèn `export {};` ở cuối mỗi lát (để tệp là module hợp lệ với TS) ⇒ bỏ đúng dòng đó khi ghép.
    while (body.length > 0 && (body[body.length - 1] === "export {};" || body[body.length - 1] === "")) body.pop();
    return body.join(String.fromCharCode(10));
  });
  return bodies.join(String.fromCharCode(10));
}

/**
 * Liệt kê tệp lát theo thứ tự tên (part-01, part-02, …).
 * Nhận: dir — thư mục. Trả: mảng đường dẫn tuyệt đối đã sắp xếp.
 */
function readdirSorted(dir: string): string[] {
  const { readdirSync } = require("node:fs") as { readdirSync: (p: string) => string[] };
  return readdirSync(dir).filter((n) => n.endsWith(".ts")).sort().map((n) => join(dir, n));
}

/**
 * Sinh nửa client cho MỘT gói: cắt lát từ bundle gốc, build artefact của ta, kiểm cổng byte hai chiều.
 * Nhận: pkgDir — thư mục gói (vd `packages/client/ui-jobs`); stockId — id gói gốc; ourId — id gói ta.
 * Trả: báo cáo ngắn (số lát, byte trước/sau, cổng byte đạt hay không).
 */
export function debundleClient(pkgDir: string, stockId: string, ourId: string): string {
  const stockPath = join(REPO, "apps", "host", "node_modules", stockId, "lib", "client.js");
  if (!existsSync(stockPath)) return "THIEU bundle goc: " + stockPath;
  // CHẶN AN TOÀN (08/11/2026, sau sự cố ui-schedule): gói cắt lát THEO TÊN NGỮ NGHĨA (src/manifest.ts khai
  // PART_FILES) KHÔNG được de-bundle bằng công cụ này — nó sẽ xoá 40+ lát có tên + khối viết tay.
  const manifestPath = join(REPO, pkgDir, "src", "manifest.ts");
  if (existsSync(manifestPath) && /PART_FILES/.test(readFileSync(manifestPath, "utf8"))) {
    return "CẤM: " + pkgDir + " khai src/manifest.ts PART_FILES (cắt lát TÊN NGỮ NGHĨA) — công cụ này chỉ dùng cho gói cắt lát chung part-NN.ts.";
  }
  const partsDir = join(REPO, pkgDir, "src", "parts");
  const soLat = splitStockBundle(stockPath, partsDir);
  const stockText = readParts(partsDir);
  // 20/10/2026 (sửa theo phát hiện của tm-evidence): CHỈ đổi id ở DÒNG LOADER. Các lần xuất hiện khác của id
  // trong bundle gốc là DỮ LIỆU (khoá slot, owner id, nhãn) — bản gốc giữ id stock ở đó, đổi hết sẽ làm artefact
  // lệch khỏi bản build lại từ `src/` (drift) và sai parity 1:1.
  const loaderLine = 'id: "' + stockId + '",';
  if (!stockText.includes(loaderLine)) throw new Error("debundle: khong thay dong loader id stock trong " + stockPath);
  const forward = stockText.replace(loaderLine, 'id: "' + ourId + '",');
  // Bản TRƯỚC khi chuẩn hoá id seed — dùng cho CỔNG BYTE (chuẩn hoá là bước CÓ CHỦ ĐÍCH của ta, không phải
  // nội dung bundle gốc, nên cổng parity phải đo trên bản chưa chuẩn hoá).
  const artifactBase = HEADER + String.fromCharCode(10) + applyBrandRename(forward);
  // 08/11/2026 (Lead chốt, sau sự cố app đỏ): CHUẨN HOÁ ID SEED cho MỌI `require()` trong artefact sinh ra —
  // require id stock (`@deepseek-ai/dsh-client-store|ui-primitives|ui-slots`) thì shell không có trong module
  // table ⇒ app trắng. GIỮ `@deepseek-ai/cordis` (platform seed, KHÔNG đổi sang gbh-cordis).
  const chuanHoa = chuanHoaIdSeed(artifactBase);
  const artifact = chuanHoa.text;
  const libDir = join(REPO, pkgDir, "lib");
  mkdirSync(libDir, { recursive: true });
  writeFileSync(join(libDir, "client.js"), artifact);
  // CỔNG BYTE hai chiều: bỏ header + đảo brand + đảo id ⇒ phải TRÙNG TỪNG BYTE bundle gốc.
  const body = artifactBase.split(String.fromCharCode(10)).slice(HEADER.split(String.fromCharCode(10)).length).join(String.fromCharCode(10));
  const roundTrip = reverseBrandRename(body).replace('id: "' + ourId + '",', 'id: "' + stockId + '",');
  const goc = readFileSync(stockPath, "utf8");
  const dat = roundTrip === goc || roundTrip === goc.trimEnd();
  const seedNote = chuanHoa.doi.length > 0
    ? " · seed doi: " + chuanHoa.doi.map((d) => d.id + "→" + d.thanh + "×" + d.soLan).join(", ")
    : " · seed doi: 0";
  return (dat ? "DAT" : "HONG") + " · " + String(soLat) + " lat · ta " + String(Buffer.byteLength(artifact)) + " B · goc " + String(Buffer.byteLength(goc)) + " B" + seedNote;
}

if (import.meta.main) {
  const [pkgArg, stockId, ourId] = process.argv.slice(2);
  if (pkgArg === undefined || stockId === undefined || ourId === undefined) {
    console.log("dung: bun run tools/debundle-client.ts <pkgDir> <stockId> <ourId>");
    process.exit(1);
  }
  console.log(debundleClient(pkgArg, stockId, ourId));
}