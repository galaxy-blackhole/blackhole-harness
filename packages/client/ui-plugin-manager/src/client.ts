/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào nửa browser của row ui-plugin-manager — factory mà "lib/client.js" của ta gọi: nạp bảng
 *      module qua require của loader, chèn CSS của trang MỘT lần, dựng mặt plugin qua
 *      createPluginManagerClient, rồi bọc apply bằng CỔNG khuôn #3 (boolean phạm vi module + WeakSet theo
 *      ctx, lỗi thì console.error kèm id + RETHROW).
 */

import { PACKAGE_NAME, NS, PANEL_ID } from "./ids.ts";
import { createPluginManagerClient, type PluginManagerClientCtx } from "./plugin.ts";
import { loadModules, type PluginManagerModules, type RuntimeRequire } from "./runtime.ts";
import type { ResolveSlotLabel } from "./tab-ledger.ts";

/** Hàm require do bảng module của loader cấp cho factory (gọi lúc vạt chất hoá). */
export type RequireFn = RuntimeRequire;

/** CSS của trang Plugins, do "build.ts" nhúng bằng define; chạy từ nguồn (test) thì tra biến toàn cục. */
declare const __GBH_PLUGIN_MANAGER_CSS__: string;

/** Id gắn vào "data-plugin-css" — cùng tên file CSS với bản gốc để đối chiếu DOM. */
const STYLE_TAG = PACKAGE_NAME + "/PluginManagerPage.module.css";

/** Bảng module của trang — thứ DUY NHẤT mà bundle được phép đăng ký vào. */
export interface ModuleLoaderLike {
  /**
   * Đăng ký một factory theo id module.
   * Nhận: spec — cặp { id, factory }.
   * Trả: giá trị trả của loader (bị bỏ qua).
   */
  load(spec: { readonly id: string; readonly factory: (requireFn: RequireFn) => unknown }): unknown;
}

/** Mặt module mà loader nhận từ factory của bundle nửa browser. */
export interface ClientPluginModule {
  /** Namespace từ điển — bản gốc export `NS` ở mặt module. */
  NS: string;
  /** Id panel Plugins — bản gốc export `PANEL_ID` ở mặt module. */
  PANEL_ID: string;
  /** Tên package (quy ước của repo: dùng cho chẩn đoán + HMR). */
  readonly name: string;
  /** Seam service cần có (8 service, đúng thứ tự bản gốc). */
  readonly inject: string[];
  /**
   * Thân plugin; cổng chống cài hai lần nằm NGOÀI applyInner của "plugin.ts".
   * Nhận: ctx — seam context phía browser.
   * Trả: không.
   */
  apply(ctx: PluginManagerClientCtx): void;
}

/**
 * Chèn thẻ style cho CSS của module, đúng khuôn bản gốc (chỉ chèn MỘT lần theo "data-plugin-css").
 *
 * Khuôn #5: thiếu "document" (môi trường không có DOM) thì TẮT tính năng phụ và KHÔNG ném — CSS chỉ là
 * trang trí, ném ở đây sẽ làm hỏng cả lượt nạp module. Khác bản gốc ở chỗ không cảnh báo: hàm này chạy mỗi
 * lần vạt chất hoá module, cảnh báo sẽ thành tiếng ồn trong test không DOM (đây là dị biệt có chủ đích).
 * Nhận: tagId — id gắn vào "data-plugin-css"; cssText — văn bản CSS.
 * Trả: không.
 */
function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * Nạp CSS của trang Plugins — một module duy nhất, đúng thứ tự bản gốc.
 * Nhận: không.
 * Trả: không.
 */
function injectStyles(): void {
  injectStyle(STYLE_TAG, typeof __GBH_PLUGIN_MANAGER_CSS__ === "string" ? __GBH_PLUGIN_MANAGER_CSS__ : "");
}

/**
 * Lấy hàm chuẩn hoá nhãn của "@galaxy-blackhole/gbh-client-ui-slots" từ bảng module.
 *
 * Khuôn #5: thiếu hàm này (bảng module lạ) thì trả hàm luôn "undefined" để trang vẫn chạy — nhãn rỗng còn
 * hơn ném và mất cả màn Plugins.
 * Nhận: modules — bảng module của loader.
 * Trả: hàm resolveSlotLabel.
 */
