/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Chèn TỪ ĐIỂN TIẾNG VIỆT vào artefact client đã de-bundle (bundle gốc chỉ có en + zh nên UI tiếng
 *      Việt rơi về tiếng Anh). Từ điển là DỮ LIỆU nên vá được mà vẫn giữ canon 1:1.
 *
 *      AN TOÀN (bài học 22/10/2026 — suýt phá artefact ui-schedule):
 *      - CHỈ xử lý gói có khuôn `const en = { … }` + `register(ns, { zh, en })`;
 *      - gói đã có cơ chế `const X_VI = JSON.parse(...)` thì NO-OP + cảnh báo (do tools/locale sinh);
 *      - chỉ thêm `vi` vào `register(...)` SAU KHI đã chèn `const vi` thành công.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";


/**
 * Nối `vi` vào các lời gọi đăng ký từ điển còn thiếu (dùng khi artefact ĐÃ có khối `const vi`).
 * Nhận: text — toàn văn artefact; artifactPath — đường dẫn để ghi khi có thay đổi.
 * Trả: true khi tệp có thay đổi.
 */
function noiDangKy(text: string, artifactPath: string): boolean {
  const sau = text
    .replace(/\{\s*zh,\s*en\s*\}/gu, "{ zh, en, vi }")
    .replace(/\{\s*en,\s*zh\s*\}/gu, "{ en, zh, vi }")
    .replace(/(zh:\s*[A-Za-z0-9_$]+,\s*en:\s*[A-Za-z0-9_$]+)(?!\s*,\s*vi)/gu, "$1, vi")
    .replace(/(en:\s*[A-Za-z0-9_$]+,\s*zh:\s*[A-Za-z0-9_$]+)(?!\s*,\s*vi)/gu, "$1, vi");
  if (sau === text) return false;
  writeFileSync(artifactPath, sau);
  return true;
}

/** Dấu mở đầu khối từ điển tiếng Việt do công cụ này chèn. */
const MARK = "const vi = { ...en,";

/**
 * Gộp các khoá CÒN THIẾU vào khối `const vi = { ...en,` đã có sẵn trong artefact.
 * Nhận: text — toàn văn artefact; dich — bản dịch cần có.
 * Trả: text mới (hoặc nguyên bản khi không thiếu khoá nào).
 *
 * Vì sao cần: lần chèn đầu chỉ biết các khoá có lúc đó; về sau bổ sung bản dịch thì phải chèn thêm dòng
 * vào ĐÚNG khối cũ (không tạo khối thứ hai, không ghi đè bản dịch đã có).
 */
/** Ghép một dòng khoá/bản dịch theo đúng thụt lề của khối từ điển. */
function kq(khoa: string, chu: string): string {
  return String.fromCharCode(9, 9, 9) + String.fromCharCode(91) + JSON.stringify(khoa) + String.fromCharCode(93) + ": " + JSON.stringify(chu);
}

