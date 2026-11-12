/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-trajectory: mot id module, mot slot nguyen van, mot nguoi ngoi trajectory
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra qua src/assemble.ts) — KHONG khai id cua goi goc: no thuoc
 * gbh.row.aliases va tang nap TU sinh entry alias tro ve cung URL bundle. MOT BUNDLE MOT ID.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-trajectory";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio load() trong bundle.
 * Gia tri nay VAN xuat hien trong than bundle o cho khac (tagId cua the CSS, nhan hieu hieu ung) —
 * do la NGUYEN VAN ban goc, khong phai loi goi dang ky module.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-trajectory";

/**
 * Ten slot ma row nay chiem mot cho — NGUYEN VAN tu bundle goc.
 * Day la ViewMap cua khung hoi thoai: moi nguoi ngoi la mot loai tab o thanh tren cua phien.
 * Nhan: khong co.
 * Tra: chuoi ten slot.
 */
export const SLOT_CONVERSATION_VIEW = "conversation.view";

/**
 * Id cua NGUOI NGOI trong slot conversation.view — NGUYEN VAN tu bundle goc.
 * Day la cho NGUOI DUNG thay: id di vao tham so cua slot nen doi chuoi nay la doi dinh danh tab.
 * Nhan: khong co.
 * Tra: chuoi id nguoi ngoi.
 */
export const VIEW_ID = "trajectory";

/** Thu tu cua tab trajectory trong ViewMap — ban goc xep 10. */
export const VIEW_ORDER = 10;

/**
 * Ten slot CON ma tab trajectory khai la con cua no — NGUYEN VAN tu bundle goc.
 * Ban goc khai children: { 'conversation.trajectory.images': { kind: 'single', scope: 'session' } }
 * de chu noi dung anh cua mot nhom ban ghi; khong dang ky nguoi ngoi nao ⇒ anh bi bo qua (dung y ban goc).
 * Nhan: khong co.
 * Tra: chuoi ten slot con.
 */
export const SLOT_TRAJECTORY_IMAGES = "conversation.trajectory.images";

/**
 * Namespace tu dien ma row nay so huu — NGUYEN VAN tu bundle goc (const NS = 'trajectory').
 * Hai tu dien zh/en nam trong lat nguyen van (src/parts/part-01.ts), khong chep lai.
 * Nhan: khong co.
 * Tra: chuoi namespace.
 */
export const NS = "trajectory";

/**
 * Ten hook ma row nay cap qua ctx.uiSession.provide — NGUYEN VAN tu bundle goc.
 * Day la CUA DE chu so huu tra ve mot the hien DAY DU cho slot cua goi khac:
 * resolve(binding) tra { hooks: { trajectory: { getSnapshot, subscribe } } }.
 * Thieu getSnapshot ⇒ TypeError ⇒ CA thanh ben khong render (xem muc 8 cua recipe).
 * Nhan: khong co.
 * Tra: chuoi ten hook.
 */
export const HOOK_TRAJECTORY = "trajectory";

/** Nhan hieu hieu ung vong doi — NGUYEN VAN nhan cua ban goc (dung cho log chan doan). */
export const EFFECT_DICTIONARIES = "ui-trajectory: dictionaries";

/** Mot cap 'ten bien trong lat' ↔ 'goi ma bang module cua trang phai co'. */
export interface RequireBinding {
  /** Ten bien ma cac lat bundle goc tham chieu (nguyen van). */
  readonly binding: string;
  /** Goi ma bang module cua trang phai co (nguyen van). */
  readonly specifier: string;
}

/**
 * Nam goi ma ban goc require tu bang module cua trang — NGUYEN VAN tung dong cua bundle goc.
 * Thu tu PHAI giu dung: ban goc khai bien theo thu tu nay va cac lat tham chieu ten bien do.
 */
export const REQUIRE_BINDINGS: readonly RequireBinding[] = [
  { binding: "_deepseek_ai_dsh_client_store", specifier: "@galaxy-blackhole/gbh-client-store" },
  { binding: "react_jsx_runtime", specifier: "react/jsx-runtime" },
  { binding: "react", specifier: "react" },
  { binding: "_tanstack_react_virtual", specifier: "@tanstack/react-virtual" },
  { binding: "_deepseek_ai_dsh_client_ui_primitives", specifier: "@galaxy-blackhole/gbh-client-ui-primitives" },
];
