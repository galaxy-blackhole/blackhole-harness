/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Di trú TỰ ĐỘNG một lần: lần boot đầu tiên của bản GBH, nếu credentials.yaml chưa có cờ
 *      "migrate: true" thì chạy di trú từ home cũ (~/.galaxy/gbh) sang home của ta, rồi ghi cờ.
 *      Nhờ vậy người dùng chuyển từ galaxy-code sang không bị "mất" phiên mà không phải nhớ lệnh.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { defaultNewHome, defaultOldHome, migrateHome, type MigrateReport } from "./migrate.ts";

/** Tên tệp cấu hình chia sẻ trong ~/.galaxy. */
export const CREDENTIALS_FILE = "credentials.yaml";

/** Kết quả một lần kiểm tra/di trú tự động. */
export interface AutoMigrateResult {
  /** Có chạy di trú lần này không. */
  ran: boolean;
  /** Lý do khi không chạy. */
  reason?: string;
  /** Báo cáo khi có chạy. */
  report?: MigrateReport;
  /** Đường dẫn credentials.yaml đã đọc/ghi. */
  credentialsPath: string;
}

/**
 * Cờ "đã di trú" trong credentials.yaml.
 * Nhận: nội dung tệp. Trả: true khi có dòng "migrate: true" ở cấp cao nhất.
 */
export function daDiTru(noiDung: string): boolean {
  return /^migrate:\s*true\s*$/mu.test(noiDung);
}

/**
 * Ghi cờ "migrate: true" vào nội dung credentials.yaml, giữ nguyên phần còn lại.
 * Nhận: nội dung tệp. Trả: nội dung mới (đã có cờ thì trả nguyên bản).
 */
export function ghiCoDiTru(noiDung: string): string {
  if (daDiTru(noiDung)) return noiDung;
  if (/^migrate:\s*(false|no)?\s*$/mu.test(noiDung)) {
    // `\s*` trong mẫu ăn luôn newline cuối ⇒ ghi bù để tệp vẫn kết thúc bằng xuống dòng.
    return noiDung.replace(/^migrate:\s*(false|no)?\s*$/mu, "migrate: true\n");
  }
  const ketThucXuongDong = noiDung === "" || noiDung.endsWith("\n") ? noiDung : noiDung + "\n";
  return ketThucXuongDong + "migrate: true\n";
}

/**
 * Di trú tự động một lần khi boot (Cách 1 người dùng chọn).
 * Quy tắc: chỉ chạy khi (a) credentials.yaml CHƯA có cờ migrate, (b) home cũ tồn tại và có sessions.
 * Không bao giờ ném lỗi ra ngoài: lỗi di trú chỉ làm mất phần mang sang, không được chặn app khởi động.
 * Nhận: thư mục ~/.galaxy (mặc định suy từ home) và cờ dryRun để chỉ in.
 * Trả: AutoMigrateResult.
 */
export function autoMigrate(options: {
  galaxyRoot: string;
  dryRun?: boolean;
  /** Ghi đè home cũ (dùng cho test). */
  from?: string;
  /** Ghi đè home mới (dùng cho test). */
  to?: string;
}): AutoMigrateResult {
  const credentialsPath = join(options.galaxyRoot, CREDENTIALS_FILE);
  const noiDung = existsSync(credentialsPath) ? readFileSync(credentialsPath, "utf8") : "";
  // 10/11/2026 (Lead): ĐỔI THIẾT KẾ — chạy MỖI LẦN BOOT chứ không chỉ lần đầu. Lý do đo được: người dùng
  // còn mở app Electron cũ, mà host của nó dùng DSH_HOME=~/.galaxy/gbh ⇒ phiên tạo bên đó KHÔNG tự sang
  // home của ta. Di trú là phép THÊM, idempotent, đo được 0 tệp khi không có gì mới (≈0,2 s) nên chạy
  // mỗi boot là cách rẻ nhất để hai home không lệch nhau. Cờ migrate: true vẫn ghi để biết "đã từng di trú".
  const daTung = daDiTru(noiDung);
  const cu = options.from ?? defaultOldHome();
  const moi = options.to ?? defaultNewHome();
  if (!existsSync(join(cu, "sessions"))) {
    return { ran: false, reason: "home cũ không có sessions", credentialsPath };
  }
  if (cu === moi) return { ran: false, reason: "home cũ trùng home mới", credentialsPath };
  const report = migrateHome({ from: cu, to: moi, dryRun: options.dryRun === true });
  if (options.dryRun !== true && (report.copied > 0 || !daTung)) {
    writeFileSync(credentialsPath, ghiCoDiTru(noiDung));
  }
  return { ran: true, report, credentialsPath };
}
