/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Đo 'entry GỐC còn đang chạy' bằng BẰNG CHỨNG SỐNG: tải trang app, lấy mọi id module
 *      @deepseek-ai/* trong payload, rồi phân giải từng id qua profiles/node_modules để biết nội dung
 *      đang phục vụ là GÓI CỦA TA hay BẢN STOCK trong kernel. Chỉ số đúng phải là: stock = 0.
 */

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Kết quả một lượt đo. */
interface KetQua {
  /** Tổng số id stock thấy trong payload. */ readonly tong: number;
  /** Số id phân giải về gói của ta. */ readonly cuaTa: number;
  /** Số id phân giải về bản stock trong kernel (phải bằng 0). */ readonly stock: number;
  /** Số id không tìm thấy trong profile (có thể do bundle gộp). */ readonly khongThay: number;
  /** Chi tiết các id bất thường. */ readonly batThuong: readonly string[];
}

/**
 * Đo phân giải module của payload đang phục vụ.
 * Nhận: html — nội dung trang app; profileModules — thư mục profiles/node_modules.
 * Trả: số đo {@link KetQua}.
 */
export function doPayload(html: string, profileModules: string): KetQua {
  const ids = [...new Set([...html.matchAll(/@deepseek-ai\/[a-z0-9-]+/gu)].map((m) => m[0]))].sort();
  const batThuong: string[] = [];
  let cuaTa = 0;
  let stock = 0;
  let khongThay = 0;
  for (const id of ids) {
    const duongDan = join(profileModules, id);
    if (!existsSync(duongDan)) {
      khongThay += 1;
      batThuong.push(id + " · KHONG THAY trong profile");
      continue;
    }
    const that = realpathSync(duongDan);
    if (that.includes("@galaxy-blackhole") || that.includes("/packages/")) cuaTa += 1;
    else {
      stock += 1;
      batThuong.push(id + " -> " + that);
    }
  }
  return { tong: ids.length, cuaTa, stock, khongThay, batThuong };
}

/** Chạy từ dòng lệnh: tải trang app (có cookie jar) rồi in số đo. */
async function main(): Promise<void> {
  const goc = join(homedir(), ".galaxy", "blackhole");
  const url = readFileSync(join(goc, "ready-url.txt"), "utf8").trim();
  const jar = "/tmp/gbh-payload-audit-cookies.txt";
  const proc = Bun.spawnSync(["curl", "-sL", "-c", jar, "-b", jar, "-o", "-", "-w", "%{http_code}", url], { stdout: "pipe" });
  const raw = proc.stdout.toString();
  const cat = raw.lastIndexOf("\n");
  const html = cat >= 0 ? raw.slice(0, cat) : raw;
  const status = cat >= 0 ? raw.slice(cat + 1).trim() : "?";
  const kq = doPayload(html, join(goc, "profiles", "node_modules"));
  console.log("HTTP " + status + " · " + String(kq.tong) + " id stock trong payload");
  console.log("phan giai ve GOI TA : " + String(kq.cuaTa));
  console.log("phan giai ve STOCK   : " + String(kq.stock) + (kq.stock === 0 ? "  (DAT: khong con entry goc)" : "  (KHONG DAT)"));
  console.log("khong thay trong profile: " + String(kq.khongThay));
  for (const d of kq.batThuong.slice(0, 10)) console.log("  - " + d);
}

if (import.meta.main) await main();