function gopKhoaConThieu(text: string, dich: Record<string, string>): string {
  const mo = text.indexOf(MARK);
  if (mo < 0) return text;
  const dong = text.indexOf(String.fromCharCode(10), mo);
  const dongDong = text.indexOf(String.fromCharCode(10, 9, 9) + "};", dong);
  if (dong < 0 || dongDong < 0) return text;
  const than = text.slice(dong, dongDong);
  const daCo = new Set([...than.matchAll(/\["([^"]+)"\]:/gu)].map((khop) => khop[1] as string));
  const them = Object.entries(dich).filter(([khoa]) => !daCo.has(khoa));
  if (them.length === 0) return text;
  // Object.entries trả [khoá, bản dịch] nên hai giá trị luôn là chuỗi; khai kiểu rõ để typecheck yên tâm.
  const dongMoi = them
    .map(([khoa, chu]: [string, string]) => kq(khoa, chu))
    .join(String.fromCharCode(10));
  return text.slice(0, dongDong) + String.fromCharCode(10) + dongMoi + text.slice(dongDong);
}

/**
 * Chèn khối từ điển tiếng Việt vào artefact và nối `vi` vào đăng ký locale.
 * Nhận: artifactPath — tệp lib/client.js; overridesPath — JSON { khoá: bản dịch }.
 * Trả: "da chen" khi có thay đổi · "khong doi" khi đã có khối · "bo qua" khi gói dùng cơ chế khác.
 */
export function injectViDictionary(artifactPath: string, overridesPath: string): string {
  const truoc = readFileSync(artifactPath, "utf8");
  // Đã có khối từ điển rồi thì KHÔNG chèn lại, nhưng VẪN phải kiểm đăng ký: gói có thể đăng ký theo thứ tự
  // khác (`{ en, zh }`) hoặc dạng object literal nên lần chèn trước chưa nối được `vi` (bài học ui-settings-account).
  if (truoc.includes(MARK)) {
    // 22/10/2026: ĐƯỜNG GỘP KHOÁ ĐÃ BỎ. Bài học ui-settings-account: chèn thêm dòng vào khối cũ dễ
    // rơi vào object khác (10 ca test đỏ vì cú pháp hỏng). Nay TẠO LẠI khối từ đầu: gỡ khối cũ (kèm
    // chú thích), trả lời gọi đăng ký về dạng gốc, rồi đi tiếp xuống nhánh chèn mới bên dưới.
    const TAO_LAI = truoc
      // Gỡ đúng khối do công cụ này chèn: dòng chú thích + khối `const vi = { ...en,` tới `};`.
      .replace(/\n\t\t\/\*\* Từ điển tiếng Việt[^\n]*\n\t\tconst vi = \{ \.\.\.[\s\S]*?\n\t\t\};/u, "")
      .replace(/\{\s*zh,\s*en,\s*vi\s*\}/gu, "{ zh, en }")
      .replace(/\{\s*en,\s*zh,\s*vi\s*\}/gu, "{ en, zh }");
    if (TAO_LAI !== truoc) writeFileSync(artifactPath, TAO_LAI);
    return injectViDictionary(artifactPath, overridesPath);
  }
  // Gói dùng cơ chế `X_VI = JSON.parse(...)` (do tools/locale/embed-vi-parts.ts sinh):
  //   - đúng MỘT hằng ⇒ GỘP khoá còn THIẾU vào JSON đó (không ghi đè bản dịch đã có, không thêm khối thứ hai);
  //   - từ HAI hằng trở lên ⇒ bỏ qua (không đoán hằng nào phục vụ namespace nào) — bài học ui-schedule 22/10/2026.
  const cacHang = [...truoc.matchAll(/const ([A-Za-z0-9_]+_VI) = JSON\.parse\(/gu)];
  if (cacHang.length > 1) return "bo qua";
  const dich: Record<string, string> = JSON.parse(readFileSync(overridesPath, "utf8")) as Record<string, string>;
  const than = Object.entries(dich)
    .map(([k, v]) => "\t\t\t[" + JSON.stringify(k) + "]: " + JSON.stringify(v))
    .join(",\n");
  if (cacHang.length === 1) {
    const ten = cacHang[0]?.[1];
    const khop = new RegExp("const " + String(ten) + ' = JSON\\\\.parse\\\\(\"((?:[^\"\\\\\\\\]|\\\\\\\\.)*)\"\\\\);', "u").exec(truoc);
    if (khop === null) return "bo qua";
    const hienTai = JSON.parse(JSON.parse('"' + String(khop[1]) + '"')) as Record<string, string>;
    const thieu: Record<string, string> = {};
    for (const [k, v] of Object.entries(dich)) if (!(k in hienTai)) thieu[k] = v;
    if (Object.keys(thieu).length === 0) return "khong doi";
    const gop = { ...hienTai, ...thieu };
    const chuoi = JSON.stringify(JSON.stringify(gop));
    writeFileSync(artifactPath, truoc.slice(0, khop.index) + "const " + String(ten) + " = JSON.parse(" + chuoi + ");" + truoc.slice(khop.index + khop[0].length));
    return "da gop";
  }
  // 22/10/2026: gói ghép văn bản đặt tên hằng có hậu tố (`const en$1 = {...}`) ⇒ anchor chấp nhận cả hai kiểu.
  const neoEn = /const (en\$?\d*) = \{/u.exec(truoc);
  const i = neoEn === null ? -1 : neoEn.index;
  if (i < 0) return "bo qua";
  const j = /\n\t*\};/.exec(truoc.slice(i));
  if (j === null) return "bo qua";
  const cuoi = i + j.index + j[0].length;
  const khoi = "\n\t\t/** Từ điển tiếng Việt (chèn bởi tools/inject-vi-dictionary.ts). */\n\t\tconst vi = { ..." + String(neoEn?.[1] ?? "en") + ",\n" + than + "\n\t\t};";
  // Bước 1: chèn khối `const vi` — BẮT BUỘC thành công thì mới được thêm `vi` vào register bên dưới.
  let sau = truoc.slice(0, cuoi) + khoi + truoc.slice(cuoi);
  // Bước 2: nối `vi` vào mọi cặp shorthand `{ zh, en }` (namespace hằng hoặc chuỗi).
  sau = sau.replace(/\{\s*zh,\s*en\s*\}/gu, "{ zh, en, vi }");
  // 22/10/2026: dạng object literal (`{ zh: zh$1, en: en$1 }`) cũng phải có `vi` — NHƯNG chỉ trong lời gọi
  //   `register(...)`. Bài học 22/10/2026: regex trần đã chèn `vi` vào BUNDLE_PREVIEWS (object `{ zh: ảnh })`
  //   ⇒ `src` của ảnh xem trước thành object ⇒ trang chi tiết báo "không hiển thị được ảnh xem trước".
  sau = sau.replace(/(register\([^)]*\)\s*\{)([^{}]*zh:\s*[A-Za-z0-9_$]+,\s*en:\s*[A-Za-z0-9_$]+)\}/gu, "$1$2, vi }");
  // 22/10/2026: nhiều gói đăng ký theo thứ tự NGƯỢC (`{ en, zh }`) ⇒ phải phủ cả hai chiều.
  sau = sau.replace(/\{\s*en,\s*zh\s*\}/gu, "{ en, zh, vi }");
  sau = sau.replace(/\{\s*en:\s*([A-Za-z0-9_$]+),\s*zh:\s*([A-Za-z0-9_$]+)\s*\}/gu, "{ en: $1, zh: $2, vi }");
  writeFileSync(artifactPath, sau);
  return "da chen";
}

if (import.meta.main) {
  const [pkgDir] = process.argv.slice(2);
  if (pkgDir === undefined) {
    console.log("dung: bun run tools/inject-vi-dictionary.ts <thu-muc-goi>");
    process.exit(1);
  }
  const artifact = join(pkgDir, "lib", "client.js");
  const overrides = join(pkgDir, "locale", "vi-chrome.json");
  if (!existsSync(artifact) || !existsSync(overrides)) {
    console.log("thieu tep: " + artifact + " hoac " + overrides);
    process.exit(1);
  }
  const ketQua = injectViDictionary(artifact, overrides);
  console.log(ketQua === "bo qua" ? "bo qua (goi dung co che tools/locale — khong chen)" : ketQua);
}
