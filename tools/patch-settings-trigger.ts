/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Đổi nút ở chân thanh bên từ "Thêm" (icon ba chấm) thành "Cài đặt" (icon bánh răng), vì menu
 *      tài khoản nay chỉ còn một mục là Cài đặt (Đăng nhập/Liên hệ/Đăng xuất đã ẩn). Artefact là bản
 *      sao nguyên văn của bundle gốc ⇒ thay đổi đi qua công cụ này, KHÔNG sửa tay.
 *      Chạy: bun run tools/patch-settings-trigger.ts [<đường dẫn artefact>]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tools ⇒ ..). */
const REPO = join(import.meta.dir, "..");

/** Artefact mặc định của gói ui-settings-account. */
const MAC_DINH = join(REPO, "packages", "client", "ui-settings-account", "lib", "client.js");

/** Dấu nhận biết bản vá đã áp. */
const DAU = '/* 22/10/2026: nut chan thanh ben hien "Cai dat" + icon banh rang. */';

/** Icon ba chấm gốc (dùng khi chưa đăng nhập). */
const GOC_ICON = '(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineMedium, { size: 14 })';

/** Nhãn gốc của nút. */
const GOC_NHAN = 'children: signedIn ? label : t("more")';

/**
 * Áp bản vá: nút chân thanh bên hiện "Cài đặt" kèm icon bánh răng.
 * Nhận: duongDan — artefact client (mặc định theo repo).
 * Trả: "da doi" khi có thay đổi · "da doi truoc do" khi đã vá · "khong thay" khi hình dạng khác.
 */

/** Dấu nhận biết bản vá "bấm là mở thẳng Cài đặt". */
const DAU_MO_THANG = "// 22/10/2026: menu chi con mot muc Cai dat";

/** onClick gốc của nút chân thanh bên (bật/tắt popup). */
const GOC_CLICK = [
  "\t\t\t\t\t\t\tonClick: () => {",
  "\t\t\t\t\t\t\t\tsetOpen((value) => !value);",
  "\t\t\t\t\t\t\t}"
].join("\n");

/** onClick mới: mở thẳng hộp thoại Cài đặt (vì menu chỉ còn một mục). */
const MOI_CLICK = [
  "\t\t\t\t\t\t\tonClick: () => {",
  "\t\t\t\t\t\t\t\t" + DAU_MO_THANG + " ⇒ bấm là mở thẳng hộp thoại Cài đặt (bỏ lớp popup thừa).",
  "\t\t\t\t\t\t\t\topenSettings();",
  "\t\t\t\t\t\t\t}"
].join("\n");
/**
 * Áp bản vá nút chân thanh bên: icon bánh răng + nhãn "Cài đặt", và bấm là mở THẲNG hộp thoại Cài đặt
 * (menu tài khoản nay chỉ còn một mục nên lớp popup thừa bị bỏ).
 * Nhận: duongDan — artefact client (mặc định theo repo).
 * Trả: "da doi" khi đổi cả hai phần · "da mo thang" khi chỉ còn phần mở thẳng · "da doi truoc do" khi đã vá ·
 *      "khong thay" khi artefact khác hình dạng.
 */
export function doiNutCaiDat(duongDan: string = MAC_DINH): string {
  const truoc = readFileSync(duongDan, "utf8");
  if (truoc.includes(DAU) && truoc.includes(DAU_MO_THANG)) return "da doi truoc do";
  if (truoc.includes(DAU)) {
    // Đã đổi icon+nhãn từ lần trước, nay chỉ cần mở thẳng Cài đặt.
    const chiClick = truoc.replace(GOC_CLICK, MOI_CLICK);
    if (chiClick === truoc) return "khong thay";
    writeFileSync(duongDan, chiClick);
    return "da mo thang";
  }
  if (!truoc.includes(GOC_ICON) || !truoc.includes(GOC_NHAN)) return "khong thay";
  const sau = truoc
    .replace(GOC_CLICK, MOI_CLICK)
    .replace(GOC_ICON, '(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineMedium, { size: 14 })')
    .replace(GOC_NHAN, 'children: signedIn ? label : t("settings")');
  writeFileSync(duongDan, DAU + String.fromCharCode(10) + sau);
  return "da doi";
}

if (import.meta.main) {
  console.log(doiNutCaiDat(process.argv[2]));
}
