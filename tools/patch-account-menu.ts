/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Ẩn TẠM hai mục "Liên hệ (Feedback)" và "Đăng nhập/Đăng xuất" khỏi menu tài khoản trong artefact
 *      de-bundle của gói ui-settings-account. Artefact là bản sao NGUYÊN VĂN của bundle gốc (canon
 *      de-bundle), nên mọi thay đổi hành vi phải đi qua công cụ có ghi chép như tệp này — KHÔNG sửa tay.
 *      Chạy: bun run tools/patch-account-menu.ts [<đường dẫn artefact>]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tools ⇒ ..). */
const REPO = join(import.meta.dir, "..");

/** Đường dẫn artefact mặc định của gói ui-settings-account. */
const MAC_DINH = join(REPO, "packages", "client", "ui-settings-account", "lib", "client.js");

/** Dấu nhận biết bản vá đã áp — chạy lại nhiều lần vẫn an toàn. */
const DAU = "// 22/10/2026: ẩn tạm mục Liên hệ + Đăng nhập/Đăng xuất trong menu tài khoản.";

/**
 * Mẫu khối cần bỏ: mục "contact" rồi tới hết nhánh ba ngôi đăng nhập/đăng xuất.
 * Bắt đầu ở dòng mở object của mục contact, kết thúc ở "}]" đóng nhánh đăng nhập.
 */
const MAU = /\n\t+\{\n\t+id: "contact",[\s\S]*?\}\]\n/u;

/**
 * Áp bản vá ẩn mục menu vào artefact.
 * Nhận: duongDan — đường dẫn artefact client (mặc định theo repo).
 * Trả: "da an" khi có thay đổi · "da an truoc do" khi đã vá · "khong thay" khi artefact khác hình dạng.
 */
export function anMucMenu(duongDan: string = MAC_DINH): string {
  const truoc = readFileSync(duongDan, "utf8");
  if (truoc.includes(DAU)) return "da an truoc do";
  if (!MAU.test(truoc)) return "khong thay";
  const sau = truoc.replace(MAU, "\n" + DAU + "\n");
  writeFileSync(duongDan, sau);
  return "da an";
}

if (import.meta.main) {
  console.log(anMucMenu(process.argv[2]));
}
