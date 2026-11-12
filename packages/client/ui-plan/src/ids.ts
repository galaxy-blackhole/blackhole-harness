/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bang dinh danh cua row ui-plan: id MODULE cua ta, muoi seam, nam slot va hai the style
 */

/**
 * Ten package cua ta — cung la id MODULE DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay trong `window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory })` (do build.ts phat ra),
 * nen day la dong ma manifest cua Host tro toi va la `ownerId` de HMR tra `rev`.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-plan";

/**
 * Id occupant cho hai slot KIEU LIST — GIA TRI nguyen van cua ban goc, nhung GHEP tu PACKAGE_NAME luc chay
 * thay vi viet literal: luat MOT-ID (19/10/2026) doi chuoi id goi goc VANG hoan toan khoi lib/client.js,
 * nen hang tai lieu cua no da chuyen sang src/ids-stock.ts (chi test import).
 *
 * ⚠️ DAY KHONG PHAI id module: no la dinh danh occupant trong slot (xem docs/recipes/HOST-ROW-REWRITE.md muc 6,
 * bang "Loai id"). Slot kieu list BAT BUOC co `id`; tu dat ten khac ⇒ slot nem
 * `list slot … requires options.id` (hoac trung voi occupant cua goi khac) ⇒ apply nem ⇒ ca trang chet.
 * Vi vay gia tri VAN nguyen van: chi doi CACH VIET (ghep tien to scope DSH voi hau to cua PACKAGE_NAME).
 * Nhan: khong co.
 * Tra: chuoi id occupant nguyen van cua ban goc.
 *
 * ⚠️ 18/10/2026: CHI dung cho HAI slot KIEU LIST o tren (dang ky qua `id`). HAI slot KIEU KEYED
 * (`sidebar.right.pane.tab` · `sidebar.right.pane.tab.title`) KHONG duoc dung hang so nay: `key` cua chung
 * PHAI bang TAB_TYPE_ID — id kieu tab — neu khong sidebar tra truot cho ngoi va render fallback
 * `tab.unavailable` KHONG kem loi console (xem ghi chu tai cho dang ky trong plugin.ts).
 */
export const SLOT_ENTRY_ID = PACKAGE_NAME.replace("@galaxy-blackhole/gbh-client-", "@deepseek-ai/dsh-client-");

/**
 * Id cua KIEU TAB do row nay dang ky o `ctx.sidebarRightTabs`.
 *
 * Theo hop dong `tab-registry.d.ts`: `id` la "danh tinh cua ban cai dat, duy nhat tren moi dang ky
 * (ten package la gia tri tu nhien)" va la KHOA ma than + tieu de dang ky duoi no o hai cho ngoi
 * `sidebar.right.pane.tab` / `sidebar.right.pane.tab.title`. Vi vay ba cho nay dung CHUNG mot gia tri.
 * Nhan: khong co.
 * Tra: chuoi id kieu tab.
 */
export const TAB_TYPE_ID = PACKAGE_NAME;

/** Namespace tu dien do package nay so huu (`ctx.locale.register(NS, …)`). */
export const NS = "plan";

/** Giao thuc tai nguyen ma provider nay phuc vu (`protocol: "plan"`). */
export const RESOURCE_PROTOCOL = "plan";

// 18/10/2026 (task-29, Wave D): PHÁT scheme mới `gbh-resource://`; NHẬN cả scheme cũ `dsh-resource://`
//   (địa chỉ plan đã ghi trong lịch sử phiên + plugin ngoài). Không đổi protocol key ("plan").

/** Tiền tố địa chỉ tài nguyên của plan ĐÃ GHI — scheme MỚI (client phát). */
export const PLAN_ADDRESS_PREFIX = "gbh-resource://plan/";

/** Tiền tố địa chỉ của plan TẠM THỜI (mang văn bản trong tham số điều hướng) — scheme MỚI. */
export const REVIEW_ADDRESS_PREFIX = "gbh-resource://plan-review/";

/** Biểu thức nhận dạng địa chỉ plan tạm thời — nhận CẢ HAI scheme (mới + cũ). */
export const REVIEW_ADDRESS_PATTERN = /^(?:gbh-resource|dsh-resource):\/\/plan-review\/[^/?#]+\/[^/?#]+$/;

/** Biểu thức nhận dạng địa chỉ plan đã ghi — nhận CẢ HAI scheme (mới + cũ). */
export const PLAN_ADDRESS_PATTERN = /^(?:gbh-resource|dsh-resource):\/\/plan\/([^?#]+)$/;

/** Kieu tab do row nay so huu (`kind: "plan"`). */
export const TAB_KIND = "plan";

/**
 * Bốn khuôn địa chỉ mà kiểu tab này nhận: scheme MỚI (client phát) trước, rồi scheme CŨ (địa chỉ đã lưu /
 * plugin ngoài) — thứ tự không ảnh hưởng phép khớp pattern.
 */
export const TAB_PATTERNS = [
  "gbh-resource://plan/**",
  "gbh-resource://plan-review/**",
  "dsh-resource://plan/**",
  "dsh-resource://plan-review/**",
] as const;

/** Bang uu tien cua kieu tab — NGUYEN VAN ban goc (`priority: "builtin"`). */
export const TAB_PRIORITY = "builtin";

/** Ten tool ma plan duoc doc ra tu do (`exit_plan_mode`). */
export const PLAN_TOOL_NAME = "exit_plan_mode";

/** Kieu node cua Conversation ma row nay dang ky (`kind: "submitted-plan"`). */
export const PLAN_NODE_KIND = "submitted-plan";

/** Khoa du lieu cua Turn ma the plan duoc chieu ra (`turnDataSource(turn, "submitted-plan")`). */
export const TURN_DATA_KEY = "submitted-plan";

/** Dich cua nut thoat plan mode — NGUYEN VAN ban goc. */
export const EXIT_PLAN_COMMAND = "/plan off";

/**
 * Muoi seam ma fiber cua row nay can — NGUYEN VAN ten va THU TU trong ban goc.
 * Thieu mot ten ⇒ fiber khong ACTIVE ⇒ `did not activate` trong log boot.
 */
export const INJECT = [
  "slots",
  "remote",
  "remote.commands",
  "remote.session",
  "sessions",
  "locale",
  "uiConversation",
  "resources",
  "sidebarRight",
  "sidebarRightTabs",
] as const;

/** Nhan hieu ung vong doi — giu NGUYEN VAN chuoi cua ban goc (log boot doi chieu duoc). */
export const EFFECT = {
  /** Dang ky hai bang tu dien cua namespace `plan`. */
  dictionaries: "ui-plan: dictionaries",
  /** Dang ky dinh nghia chieu node `submitted-plan` cho Conversation. */
  conversationDefinition: "ui-plan: conversation definition",
  /** Dang ky provider tai nguyen `plan`. */
  resources: "ui-plan: resources",
  /** Dang ky kieu tab `plan` cho sidebar phai. */
  sidebarType: "ui-plan: sidebar type",
} as const;

/** Id gan vao `data-plugin-css` cua hai the style. */
export const STYLE_TAGS = {
  /** CSS cua the plan trong transcript (ban goc: `PlanPreview.module.css`). */
  preview: PACKAGE_NAME + "/PlanPreview.module.css",
  /** CSS cua chip plan mode (ban goc: `PlanModeControl.module.css`). */
  control: PACKAGE_NAME + "/PlanModeControl.module.css",
} as const;

/** Do dai chuoi ngau nhien dan ten cua so review trong mot trinh duyet. */
export const REVIEW_WINDOW_BYTES = 16;
