/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-message-feedback — mot id module, hai slot nguyen van, hai id muc
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-message-feedback";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio dang ky trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-message-feedback";

/**
 * Ten slot danh sach chua hai nut Like/Dislike cua tung tin nhan assistant — nguyen van tu bundle goc.
 * Nhan: khong co.
 * Tra: chuoi ten slot.
 */
export const SLOT_ACTIONS = "conversation.chat.assistant-actions";

/**
 * Ten slot overlay chua hop thoai phan hoi cua mot phien — nguyen van tu bundle goc.
 * Nhan: khong co.
 * Tra: chuoi ten slot.
 */
export const SLOT_OVERLAY = "conversation.input.overlay";

// ⚠️ Id muc KHONG khai thanh hang so: chung phai la LITERAL ngay tai cho dang ky trong plugin.ts
//   ("feedback" cho slot danh sach, "feedback-dialog" cho slot overlay) — dung nguyen van ban goc.

/** Thu tu chen cua muc assistant-actions (nguyen van tu ban goc: order 10). */
export const ACTION_ORDER = 10;

/** Thu tu chen cua muc overlay (nguyen van tu ban goc: order 2). */
export const OVERLAY_ORDER = 2;

/** Ten mien tu dien ma plugin so huu (namespace cua locale). */
export const NS = "feedback";

/** Ten lenh host ma ta treo trang tri /feedback len (nguyen van tu ban goc). */
export const COMMAND_NAME = "feedback";

/**
 * Dich vu bat buoc phai co truoc khi apply chay — y nguyen danh sach cua ban goc.
 * Thieu mot dich vu la plugin chi nam cho (pending) chu khong hong app.
 */
export const INJECT = ["slots", "remote", "remote.messageFeedback", "remote.sessionFeedback", "locale"] as const;

/**
 * Bon thuoc tinh cua `commandUi` ma ta dung khi treo trang tri /feedback.
 * Nhan: khong co.
 * Tra: doi tuong hang so.
 */
export const COMMAND_UI = { name: COMMAND_NAME } as const;
