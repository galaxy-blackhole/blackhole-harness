/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Danh tinh lenh va cach viet nhap da ban dia hoa tren danh muc Host dang hieu luc
 */

import { en, zh, type CommandKey } from "./locales.ts";
import type { CommandDescriptorLike, Translate } from "./types.ts";

/**
 * Sau lenh built-in cua Host ma row nay so huu mat chu — nguyen van tu bundle goc.
 * Nhan: khong co.
 * Tra: doi tuong ten -> id dinh nghia.
 */
export const BUILTINS = {
  goal: "@deepseek-ai/dsh-command-goal",
  plan: "@deepseek-ai/dsh-plan-mode",
  feedback: "@deepseek-ai/dsh-command-feedback",
  compact: "@deepseek-ai/dsh-command-compact",
  permission: "@deepseek-ai/dsh-permission-presets",
  export: "@deepseek-ai/dsh-session-log-export",
} as const;

/** Ten cac lenh built-in co mat chu da ban dia hoa. */
export type BuiltinCommandName = keyof typeof BUILTINS;

/** Sau ten built-in, theo thu tu khai o BUILTINS. */
const BUILTIN_NAMES = Object.keys(BUILTINS) as BuiltinCommandName[];

/**
 * Khoa chuan THU HAI cua cung mot dinh nghia, khai theo KHOÁ (khong theo id day du).
 * Nhan: khong co.
 * Tra: anh xa ten built-in -> cac khoa chuan khac cung tro ve dinh nghia do.
 *
 * ⚠️ 10/11/2026 — SỰ CỐ THẬT (menu "/" hiện "permission" + mô tả tiếng Anh trong khi 5 lệnh kia đã
 *   tiếng Việt): bảng đổi id ở bản cài (tests/helpers/brand-ids-map.json:36) đổi id stock
 *   `dsh-permission-presets` thành id GBH `gbh-permission` — TÊN GÓI của ta — nên KHOÁ đổi từ
 *   `permission-presets` thành `permission`, trong khi tệp của CHÍNH gói được miễn đổi (chống
 *   self-import) nên Host vẫn đăng ký id stock ⇒ hai khoá lệch nhau ⇒ trượt nhãn + mô tả + icon.
 *   Năm lệnh còn lại không dính vì `dsh-X` -> `gbh-X` giữ nguyên đuôi.
 *   Khai bằng KHOÁ TRẦN (không phải id đầy đủ) là CÓ CHỦ ĐÍCH: phép đổi id chỉ thay chuỗi id có scope,
 *   nên khoá trần sống sót qua mọi lượt đổi id ở profile — khai id ở đây sẽ bị đổi thành cùng một khoá
 *   và bảng mất tác dụng (đã đo: khai id ⇒ bản cài vẫn MISS).
 */
export const DEFINITION_KEY_ALIASES: Readonly<Partial<Record<BuiltinCommandName, readonly string[]>>> = {
  permission: ["permission-presets", "permission"],
};

/**
 * Khoa tu dien cua cach viet nhap cho mot lenh built-in.
 * Nhan: name — ten built-in.
 * Tra: khoa 'token.<ten>' cua namespace 'command'.
 */
function tokenKey(name: BuiltinCommandName): CommandKey {
  return ("token." + name) as CommandKey;
}

/**
 * Bang cach viet khac (tieng Trung + tieng Anh) tro ve ten built-in — nguyen van tu ban goc.
 * Nhan: khong co.
 * Tra: anh xa cach viet -> ten built-in.
 */
export const TOKEN_ALIASES: ReadonlyMap<string, BuiltinCommandName> = new Map(
  BUILTIN_NAMES.flatMap((name) =>
    [zh[tokenKey(name)], en[tokenKey(name)]].map((token) => [token, name] as const),
  ),
);

