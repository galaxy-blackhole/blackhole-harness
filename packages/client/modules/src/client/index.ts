/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Mat bootstrap phia browser: dung he module tu bundle da vat chat hoa va dang ky vao ctx.modules
 */

import { ClientModuleSystem, type ClientModuleSystemOptions, type RegistrationTarget } from "./system.ts";

export { ClientModuleSystem } from "./system.ts";
export { ClientEntries, ReleaseChangeGate, removeOwnedStyles, tearDownEntryFiber } from "./entries.ts";
export { exactPackageSpecifier, parseBootManifest, parseDshClient, readRelease, sameRelease, stripClientSuffix } from "./manifest.ts";
export type { BootManifest, ClientModuleRegistration, ClientModuleRecord, ClientModuleRow, ClientPluginRow, ClientRequire } from "./manifest.ts";

/** Tuỳ chọn thô mà vỏ truyền vào facade `create()`. */
export interface CreateClientModuleSystemOptions {
  /** Đồ thị boot thô (`window.__GBH_BOOT__ (alias __GBH_BOOT__)`). */
  boot: unknown;
  /** Bảng module nền tảng của vỏ (React…). */
  staticModules: Record<string, unknown>;
  /** Bộ nạp script tuỳ chọn của vỏ. */
  loadBundle?: (url: string) => Promise<void>;
}

/** Bundle bootstrap (chính package này) sau khi facade đã vạt chất hoá factory của nó. */
export interface BootstrapModule {
  /** Id đã đăng ký (`<ten-goi>` hoặc `<ten-goi>/client`). */
  id: string;
  /** Export của chính bundle này. */
  exports: unknown;
}

/** Phần context mà plugin này cần: Loader đã mang hệ module client và bảng reflect để công bố service. */
export interface ClientPluginContext {
  /** Loader của vỏ, nơi hệ module được cài làm seam `internal`. */
  loader: { internal?: unknown };
  /** Bảng công bố service của cordis. */
  reflect: { provide(name: string, value: unknown): void };
}

/** Service mà plugin này công bố: chính hệ module do vỏ dựng. */
export const inject = ["loader"];

/**
 * Dựng hệ module sống từ bundle bootstrap mà facade HTML đã vạt chất hoá.
 * Nhận: target là facade đăng ký (hàng đợi của nó trở thành sink sống), bootstrapModule là id + export
 * của chính bundle này, options là đồ thị boot thô, bảng nền tảng và bộ nạp tuỳ chọn.
 * Trả: hệ module vừa dựng.
 */
export function createClientModuleSystem(
  target: RegistrationTarget,
  bootstrapModule: BootstrapModule,
  options: CreateClientModuleSystemOptions,
): ClientModuleSystem {
  const systemOptions: ClientModuleSystemOptions = {
    manifest: options.boot,
    staticModules: options.staticModules ?? {},
    registrationTarget: target,
    bootstrapModule,
    ...(options.loadBundle === undefined ? {} : { loadBundle: options.loadBundle }),
  };
  return new ClientModuleSystem(systemOptions);
}

/**
 * Ghi danh hệ module do kernel dựng thành service `ctx.modules`.
 * Nhận: context gốc phía client.
 * Trả: không.
 * @throws khi Loader chưa được cài hệ module client (dấu nhận dạng `version` sai).
 */
export function apply(ctx: ClientPluginContext): void {
  const modules = ctx.loader.internal as { version?: string } | undefined;
  if (modules?.version !== "client") throw new Error("client-modules: the Loader has no client module system");
  ctx.reflect.provide("modules", modules);
}
