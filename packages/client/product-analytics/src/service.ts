/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nua host cua row product-analytics: service remote productAnalytics (namespace productAnalytics) — doc policy, phat luong policy, va day su kien da loc sang backend telemetry
 */

import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";

import { HOST_INJECT, ROW_NAME, SERVICE_NAME, REMOTE_NAMESPACE } from "./ids.ts";
import {
  mergeAttributes,
  readAppVersion,
  readEnabledFlag,
  type ProductAnalyticsConfig,
  type ProductAttributes,
  type ProductDeviceIdentity,
  type ProductEvent,
  type ProductTelemetryRecord,
} from "./types.ts";

/**
 * Context Host toi thieu ma row nay dung (API tra service + vong doi + event).
 *
 * Vi sao tra service bang ctx.get thay vi doc thang thuoc tinh: khi Gateway goi mot phuong thuc Remote, no chay
 * tren context cua BEN GOI — noi KHONG ap danh sach inject cua row — nen truy cap kieu thuoc tinh nem loi
 * "cannot get property ... without inject" (bai hoc da ghi o packages/host/account-controller).
 */
interface AnalyticsContext {
  /** Tra service theo ten, khong can inject. */
  get(name: string): unknown;
  /** Dang ky nghe event cordis; tra ham huy dang ky. */
  on(name: string, listener: (...args: unknown[]) => void): () => void;
  /** Dang ky hieu ung vong doi; ham don dep chay khi fiber tat. */
  effect(callback: () => void | (() => void), label?: string): unknown;
  /** Cho mot tap service san sang roi chay callback trong context con. */
  inject(deps: string[], callback: (child: AnalyticsContext) => void): unknown;
  /** Fiber cua chinh plugin nay (dung cho settings.configure). */
  fiber: unknown;
}

/** Nha cung cap danh tinh thiet bi cua kernel (service deepseekAccount, tra bang ctx.get). */
interface AccountIdentityProvider {
  /** Doc danh tinh thiet bi; nem loi khi chua co credential. */
  getDeviceIdentity(): Promise<ProductDeviceIdentity>;
}

/** Backend telemetry cua kernel (service productTelemetry, tra bang ctx.get). */
interface TelemetrySink {
  /** Day mot ban ghi da loc; khong tra ket qua. */
  emit(record: ProductTelemetryRecord): void;
}

/** Mot su kien phien ma row nay nghe (chi phan duoc dung). */
interface SessionEventShape {
  /** Loai su kien (row nay chi quan tam compaction/start). */
  type?: string;
  /** Du lieu kem theo cua su kien. */
  data?: { turn?: unknown };
}

/** Mot phien ma row nay nghe (chi phan duoc dung). */
interface SessionShape {
  /** Id phien. */
  id?: string;
}

/**
 * Mot cho cho phep thuc day bang tay (thay Promise.withResolvers — lib ES2023 cua repo khong co san).
 * Nhan: khong co.
 * Tra: cap promise + ham resolve.
 */