/**
 * Rut KHOA CHUAN cua mot id dinh nghia lenh: bo tien to scope + tien to nha cung cap.
 * Nhan: id — chuoi id dinh nghia (`@deepseek-ai/dsh-command-goal` hoac `@galaxy-blackhole/gbh-command-goal`),
 *   co the undefined khi descriptor Host khong khai.
 * Tra: khoa chuan (`command-goal`); chuoi rong khi id khong co (khong khop built-in nao).
 *
 * ⚠️ 07/11/2026 — SỰ CỐ THẬT: bản cài đổi id gói stock -> id GBH trong artefact, nhưng phép đổi đó
 *   BỎ QUA tệp của CHÍNH gói (chống self-import). Kết quả: Host gửi `definitionId` là id STOCK còn bảng
 *   BUILTINS ở client (tệp khác gói nên BỊ đổi) lại là id GBH ⇒ so sánh trượt ⇒ mất NHÃN + MÔ TẢ tiếng
 *   Việt và MẤT ICON của 4 lệnh dựng sẵn (goal · plan · compact · export) — menu "/" hiện chữ tiếng Anh.
 *   So theo khoá chuẩn nên KHỚP cả hai kiểu id, không phụ thuộc bản cài đã đổi id hay chưa.
 */
function definitionKey(id: string | undefined): string {
  return (id ?? "").replace(/^@(?:deepseek-ai|galaxy-blackhole)\/(?:dsh|gbh)-(?=.)/u, "");
}

/**
 * Bang khoa chuan -> ten built-in: khoa cua id stock (nguyen van ban goc) cong moi khoa khai o
 * DEFINITION_KEY_ALIASES.
 * Nhan: khong co.
 * Tra: anh xa khoa chuan -> ten built-in; khoa trung giu ten khai truoc.
 */
const KEY_TO_BUILTIN: ReadonlyMap<string, BuiltinCommandName> = new Map(
  BUILTIN_NAMES.flatMap((name) =>
    [definitionKey(BUILTINS[name]), ...(DEFINITION_KEY_ALIASES[name] ?? [])].map((key) => [key, name] as const),
  ),
);

/**
 * Nhan dien mot dinh nghia first-party ma khong dien giai chu hien thi cua no.
 * Nhan: descriptor — descriptor Host dang hieu luc sau khi bi che theo pham vi.
 * Tra: ten first-party, hoac undefined voi dinh nghia khac.
 */
export function builtinCommandName(descriptor: CommandDescriptorLike): BuiltinCommandName | undefined {
  return KEY_TO_BUILTIN.get(definitionKey(descriptor.definitionId));
}

/**
 * Chon cach viet nhap cho mot lenh duoc chon tu menu.
 * Nhan: descriptor — descriptor Host dang hieu luc; t — ham dich namespace 'command'.
 * Tra: cach viet da ban dia hoa cho dinh nghia da biet, nguoc lai la ten da dang ky.
 */
export function claimToken(descriptor: CommandDescriptorLike, t: Translate): string {
  const name = builtinCommandName(descriptor);
  return name === undefined ? descriptor.name : t("token." + name);
}

/**
 * Doi chieu cach viet da go voi cac dinh nghia dang hieu luc cua phien.
 * Nhan: token — ten da go, khong co dau '/'; descriptors — descriptor dang hieu luc trong danh muc da san sang.
 * Tra: descriptor khop; alias khong bao gio chon mot ban ghi de pham vi khong lien quan.
 *
 * 10/11/2026 — nhánh alias so bằng KHOÁ CHUẨN (builtinCommandName) chứ không so chuỗi id thô: ở bản cài,
 *   bảng BUILTINS bị đổi sang id GBH còn definitionId của Host giữ id stock ⇒ so chuỗi thô trượt CẢ SÁU
 *   lệnh, gõ alias '/权限' hay '/permission' không mở được lệnh dựng sẵn. Cùng một phép so với bảng mặt chữ.
 */
export function resolveCommand(token: string, descriptors: readonly CommandDescriptorLike[]): CommandDescriptorLike | undefined {
  const exact = descriptors.find((descriptor) => descriptor.name === token);
  if (exact !== undefined) return exact;
  const name = TOKEN_ALIASES.get(token);
  if (name === undefined) return undefined;
  return descriptors.find((descriptor) => builtinCommandName(descriptor) === name);
}
