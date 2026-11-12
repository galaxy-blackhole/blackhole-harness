/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dang ky ban xem Office: chuyen doi co phien ban, tai dung PDF va canh bao font thieu
 */

import { documentTabInfoFactory } from "../document/contract.ts";
import { failureLine, type Translate } from "../failure-line.ts";
import { OFFICE_BODY_ID, OFFICE_EXTENSIONS, LOADING_RENDERER, NS, PRIORITY_BUILTIN } from "../ids.ts";
import { NS_OFFICE, NS_PDF, officeEn, officeZh } from "../locales.ts";
import { createOfficeBody } from "./office-body.ts";
import { createFontNotice } from "./font-notice.ts";
import { createOfficeFontAction } from "./office-font-action.ts";
import { createOfficeStore, type OfficeTabView } from "./store.ts";
import { officeFace, type OfficeActionsLike, type OfficeRead, type OfficeReadResult } from "./face.ts";
import { OfficePreviewCache } from "./cache.ts";
import { retainDocumentTabs } from "../document/tab-lifetime.ts";
import type { DocumentPreviewRegistry } from "../document/registry.ts";
import type { ClientContextLike } from "../types.ts";
import type { KindEnvironment } from "../kinds.ts";
import type { OfficePrimitivesLike } from "./office-body.ts";
import type { FontNoticePrimitivesLike } from "./font-notice.ts";
import type { OfficeLimits } from "../config.ts";
import { viOffice } from "../locales-vi.ts";

/** Moi thu ma ban xem Office can them ngoai {@link KindEnvironment}. */
export interface OfficeKindEnvironment extends KindEnvironment {
  /** Primitive cua than Office. */
  officePrimitives: OfficePrimitivesLike;
  /** Primitive cua canh bao font. */
  fontNoticePrimitives: FontNoticePrimitivesLike;
  /** createPortal cua react-dom. */
  createPortal: (children: unknown, container: unknown) => unknown;
  /** Than PDF treo dung chung. */
  lazyPdfBody: unknown;
  /** Store + inject cua ban xem PDF dung chung. */
  pdfPresentation: { store: unknown; inject: (sessionId: string, actions: { forget(tabId: string): void }) => Record<string, unknown> };
  /** Ham ve mot slot con. */
  renderSlot: unknown;
  /** Gioi han cache Office. */
  limits: OfficeLimits;
}

/** Mot loi chuyen doi cua Host. */
interface ConversionFailure {
  /** Ma loi on dinh. */
  code?: string;
  /** Thong diep. */
  message: string;
  /** Chi tiet kem theo. */
  details?: Record<string, unknown>;
}

/**
 * Doi ma loi chuyen doi cua Host thanh khoa tu dien — nguyen van ban goc.
 * Nhan: code — ma loi.
 * Tra: khoa tu dien.
 */
export function conversionErrorKey(code: string | undefined): string {
  switch (code) {
    case "input-too-large":
    case "output-too-large": return "tooLarge";
    case "invalid-document":
    case "unsupported-format": return "invalid";
    case "timeout": return "timeout";
    case "unavailable": return "unavailable";
    case "busy": return "busy";
    case "source-changed": return "changed";
    default: return "failed";
  }
}

/**
 * Dang ky ban xem Office voi tai dung PDF co phien ban va canh bao font thieu.
 * Nhan: ctx — context goc phia client; env — moi thu dung san.
 * Tra: khong.
 */