function createWake(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Thao tac san pham phia Host: doc cong tac thu, phat luong policy, va day su kien da loc len backend.
 *
 * Peer @deepseek-ai/dsh-typert-protocol thuoc seam RPC cua kernel (bang §3b cua packages/README.md): lop nay
 * PHAI ke thua dung base class do de Gateway discovery duoc, va o M3 kernel cua ta phoi cung ten goi.
 * Hai service uy quyen (deepseekAccount · productTelemetry) tra qua Context, KHONG import goi cua chung.
 */
export class ProductAnalytics extends TypertRemoteService {
  /** Seam can co: nha cung cap danh tinh thiet bi (xem HOST_INJECT — productTelemetry tra luc goi). */
  static inject = HOST_INJECT;
  /**
   * Schema cau hinh: cong tac thu (mac dinh true nhu ban goc) + phien ban ung dung.
   * appVersion co default rong de row mount duoc ca khi patch khong khai config (lab mount chi co id + name).
   */
  static Config = z.object({
    /** Cong tac thu su kien; mac dinh true nhu ban goc. */
    enabled: z.boolean().default(true),
    /** Phien ban ung dung desktop (rong = khong gan app_version). */
    appVersion: z.string().default(""),
  });

  /** Cau hinh tho cua row — doc LIVE moi lan goi (ban goc doc this.config.enabled.get() moi lan). */
  private readonly config: ProductAnalyticsConfig | undefined;
  /** Context cua CHINH service nay (khong phai context cua ben goi luc dispatch). */
  private readonly owner: AnalyticsContext;
  /** false sau khi fiber tat — moi vong phat policy phai dung. */
  private active = true;
  /** Nhung nguoi nghe thay doi policy (mot cho cho moi vong watchPolicy). */
  private readonly listeners = new Set<() => void>();

  /**
   * Dang ky service productAnalytics (namespace productAnalytics) va noi cac nguon su kien cua phien.
   * Nhan: ctx — context cua plugin; config — cau hinh da kiem boi schema static Config.
   */
  constructor(ctx: Context, config?: ProductAnalyticsConfig) {
    super(ctx, SERVICE_NAME, { namespace: REMOTE_NAMESPACE });
    const owner = ctx as unknown as AnalyticsContext;
    this.owner = owner;
    this.config = config;
    owner.effect(() => () => {
      this.active = false;
      this.notify();
    }, ROW_NAME + ": dispose");
    owner.on("loader/volatile-update", () => {
      this.notify();
    });
    owner.inject(["settings"], (child) => {
      const settings = child.get("settings") as { configure?: (value: { auto: boolean }, fiber: unknown) => void } | undefined;
      if (settings === undefined || typeof settings.configure !== "function") return;
      child.effect(() => {
        settings.configure?.({ auto: false }, owner.fiber);
      }, ROW_NAME + ": settings auto");
    });
    owner.on("session/event", (...args: unknown[]) => {
      const session = args[0] as SessionShape | undefined;
      const event = args[1] as SessionEventShape | undefined;
      if (event?.type !== "compaction/start") return;
      const attributes: ProductAttributes = { trigger_type: event.data?.turn === null ? "manual" : "auto" };
      if (session?.id !== undefined) attributes.session_id = session.id;
      void this.report({ eventName: "context_compression", timestamp: Date.now(), attributes });
    });
  }

  /**
   * Doc cong tac thu hien hanh.
   * Nhan: khong co.
   * Tra: true khi Host con song VA cau hinh cho phep thu.
   */
  @Remote
  enabled(): boolean {
    // Doc LIVE: enabled la truong volatile — nguoi dung doi cong tac thi watchPolicy phai thay ngay.
    return this.active && readEnabledFlag(this.config);
  }

  /**
   * Phat luong policy: gia tri dau tien ngay khi mo, roi moi lan cau hinh doi hoac service bi go.
   * @param signal - vong doi cua nguoi dang ky (huy la ket thuc luong).
   * @returns luong gia tri policy cho toi khi bi huy hoac service bi go.
   */
  @Remote({ mode: "stream" })
  async *watchPolicy(signal: AbortSignal): AsyncIterable<boolean> {
    let wake = createWake();
    const changed = (): void => {
      wake.resolve();
    };
    this.listeners.add(changed);
    signal.addEventListener("abort", changed, { once: true });
    try {
      while (this.active && !signal.aborted) {
        yield this.enabled();
        await wake.promise;
        wake = createWake();
      }
    } finally {
      this.listeners.delete(changed);
      signal.removeEventListener("abort", changed);
    }
  }

  /**
   * Day mot su kien da loc len backend telemetry; thieu danh tinh thi bo qua, KHONG bao gio tu sinh.
   * @param event - su kien san pham (khong chua noi dung tin nhan hay credential).
   * @returns sau khi da day cuc bo; khong co xac nhan tu kho du lieu.
   */
  @Remote
  async report(event: ProductEvent): Promise<void> {
    if (!this.enabled()) return;
    try {
      const identity = await this.identity();
      if (!this.enabled()) return;
      const sink = this.telemetry();
      // Thieu backend (row desktop-product-telemetry tat o profile khong phai desktop) ⇒ BO QUA, khong nem:
      // day la khac biet CO Y so voi ban goc (ban goc co productTelemetry trong inject tinh nen row pending).
      if (sink === undefined) return;
      sink.emit({
        ...event,
        body: event.eventName,
        attributes: mergeAttributes(event, identity, readAppVersion(this.config)),
      });
    } catch (error) {
      this.loggerWarn("Product analytics submission failed", error);
    }
  }

  /** Danh thuc moi vong watchPolicy dang cho (cau hinh doi hoac service bi go). */
  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /**
   * Doc danh tinh thiet bi tu service deepseekAccount; thieu service hoac loi thi coi nhu khong co danh tinh.
   * Nhan: khong co.
   * Tra: danh tinh thiet bi, hoac undefined.
   */
  private async identity(): Promise<ProductDeviceIdentity | undefined> {
    const provider = this.owner.get("deepseekAccount") as AccountIdentityProvider | undefined;
    if (provider === undefined || typeof provider.getDeviceIdentity !== "function") return undefined;
    try {
      return await provider.getDeviceIdentity();
    } catch {
      return undefined;
    }
  }

  /**
   * Tra backend telemetry cua kernel, hoac undefined khi row do dang tat (profile khong phai desktop).
   * Nhan: khong co.
   * Tra: backend telemetry, hoac undefined.
   */
  private telemetry(): TelemetrySink | undefined {
    const sink = this.owner.get("productTelemetry") as TelemetrySink | undefined;
    return sink !== undefined && typeof sink.emit === "function" ? sink : undefined;
  }

  /**
   * Ghi canh bao qua logger cua cordis (khong nem: duong nong cua telemetry khong duoc lam hong phien).
   * Nhan: message — thong bao; error — gia tri bat duoc.
   * Tra: khong.
   */
  private loggerWarn(message: string, error: unknown): void {
    const logger = this.owner.get("logger") as { warn?: (message: string, error?: unknown) => void } | undefined;
    if (logger !== undefined && typeof logger.warn === "function") logger.warn(message, error);
  }
}

/** Mac dinh cua module: cordis nhan lop Service lam plugin va tu dang ky service productAnalytics. */
export default ProductAnalytics;