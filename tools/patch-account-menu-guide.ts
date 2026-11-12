/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Thêm mục "Hướng dẫn" vào menu tài khoản (nút "Thêm" ở chân sidebar) và ẩn hai mục
 *      "Liên hệ/Phản hồi" + "Đăng nhập/Đăng xuất" — để menu còn ĐÚNG HAI mục: Cài đặt · Hướng dẫn
 *      (yêu cầu chủ dự án 07/11/2026). "Hướng dẫn" mở https://galaxy-blackhole.vercel.app/ ở tab mới.
 *
 *      VÌ SAO PHẢI LÀ CÔNG CỤ: artefact lib/client.js của ui-settings-account là bản sao NGUYÊN VĂN của
 *      bundle gốc (canon de-bundle, có cổng byte) nên KHÔNG được sửa tay (luật #61). Mọi thay đổi hành vi
 *      phải đi qua tệp có ghi chép như tệp này, chạy lại nhiều lần vẫn an toàn (dấu nhận biết).
 *
 *      CÁCH DÙNG: ~/.bun/bin/bun run tools/patch-account-menu-guide.ts [<đường dẫn artefact>]
 *      An toàn: ghi ra tệp tạm, KIỂM (parse + đúng 1 lần đăng ký module) rồi mới thay tệp thật.
 */

import { readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { anMucMenu } from "./patch-account-menu.ts";

/** Gốc repo (tools ⇒ ..). */
const REPO = join(import.meta.dir, "..");

/** Đường dẫn artefact mặc định của gói ui-settings-account. */
const MAC_DINH = join(REPO, "packages", "client", "ui-settings-account", "lib", "client.js");

/** Địa chỉ trang hướng dẫn của sản phẩm. */
const URL_HUONG_DAN = "https://galaxy-blackhole.vercel.app/";

/** Dấu nhận biết bản vá đã áp (idempotent). */
const DAU = "// 07/11/2026: them muc Huong dan vao menu tai khoan.";

/** Khối mục "settings" của artefact gốc — neo để chèn mục mới NGAY SAU nó. */
const NEO_SETTINGS = `						items: [
							{
								id: "settings",
								label: t("settings"),
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineMedium, { size: 16 }),
								...settingsShortcut === void 0 ? {} : { shortcut: settingsShortcut }
							},`;

/** Khối chèn thêm: một mục menu "Hướng dẫn" — CÓ biểu tượng (07/11/2026: mục không icon trông lệch
 * hẳn so với mục "Cài đặt" bên trên nên phải thêm icon, dùng chính bộ icon DSH của ui-primitives). */
const MUC_HUONG_DAN = `
							{
								id: "guide",
								label: "Hướng dẫn",
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInfoOutlineMedium, { size: 16 })
							},`;

/** Khối của bản vá CŨ (chưa có icon) — để nâng cấp tại chỗ khi chạy lại. */
const MUC_HUONG_DAN_CU = `
							{
								id: "guide",
								label: "Hướng dẫn"
							},`;

/** Neo của hàm xử lý chọn mục trong artefact gốc. */
const NEO_ONSELECT = `						onSelect: (id) => {
							if (id === "settings") {`;

/** Nhánh xử lý mới đặt TRƯỚC nhánh settings. */
const NHANH_HUONG_DAN = `						onSelect: (id) => {
							if (id === "guide") {
								setOpen(false);
								window.open(${JSON.stringify(URL_HUONG_DAN)}, "_blank", "noopener,noreferrer");
								return;
							}
							if (id === "settings") {`;

/**
 * Kiểm một artefact client có hợp lệ sau khi vá: chạy được và đăng ký ĐÚNG MỘT id module.
 * Nhận: text — toàn văn artefact.
 * Trả: mảng id đã đăng ký (ném lỗi khi parse hỏng).
 */
function idsDangKy(text: string): string[] {
  const ids: string[] = [];
  const scope = globalThis as unknown as { window?: unknown; __ModuleLoader__?: unknown };
  scope.window = globalThis;
  scope.__ModuleLoader__ = { load: (registration: { id: string }): void => void ids.push(registration.id) };
  try {
    new Function(text)();
  } finally {
    delete scope.__ModuleLoader__;
    delete scope.window;
  }
  return ids;
}

/**
 * Vá artefact: ẩn Liên hệ/Đăng nhập, thêm mục Hướng dẫn và nhánh mở trang hướng dẫn.
 * Nhận: duongDan — đường dẫn artefact client (mặc định theo repo).
 * Trả: "da va" khi có thay đổi · "da va truoc do" khi đã vá · "khong thay" khi artefact khác hình dạng.
 */
export function vaMenuHuongDan(duongDan: string = MAC_DINH): string {
  // (1) Ẩn hai mục cũ bằng công cụ đã có (cùng dấu nhận biết, chạy lại an toàn).
  anMucMenu(duongDan);
  const goc = readFileSync(duongDan, "utf8");
  if (goc.includes(DAU)) {
    // Đã vá trước đó: nếu mục Hướng dẫn còn THIẾU icon thì nâng cấp tại chỗ (thêm dòng icon ngay sau label).
    const iGuide = goc.indexOf('id: "guide"');
    const iLabel = iGuide < 0 ? -1 : goc.indexOf('label: "Hướng dẫn"', iGuide);
    if (iLabel < 0) return "da va truoc do";
    const sauLabel = iLabel + 'label: "Hướng dẫn"'.length;
    if (goc.slice(sauLabel, sauLabel + 2) === ",\n") return "da va truoc do";
    const dongIcon =
      ',\n' +
      "								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInfoOutlineMedium, { size: 16 })";
    const nang = goc.slice(0, sauLabel) + dongIcon + goc.slice(sauLabel);
    const tamNang = duongDan + ".tmp";
    writeFileSync(tamNang, nang);
    if (idsDangKy(readFileSync(tamNang, "utf8")).length !== 1) {
      rmSync(tamNang, { force: true });
      throw new Error("patch-account-menu-guide: nang cap icon lam hong artefact");
    }
    renameSync(tamNang, duongDan);
    return "da va";
  }
  if (!goc.includes(NEO_SETTINGS) || !goc.includes(NEO_ONSELECT)) return "khong thay";

  const sau = goc
    .replace(NEO_SETTINGS, NEO_SETTINGS + MUC_HUONG_DAN)
    .replace(NEO_ONSELECT, NHANH_HUONG_DAN)
    .replace(MUC_HUONG_DAN, MUC_HUONG_DAN.replace("{", "{" + String.fromCharCode(10) + "								" + DAU + String.fromCharCode(10) + "								"));
  // (2) KIỂM trước khi thay tệp thật: parse được, đúng MỘT id, mục guide có mặt.
  const ids = idsDangKy(sau);
  if (ids.length !== 1) throw new Error("patch-account-menu-guide: so lan dang ky module = " + String(ids.length) + " (phai la 1)");
  if (!sau.includes('"guide"')) throw new Error("patch-account-menu-guide: khong thay muc guide sau khi va");
  // (3) Ghi ra tệp tạm rồi đổi tên — không để artefact nửa vời trên đĩa.
  const tam = duongDan + ".tmp";
  writeFileSync(tam, sau);
  try {
    idsDangKy(readFileSync(tam, "utf8"));
    renameSync(tam, duongDan);
  } catch (error) {
    unlinkSync(tam);
    throw error;
  }
  return "da va";
}

if (import.meta.main) {
  console.log(vaMenuHuongDan(process.argv[2]));
}