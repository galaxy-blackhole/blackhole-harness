/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc De-bundle NỬA HOST của một gói: chép NGUYÊN VĂN cây `lib/` của gói gốc trong kernel
 *      (`apps/host/node_modules/@deepseek-ai/<stock>`) vào `lib/` của gói ta, rồi ghi tệp đánh dấu `.debundled`
 *      để `build.ts` không build đè (xem tools/debundle-guard.ts). Mục đích: các nửa host đang "mỏng" hơn
 *      bản gốc (ví dụ settings −4.514 B, settings-controller −9.112 B) làm HỎNG chức năng thật
 *      (ghi cài đặt, onboarding, công tắc…) — chép nguyên văn là cách 1:1 đã chứng minh ở phía client.
 *      Cổng hai chiều: sau khi chép, so lại từng byte giữa `lib/` ta và bản gốc.
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dir, "..");
const KERNEL = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");

/**
 * Liệt kê mọi tệp trong một cây (đệ quy, bỏ qua node_modules).
 * Nhận: dir — thư mục gốc; goc — tiền tố để tính đường dẫn tương đối.
 * Trả: mảng đường dẫn tương đối đã sắp xếp.
 */
function lietKe(dir: string, goc: string = dir): string[] {
  const out: string[] = [];
  for (const ten of readdirSync(dir)) {
    if (ten === "node_modules") continue;
    const abs = join(dir, ten);
    if (statSync(abs).isDirectory()) out.push(...lietKe(abs, goc));
    else out.push(abs.slice(goc.length + 1));
  }
  return out.sort();
}

const [pkgPath, stockId] = process.argv.slice(2);
if (pkgPath === undefined || stockId === undefined) {
  console.log("dung: bun run tools/debundle-host.ts <duong-dan-goi> <@deepseek-ai/ten-goi-goc>");
  process.exit(2);
}
const pkgDir = join(REPO, pkgPath);
const stockDir = join(KERNEL, stockId.replace("@deepseek-ai/", ""));
const stockLib = join(stockDir, "lib");
if (!existsSync(stockLib)) throw new Error("khong thay lib cua ban goc: " + stockLib);
const lib = join(pkgDir, "lib");
rmSync(lib, { recursive: true, force: true });
cpSync(stockLib, lib, { recursive: true });
writeFileSync(join(pkgDir, ".debundled"), JSON.stringify({ stock: stockId, at: new Date().toISOString() }, null, 2) + String.fromCharCode(10));
// Cổng hai chiều: từng tệp phải trùng byte với bản gốc.
const goc = lietKe(stockLib);
const ta = lietKe(lib);
if (goc.join("|") !== ta.join("|")) throw new Error("CONG TEP LECH: goc " + goc.length + " tep, ta " + ta.length + " tep");
for (const f of goc) {
  const a = readFileSync(join(stockLib, f));
  const b = readFileSync(join(lib, f));
  if (!a.equals(b)) throw new Error("CONG BYTE DO o " + f);
}
console.log("DAT · " + goc.length + " tep · " + stockId + " -> " + pkgPath + " · tat ca trung byte");
