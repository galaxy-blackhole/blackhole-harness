/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nua browser cua row product-analytics: phoi service productAnalytics cho cac row khac goi track(), va theo luong policy cua Host
 */

import { CLIENT_INJECT, POLICY_STREAM_ENDED, POLICY_STREAM_NAME, ROW_NAME, SERVICE_NAME } from "./ids.ts";
import type { ProductAttributes, ProductEvent } from "./types.ts";

/** Ham require ma bo nap module truyen vao factory (row nay khong dung module ngoai). */
export type RequireFn = (specifier: string) => unknown;

/** Mot khung cua luong policy: gia tri + ham xac nhan da xu ly (nghie thuc cua Gateway). */
interface PolicyFrame {
  /** Gia tri policy cua khung (true = duoc thu). */
  value: boolean;
  /** Xac nhan da xu ly khung nay. */
  accept(): void;
}

/** Luong policy do Gateway phia trang giu. */
interface PolicyStream {
  /** Duyet tung khung policy. */
  [Symbol.asyncIterator](): AsyncIterator<PolicyFrame>;
  /** Dong luong va nha tai nguyen cua no. */
  dispose(): unknown;
}

/** Lua chon mo mot luong Remote (dung nguyen hinh dang ban goc). */
interface StreamOptions {
  /** Ten luong (chi de chan doan). */
  name: string;
  /** Mo luong Remote theo tin hieu vong doi do Gateway cap. */
  open(signal: AbortSignal): AsyncIterable<boolean>;
  /** Loi tra ve khi luong ket thuc ngoai y muon. */
  ended(): Error;
  /** Goi khi carrier (WebSocket) hong. */
  carrierFailed(): void;
}

/** Context phia trang ma row nay dung (chi khai phan duoc dung). */
export interface ClientContext {
  /** Dang ky mot service cho ca trang (cac row khac doc bang ctx.get). */
  provide(name: string, value: unknown): unknown;
  /** Dang ky hieu ung vong doi; ham don dep chay khi fiber tat. */
  effect(callback: () => void | (() => void), label?: string): unknown;
  /** Tang Remote cua Gateway phia trang. */
  remote: {
    /** Namespace cua row nay (do api-remotes cua trang mount san). */
    productAnalytics: {
      /** Gui mot su kien len Host; Host tu loc theo policy va danh tinh. */
      report(event: ProductEvent): Promise<unknown>;
      /** Mo luong policy cua Host (che do stream). */
      watchPolicy(signal: AbortSignal): AsyncIterable<boolean>;
    };
    /** Mo mot luong Remote co nghie thuc khung (value + accept). */
    $stream(options: StreamOptions): PolicyStream;
  };
}

/** Be mat service productAnalytics phia trang — dung y ban goc ma cac row khac dang goi. */
export interface ClientAnalyticsService {
  /** Host hien tai co cho thu khong (policy dong bo tu Host). */
  readonly enabled: boolean;
  /**
   * Gui mot su kien; KHONG giu lai de gui bu khi mat ket noi hay khi policy bat lai (dung nhu ban goc).
   * Nhan: name — ten su kien; attributes — thuoc tinh nghiep vu; timestamp — thoi diem (mac dinh bay gio).
   * Tra: khong.
   */
  track(name: string, attributes?: ProductAttributes, timestamp?: number): void;
  /** Dong luong policy va ngung thu. */
  dispose(): void;
}

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham.
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service da dang ky
//   ⇒ row ket loading. Boolean o pham vi module khong quan tam ctx nao.
let bundleInstalled = false;

/** Luoi trong: ghi nho ctx da cai, de mot lan goi lai voi ctx cu cung bi chan (pham vi MODULE). */
const analyticsContexts = new WeakSet<object>();

/**
 * Dung service productAnalytics phia trang: doc policy tu Host, va chuyen track() thanh RPC report.
 * Nhan: ctx — context phia trang (co remote.productAnalytics).
 * Tra: service da san sang (chua dang ky vao context — applyInner lam viec do).
 */
export function createAnalyticsService(ctx: ClientContext): ClientAnalyticsService {
  let collecting = false;
  let stream: PolicyStream | undefined;
  const submit = async (event: ProductEvent): Promise<void> => {
    try {
      await ctx.remote.productAnalytics.report(event);
    } catch {
      // Ban goc NUOT loi gui: do luong san pham khong bao gio duoc lam hong giao dien.
    }
  };
  const service: ClientAnalyticsService = {
    get enabled(): boolean {
      return collecting;
    },
    track(name: string, attributes?: ProductAttributes, timestamp?: number): void {
      if (!collecting) return;
      void submit({ eventName: name, attributes: attributes ?? {}, timestamp: timestamp ?? Date.now() });
    },
    dispose(): void {
      collecting = false;
      stream?.dispose();
      stream = undefined;
    },
  };
  // Chi vo desktop moi co luong policy (nguyen van ban goc: kiem tra dshDesktop trong globalThis).
  if ("dshDesktop" in globalThis) {
    stream = ctx.remote.$stream({
      name: POLICY_STREAM_NAME,
      open: (signal: AbortSignal) => ctx.remote.productAnalytics.watchPolicy(signal),
      ended: () => new Error(POLICY_STREAM_ENDED),
      carrierFailed: () => {
        collecting = false;
      },
    });
    const policy = stream;
    void (async () => {
      try {
        for await (const frame of policy) {
          collecting = frame.value;
          frame.accept();
        }
      } catch {
        collecting = false;
      }
    })();
  }
  return service;
}

/**
 * Than plugin: phoi service productAnalytics va noi vong doi cua no vao fiber cua row.
 * Nhan: ctx — context phia trang.
 * Tra: khong.
 */
export function applyInner(ctx: ClientContext): void {
  const service = createAnalyticsService(ctx);
  ctx.provide(SERVICE_NAME, service);
  ctx.effect(() => () => {
    service.dispose();
  }, ROW_NAME + ": policy stream");
}

/**
 * Dung mat plugin cua row product-analytics (factory ma bundle dang ky voi __ModuleLoader__).
 * Nhan: requireFn — ham nap module cua bang module trang (row nay khong dung).
 * Tra: mat plugin ma tang nap goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): { name: string; inject: readonly string[]; apply(ctx: ClientContext): void } {
  void requireFn;
  return {
    name: ROW_NAME,
    inject: CLIENT_INJECT,
    /**
     * Phoi service productAnalytics dung MOT lan cho ca trang.
     * Nhan: ctx — context goc phia trang.
     * Tra: khong — tra quyen cho tang nap.
     */
    apply(ctx: ClientContext): void {
      const key: object = ctx;
      if (bundleInstalled || analyticsContexts.has(key)) {
        console.warn("gbh-client-product-analytics: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
      } catch (error) {
        // Cordis nuot loi cua apply nen khong ai biet vi sao row ket: in ra roi VAN nem tiep (khong nuot loi).
        console.error("gbh-client-product-analytics: apply nem loi", error);
        throw error;
      }
      // ⚠️ 18/10/2026: CO CHI BAT SAU KHI applyInner CHAY XONG. Bat som ⇒ neu dang ky nem giua duong thi co da
      //   = true ⇒ lan cai thu hai thoat som ⇒ service khong bao gio duoc phoi lai (ca that: ui-settings-general).
      bundleInstalled = true;
      analyticsContexts.add(key);
    },
  };
}