function resolveSlotLabelOf(modules: PluginManagerModules): ResolveSlotLabel {
  const resolve = (modules.slots as { resolveSlotLabel?: unknown }).resolveSlotLabel;
  if (typeof resolve !== "function") return () => undefined;
  return resolve as ResolveSlotLabel;
}

// ⚠️ CỔNG CHỐNG CÀI HAI LẦN — PHẠM VI MODULE, đặt TRƯỚC JSDoc của hàm (khuôn #3 của task-57).
// KHÔNG khoá theo ctx: ca thật là HAI ENTRY ⇒ HAI ctx (loader.create cho mỗi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MỚI) nên cổng khoá-theo-ctx KHÔNG BAO GIỜ kích hoạt ⇒ apply chạy hai lần ⇒ slot/service đăng ký
//   hai lần. Cờ CHỈ bật SAU KHI phần đăng ký chạy XONG: bật sớm mà đăng ký ném giữa đường thì lần cài thứ
//   hai thoát sớm ⇒ slot không bao giờ được đăng ký lại (ca thật: ui-settings-general, 18/10/2026).
let pluginManagerInstalled = false;

/** Lưới an toàn thứ hai: một ctx đã cài XONG thì không cài lại (WeakSet, không giữ ctx sống). */
const pluginManagerContexts = new WeakSet<object>();

/**
 * Dựng module nửa browser từ require của loader.
 *
 * Nhận: requireFn — hàm require do loader cấp (bảng module của trang: react · jsx-runtime · react-dom ·
 * store · slots · primitives · remotes · settings · layout · package-manifest · zod).
 * Trả: module mà loader gọi apply trên đó — inject 8 service + apply có cổng chống cài hai lần.
 */
export function createPlugin(requireFn: RequireFn): ClientPluginModule {
  const modules = loadModules(requireFn);
  injectStyles();
  const client = createPluginManagerClient(modules, resolveSlotLabelOf(modules));
  return {
    name: PACKAGE_NAME,
    // Mặt module của bản gốc có NS + PANEL_ID (A/B ab-client chỉ ra thiếu) — phơi lại cho parity 1:1.
    NS,
    PANEL_ID,
    inject: client.inject,
    /**
     * Thân plugin có cổng: bỏ qua lần cài thứ hai; lỗi thì ghi kèm id rồi RETHROW để Loader thấy entry hỏng.
     * Nhận: ctx — seam context phía browser.
     * Trả: không.
     */
    apply(ctx: PluginManagerClientCtx): void {
      if (pluginManagerInstalled || pluginManagerContexts.has(ctx)) {
        console.warn(PACKAGE_NAME + ": bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        client.apply(ctx);
        pluginManagerContexts.add(ctx);
        pluginManagerInstalled = true;
      } catch (error) {
        console.error(PACKAGE_NAME + ": apply nem loi", error);
        throw error;
      }
    },
  };
}

/**
 * Đăng ký bundle vào bảng module của trang — bản CÓ KIỂU của ĐÚNG dòng mà "build.ts" in vào lib/client.js.
 *
 * Vì sao hàm này tồn tại (không chỉ là tiện ích): "bun run check:rows" đọc VĂN BẢN src/ để tìm lời gọi
 * đăng ký id; khuôn CJS-bọc-IIFE sinh lời gọi đó trong build.ts nên cổng không thấy ⇒ báo "nua client khong
 * goi load() o dau trong src/" ⇒ chặn mọi lượt boot của giàn. Giữ hai bên khớp nhau: id ở đây là
 * PACKAGE_NAME, đúng id mà build.ts in ra.
 * Nhận: loader — bảng module của trang; factory — hàm dựng mặt plugin.
 * Trả: không.
 */
export function loadBundle(loader: ModuleLoaderLike, factory: (requireFn: RequireFn) => unknown): void {
  loader.load({ id: PACKAGE_NAME, factory });
}