/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Di trú dữ liệu người dùng từ home CŨ (galaxy-code chạy DSH: ~/.galaxy/gbh) sang home
 *      CỦA TA (~/.galaxy/blackhole): phiên, storages, attachments. Chỉ ĐỌC home cũ, chỉ THÊM vào
 *      home mới (không ghi đè, không xoá) ⇒ chạy lại nhiều lần vẫn an toàn.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";

/** Ba vùng dữ liệu người dùng cần mang sang (đúng bố cục cả hai hệ đang dùng). */
export const MIGRATE_AREAS = ["sessions", "storages", "attachments"] as const;
/** Tên một vùng dữ liệu. */
export type MigrateArea = (typeof MIGRATE_AREAS)[number];

/** Tham số một lần di trú. */
export interface MigrateOptions {
  /** Home cũ (chỉ đọc). */
  from: string;
  /** Home mới (chỉ thêm). */
  to: string;
  /** Vùng cần mang; mặc định cả ba. */
  areas?: readonly MigrateArea[];
  /** Chỉ in kế hoạch, không ghi gì. */
  dryRun?: boolean;
}

/** Kết quả một vùng. */
export interface AreaReport {
  /** Tên vùng. */
  area: string;
  /** Số tệp sẽ/đã chép. */
  copied: number;
  /** Số tệp đã có ở home mới nên bỏ qua. */
  skipped: number;
  /** Tổng byte sẽ/đã chép. */
  bytes: number;
}

/** Kết quả một lần di trú. */
export interface MigrateReport {
  /** Home cũ. */
  from: string;
  /** Home mới. */
  to: string;
  /** Có phải chế độ chỉ in kế hoạch. */
  dryRun: boolean;
  /** Báo cáo từng vùng. */
  areas: AreaReport[];
  /** Vùng không tồn tại ở home cũ. */
  missing: string[];
  /** Tổng số tệp sẽ/đã chép. */
  copied: number;
  /** Tổng số tệp bỏ qua. */
  skipped: number;
  /** Tổng byte sẽ/đã chép. */
  bytes: number;
}

/** Tệp không mang sang: khoá phiên đang chạy và rác hệ điều hành. */
const BO_QUA = new Set(["session.lock", ".DS_Store"]);

/**
 * Liệt kê MỌI tệp dưới một thư mục, dạng đường dẫn tương đối.
 * Nhận: thư mục gốc.
 * Trả: danh sách đường dẫn tương đối (rỗng nếu thư mục không tồn tại).
 */
export function lietKeTep(goc: string): string[] {
  if (!existsSync(goc)) return [];
  const ketQua: string[] = [];
  const duyet = (thuMuc: string): void => {
    for (const muc of readdirSync(thuMuc, { withFileTypes: true })) {
      if (BO_QUA.has(muc.name)) continue;
      const duong = join(thuMuc, muc.name);
      if (muc.isDirectory()) duyet(duong);
      else if (muc.isFile()) ketQua.push(relative(goc, duong));
    }
  };
  duyet(goc);
  ketQua.sort();
  return ketQua;
}

/**
 * Di trú dữ liệu người dùng từ home cũ sang home của ta.
 * Quy tắc: tệp đã có ở đích thì BỎ QUA (không ghi đè); chỉ chép tệp còn thiếu; không bao giờ xoá.
 * Nhận: tham số MigrateOptions.
 * Trả: báo cáo từng vùng và tổng.
 */
export function migrateHome(options: MigrateOptions): MigrateReport {
  const areas = options.areas ?? MIGRATE_AREAS;
  const dryRun = options.dryRun === true;
  const baoCao: AreaReport[] = [];
  const missing: string[] = [];
  for (const area of areas) {
    const nguon = join(options.from, area);
    if (!existsSync(nguon)) {
      missing.push(area);
      continue;
    }
    const muc: AreaReport = { area, copied: 0, skipped: 0, bytes: 0 };
    for (const tep of lietKeTep(nguon)) {
      const dich = join(options.to, area, tep);
      if (existsSync(dich)) {
        muc.skipped += 1;
        continue;
      }
      const co = statSync(join(nguon, tep)).size;
      muc.copied += 1;
      muc.bytes += co;
      if (dryRun) continue;
      mkdirSync(dirname(dich), { recursive: true });
      copyFileSync(join(nguon, tep), dich);
    }
    baoCao.push(muc);
  }
  const tong = baoCao.reduce(
    (acc, muc) => ({ copied: acc.copied + muc.copied, skipped: acc.skipped + muc.skipped, bytes: acc.bytes + muc.bytes }),
    { copied: 0, skipped: 0, bytes: 0 },
  );
  return { from: options.from, to: options.to, dryRun, areas: baoCao, missing, ...tong };
}

/**
 * Home CŨ mặc định của galaxy-code (bản chạy DSH đã sửa nhẹ).
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối ~/.galaxy/gbh.
 */
export function defaultOldHome(): string {
  return join(homedir(), ".galaxy", "gbh");
}

/**
 * Home MỚI mặc định (của bản Galaxy Blackhole này): theo GBH_HOME/DSH_HOME nếu có.
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối.
 */
export function defaultNewHome(): string {
  // 10/11/2026 (Lead): CHỈ đọc GBH_HOME. Không đọc DSH_HOME vì biến đó trỏ home của bản DSH
  // (galaxy-code) — đúng cái home CŨ mà ta đang di trú RA KHỎI; đọc nó sẽ khiến from == to.
  const tuBien = process.env["GBH_HOME"];
  return tuBien === undefined || tuBien.trim() === "" ? join(homedir(), ".galaxy", "blackhole") : tuBien;
}