export function applyOfficeKind(ctx: ClientContextLike, env: OfficeKindEnvironment): void {
  const id = OFFICE_BODY_ID;
  const extensions = OFFICE_EXTENSIONS;
  ctx.effect(() => ctx.locale.register(NS_OFFICE, { vi: viOffice, zh: officeZh, en: officeEn }));
  const t = ctx.locale.bind(NS_OFFICE);
  const unavailable = (_file: unknown, signal: AbortSignal): Promise<OfficeReadResult> => {
    signal.throwIfAborted();
    return Promise.reject(new Error(t("unavailable")));
  };
  let read: OfficeRead = unavailable as unknown as OfficeRead;
  ctx.effect(() => env.previews.register({ id, extensions, binaryExtensions: extensions, priority: PRIORITY_BUILTIN, title: () => t("title"), loading: LOADING_RENDERER, wrap: false }));
  const store = createOfficeStore(env.storeModule.defineStore);
  const FontNotice = createFontNotice(env.runtime, env.react, { createPortal: env.createPortal }, env.fontNoticePrimitives);
  const OfficeFontAction = createOfficeFontAction(FontNotice);
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document.action", () => ctx.slots.register({
    name: "sidebar.right.tab.document.action",
    key: id,
    locale: NS_OFFICE,
    store,
  }, OfficeFontAction)));
  const retainTab = retainDocumentTabs(ctx);
  const documentT: Translate = ctx.locale.bind(NS);
  const face = officeFace(
    (file, signal) => read(file, signal),
    (failure) => ("code" in failure && failure.code !== undefined ? failureLine(documentT, failure as { code: string; message: string }) : documentT("error.unavailable", { message: failure.message })),
  );
  const OfficeBody = createOfficeBody(env.runtime, env.react, env.officePrimitives, env.LoadingIndicator);
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
    name: "sidebar.right.tab.document",
    key: id,
    locale: NS_OFFICE,
    store,
    children: { "sidebar.right.tab.document.office.pdf": { kind: "keyed", scope: "session", inject: { hooks: { tabInfo: documentTabInfoFactory } } } },
    inject: (sessionId: string, actions: OfficeActionsLike) => ({
      ...face(sessionId, actions),
      retainTab: (tabId: string, signal: AbortSignal) => { retainTab(tabId, signal, actions.forget); },
    }),
  }, OfficeBody)));
  const pdfPresentation = env.pdfPresentation;
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document.office.pdf", () => ctx.slots.register({
    name: "sidebar.right.tab.document.office.pdf",
    key: id,
    locale: NS_PDF,
    ...pdfPresentation,
  }, env.lazyPdfBody)));
  ctx.inject(["remote", "remote.officeToPdf", "remote.workspaceFiles"], (scope) => {
    const convert = async (file: { sessionId: string; path: string }, signal: AbortSignal, priority: string) => {
      signal.throwIfAborted();
      const result = await scope.remote.officeToPdf.render(file.sessionId, file.path, priority, signal);
      signal.throwIfAborted();
      if (!result.ok && result.error.code === "document-render/failed") throw new Error(t(conversionErrorKey(result.error.details?.reason as string | undefined)), { cause: result.error });
      return result;
    };
    const createCache = (): OfficePreviewCache => new OfficePreviewCache(
      async (file, signal) => {
        const authorized = await scope.remote.workspaceFiles.readBytes(file.sessionId, file.path, { range: { offset: 0, length: 1 } }, signal);
        signal.throwIfAborted();
        if (!authorized.ok) return authorized;
        const metadata = await scope.remote.workspaceFiles.stat(file.sessionId, file.path, signal);
        if (metadata.ok && (authorized.value.absolutePath !== metadata.value.absolutePath || authorized.value.version !== metadata.value.version)) throw new Error(t("changed"));
        return metadata;
      },
      convert as unknown as OfficePreviewCache extends never ? never : ConstructorParameters<typeof OfficePreviewCache>[1],
      env.limits.maxCachedEntries,
      env.limits.maxCachedBytes,
      env.limits.maxPending,
      env.limits.maxReaders,
      async (signal) => {
        const result = await scope.remote.officeToPdf.generation(signal);
        signal.throwIfAborted();
        if (!result.ok) throw new Error(t("unavailable"), { cause: result.error });
        return result;
      },
      () => new Error(t("busy")),
    );
    let cache = createCache();
    const retired = new Set<Promise<void>>();
    read = (async (file: { sessionId: string; path: string }, signal: AbortSignal) => {
      const result = await cache.read(file, signal);
      if (!result.ok && (result.error.code === "gateway/invocation-unavailable" || result.error.code === "gateway/service-unavailable")) throw new Error(t("unavailable"), { cause: result.error });
      return result;
    }) as unknown as OfficeRead;
    scope.on("connection/reset", () => {
      const previous = cache;
      cache = createCache();
      const closing = previous.dispose().finally(() => { retired.delete(closing); });
      retired.add(closing);
    });
    scope.effect(() => async () => {
      read = unavailable as unknown as OfficeRead;
      await Promise.all([...retired, cache.dispose()]);
    });
  });
}

/** Kieu cua mot lan xem Office — tai xuat cho test. */
export type { OfficeTabView };
