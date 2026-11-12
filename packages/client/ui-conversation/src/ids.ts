/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-conversation: mot id module, muoi mot lan dang ky slot, nam lan inject, chin ten slot, muoi the CSS
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-conversation";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio load() trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-conversation";

/**
 * Danh sach id module ma bundle TU KHAI — dung mot phan tu, chinh la ten package cua ta.
 * Nhan: khong co.
 * Tra: mang mot phan tu.
 */
export const MODULE_IDS: readonly string[] = [PACKAGE_NAME];

/**
 * Danh sach id cua goi goc duoc khai la alias trong gbh.row.aliases (tang nap sinh entry tro ve ta).
 * Nhan: khong co.
 * Tra: mang mot phan tu.
 */
export const PACKAGE_ALIASES: readonly string[] = [STOCK_PACKAGE_NAME];

/** Mot lan dang ky slot cua ban goc, ghi lai nguyen van de doi chieu. */
export interface SlotRegistration {
  /** Ten slot — chuoi LITERAL trong register({ name: "…" }). */
  readonly name: string;
  /** Ham dang ky: register thuong hay registerFactory (khai ca children/slots). */
  readonly call: "register" | "registerFactory";
  /** Khoa cua slot keyed, khi ban goc co khai. */
  readonly key?: string;
  /** Id cua slot list, khi ban goc co khai. */
  readonly id?: string;
}

/**
 * MUOI BA lan dang ky slot cua ban goc, NGUYEN VAN thu tu xuat hien trong bundle.
 * Muoi mot lan la slots.register (dung con so ma hai regex cua tools/check/rows.ts dem duoc), hai lan
 * la slots.registerFactory — regex cua cong KHONG thay registerFactory vi doi "register" phai theo ngay
 * dau "(", nen tap TEN slot ma cong so sanh chi co chin phan tu.
 * Hai lan dau thuoc hai entry cua hang doi/viec can lam, muoi mot lan con lai nam trong apply().
 * Nhan: khong co.
 * Tra: mang cac lan dang ky (ten + loai + key/id neu co).
 */
export const SLOT_REGISTRATIONS: readonly SlotRegistration[] = [
  { name: "conversation.input.dock", call: "register", id: "queue" },
  { name: "conversation.input.dock", call: "register", id: "todo" },
  { name: "conversation.user.text", call: "registerFactory" },
  { name: "conversation.user.text.node", call: "register", key: "text" },
  { name: "conversation.user.text.node", call: "register", key: "session" },
  { name: "settings.general.item", call: "register", id: "composer-enter" },
  { name: "main.conversation", call: "register" },
  { name: "conversation.content", call: "registerFactory" },
  { name: "conversation.session", call: "register" },
  { name: "conversation.header", call: "register" },
  { name: "conversation.session.header", call: "register" },
  { name: "conversation.composer.bar", call: "register" },
  { name: "main", call: "register", key: "conversation" },
];

/**
 * NAM lan goi slots.inject cua ban goc, NGUYEN VAN thu tu xuat hien (co lan lap: conversation.input.dock
 * duoc hai entry khac nhau — QueueDock cua hang doi va TodoDock cua viec can lam — cung inject vao).
 * Nhan: khong co.
 * Tra: mang ten slot duoc inject.
 */
export const SLOT_INJECTIONS: readonly string[] = [
  "conversation.input.dock",
  "conversation.input.dock",
  "conversation.user.text.node",
  "settings.general.item",
  "main",
];

/**
 * CHIN ten slot ma hai regex cua tools/check/rows.ts rut duoc tu ban goc — NGUYEN VAN.
 * It hon muoi mot lan dang ky vi registerFactory khong khop mau cua cong, va ten lap duoc gop lam mot.
 * Nhan: khong co.
 * Tra: mang ten slot, da sap xep.
 */
export const SLOT_NAMES: readonly string[] = [
  "conversation.composer.bar",
  "conversation.header",
  "conversation.input.dock",
  "conversation.session",
  "conversation.session.header",
  "conversation.user.text.node",
  "main",
  "main.conversation",
  "settings.general.item",
];

/**
 * Khoa cua HAI muc keyed trong slot "conversation.user.text.node" — NGUYEN VAN ban goc, va BANG dung
 * id cua nut ma bo danh gia van ban sinh ra (xem textNode() va sessionReferenceRule trong bundle goc).
 * Lech mot trong hai ⇒ renderer roi vao fallback "khong kha dung" ma KHONG co loi console.
 * Nhan: khong co.
 * Tra: mang hai khoa, theo thu tu dang ky.
 */
export const USER_TEXT_NODE_KEYS: readonly string[] = ["text", "session"];

/**
 * Khoa cua slot keyed "main" — NGUYEN VAN ban goc; ban goc dung cung mot gia tri cho key nay.
 * Nhan: khong co.
 * Tra: chuoi khoa.
 */
export const MAIN_SLOT_KEY = "conversation";

/**
 * Id cua muc cai dat trong slot list "settings.general.item" — nguyen van ban goc.
 * Nhan: khong co.
 * Tra: chuoi id.
 */
export const SETTINGS_ENTRY_ID = "composer-enter";

/**
 * Namespace tu dien ma ban goc dang ky qua ctx.locale.register(NS, { zh, en }).
 * Nhan: khong co.
 * Tra: chuoi namespace.
 */
export const LOCALE_NAMESPACE = "conversation";

/**
 * MUOI module CSS ma ban goc nhung nguyen van (tien to hash giu nguyen) — thu tu xuat hien trong bundle.
 * Nhan: khong co.
 * Tra: mang ten module CSS.
 */
export const STYLE_MODULES: readonly string[] = [
  "UserText",
  "ReferenceChip",
  "composer-editor",
  "QueueDock",
  "EnterBehaviorRow",
  "ConversationRoot",
  "HeroShell",
  "ContextMeter",
  "InputBar",
  "TodoPanel",
];
