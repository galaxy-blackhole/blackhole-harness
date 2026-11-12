/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-sidebar-documentpreview: mot loai tab, muoi hai cho ngoi va tam ban xem dung san
 */

import { readConfig } from "./config.ts";
import { createReadPage, textFace } from "./face.ts";
import { documentTabInfoFactory } from "./document/contract.ts";
import { DocumentPreviewRegistry } from "./document/registry.ts";
import { injectStyles } from "./css-inject.ts";
import { basenameOf, textDefinition } from "./definition.ts";
import { EFFECT, NS, PACKAGE_NAME, SLOT_PANE_TAB, SLOT_PANE_TAB_TITLE, TEXTPREVIEW_ID } from "./ids.ts";
import { applyCodeKind, applyHtmlKind, applyImageKind, applyMarkdownKind, applyPdfKind, applyTextKind, pdfBodyRegistrationLocal, type KindEnvironment } from "./kinds.ts";
import { applyExcelKind } from "./excel/excel-kind.ts";
import { applyOfficeKind } from "./office/office-kind.ts";
import { en, zh } from "./locales.ts";
import { createLoadingIndicator } from "./loading-indicator.ts";
import { createTextBody } from "./text-body.ts";
import { createTextPreview } from "./text-preview.ts";
import { createTextTitle } from "./text-title.ts";
import { createTextStore } from "./store.ts";
import { createZoomControls } from "./zoom/controls.ts";
import { createZoomViewport, zoomSurfaceClass } from "./zoom/viewport.ts";
import { createLazyPdfBody } from "./pdf/lazy-pdf-body.ts";
import { createLazyExcelBody } from "./excel/lazy-excel-body.ts";
import type { ClientContextLike, JsxRuntimeLike, ReactDomLike, ReactLike, RequireFn, StoreModuleLike } from "./types.ts";
import { vi } from "./locales-vi.ts";

/** Sau service ma ban goc khai — nguyen van, khong bot mot muc nao. */
export const INJECT: readonly string[] = ["slots", "locale", "sidebarRightTabs", "remote", "remote.workspaceFiles", "configForms", "resources"];

/** Mat plugin ma Loader nhan. */
export interface ClientPlugin {
  /** Ten package — cung la ownerId ma HMR tra rev. */
  readonly name: string;
  /** Seam can co. */
  readonly inject: readonly string[];
  /** Than plugin. */
  apply: (ctx: ClientContextLike) => void;
}

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua createPlugin.
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service da dang ky.
let documentPreviewInstalled = false;

/** Luoi an toan thu hai: mot ctx da cai xong thi khong cai lai (WeakSet, khong giu ctx song). */
const documentPreviewContexts = new WeakSet<object>();

/**
 * Dung mat plugin cua row ui-sidebar-documentpreview.
 * Nhan: requireFn — ham nap module cua bang module trang (react · react/jsx-runtime · ui-primitives · dsh-client-store · dompurify).
 * Tra: mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const runtime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
  const react = requireFn("react") as ReactLike;
  const reactDom = requireFn("react-dom") as ReactDomLike;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as Record<string, unknown>;
  const storeModule = requireFn("@galaxy-blackhole/gbh-client-store") as StoreModuleLike;
  injectStyles();
  const LoadingIndicator = createLoadingIndicator(runtime, primitives as { StateDot: unknown });
  const ZoomControls = createZoomControls(runtime, react, {
    Button: primitives.Button,
    Menu: primitives.Menu,
    Tooltip: primitives.Tooltip,
    IconChevronDownOutlineRegular: primitives.IconChevronDownOutlineRegular,
    IconPlusOutlineRegular: primitives.IconPlusOutlineRegular,
  });
  const ZoomViewport = createZoomViewport(runtime, react, ZoomControls);
  const TextPreview = createTextPreview(runtime, react, {
    PathLabel: primitives.PathLabel,
    FileTypeIcon: primitives.FileTypeIcon,
    classifyFileType: primitives.classifyFileType as (name: string) => string,
    Menu: primitives.Menu,
    Tooltip: primitives.Tooltip,
    IconNowrapFillRegular: primitives.IconNowrapFillRegular,
    IconWrapFillRegular: primitives.IconWrapFillRegular,
    IconPauseOutlineRegular: primitives.IconPauseOutlineRegular,
    IconPlayOutlineRegular: primitives.IconPlayOutlineRegular,
    IconRefreshOutlineRegular: primitives.IconRefreshOutlineRegular,
  }, LoadingIndicator);
  const TextTitle = createTextTitle(runtime, { FileTypeIcon: primitives.FileTypeIcon, classifyFileType: primitives.classifyFileType as (name: string) => string });
  const TextBody = createTextBody(runtime);

  return {
    name: PACKAGE_NAME,
    inject: [...INJECT],
    /**
     * Than plugin: dang ky loai tab, tu dien, muoi hai cho ngoi va tam ban xem dung san (idempotent).
     * Nhan: ctx — context goc phia client.
     * Tra: khong.
     */
    apply(ctx: ClientContextLike): void {
      if (documentPreviewInstalled || documentPreviewContexts.has(ctx as object)) {
        console.warn("gbh-client-ui-sidebar-documentpreview: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
        // ⚠️ 18/10/2026: CO CHI BAT SAU KHI applyInner CHAY XONG. Bat som ⇒ dang ky nem giua duong thi co da
        //   = true ⇒ lan cai thu hai thoat som ⇒ slot KHONG BAO GIO duoc dang ky lai ⇒ renderer gap undefined
        //   ⇒ React #130 (ca that: ui-settings-general, 18/10/2026).
        documentPreviewContexts.add(ctx as object);
        documentPreviewInstalled = true;
      } catch (error) {
        console.error("gbh-client-ui-sidebar-documentpreview: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
    },
  };

  /**
   * Than cua apply: so ban xem, loai tab, tu dien, hai cho ngoi cua loai tab va tam ban xem dung san.
   * Nhan: ctx — context goc phia client.
   * Tra: khong.
   */
  function applyInner(ctx: ClientContextLike): void {
    const config = readConfig((globalThis as { __GBH_DOCUMENT_PREVIEW_CONFIG__?: unknown }).__GBH_DOCUMENT_PREVIEW_CONFIG__ ?? {});
    const previews = new DocumentPreviewRegistry();
    const disposePreviews = ctx.reflect.provide("documentPreviews", previews);
    ctx.effect(() => disposePreviews);
    ctx.effect(() => ctx.sidebarRightTabs.register(textDefinition()), EFFECT.textType as string);
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), EFFECT.dictionaries as string);
    const store = createTextStore(storeModule.defineStore);
    const face = textFace(createReadPage(ctx.remote), (file, signal) => ctx.remote.workspaceFiles.readBytes(file.sessionId, file.path, {}, signal), ctx.resources);
    const source = { getSnapshot: previews.getSnapshot, subscribe: previews.subscribe };
    // ⚠️ KEYED: key cua slot PHAI bang id cua dinh nghia loai tab (TEXTPREVIEW_ID = PACKAGE_NAME). Ban goc dung
    //   DUNG MOT gia tri cho ca hai; lech nhau la renderer roi vao fallback ⇒ tab hien 'khong kha dung' MA
    //   KHONG CO LOI CONSOLE. Ten slot phai la LITERAL trong register({ name: "…" }) de check:rows doc duoc.
    ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: TEXTPREVIEW_ID,
      locale: NS,
      store,
      children: {
        "sidebar.right.tab.document": { kind: "keyed", scope: "session", inject: { hooks: { tabInfo: documentTabInfoFactory } } },
        "sidebar.right.tab.document.actions": { kind: "list", scope: "session" },
        "sidebar.right.tab.document.unpreviewable": { kind: "list", scope: "session" },
        "sidebar.right.tab.document.action": { kind: "keyed", scope: "session", inject: { hooks: { tabInfo: documentTabInfoFactory } } },
      },
      inject: (sessionId: string, actions: never) => ({
        ...face(sessionId, actions),
        hooks: { documentPreviews: source },
      }),
    }, TextPreview)), EFFECT.textBody as string);
    ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
      name: "sidebar.right.pane.tab.title",
      key: TEXTPREVIEW_ID,
    }, TextTitle)), EFFECT.textTitle as string);

    const environment: KindEnvironment = {
      previews,
      runtime,
      react,
      storeModule,
      LoadingIndicator,
      ZoomViewport,
      zoomSurfaceClass,
      codePrimitives: {
        CodeBlock: primitives.CodeBlock,
        languageForPath: primitives.languageForPath as (path: string) => string,
        CODE_HIGHLIGHT_EXTENSIONS: primitives.CODE_HIGHLIGHT_EXTENSIONS as readonly string[],
      },
      markdownPrimitives: { MarkdownText: primitives.MarkdownText },
      loadFrontmatterFields: () => requireAsync("./client.frontmatter-fields.js") as Promise<{ FrontmatterFields: unknown }>,
      loadPdf: () => requireAsync("./client.pdf.js") as Promise<{ PdfBody: unknown }>,
      plainBody: TextBody,
    };
    // ⚠️ PHAI dung SAU khi environment da co storeModule — truoc do la undefined (test bat duoc).
    const pdfPresentation = pdfBodyRegistrationLocal(ctx, environment);
    applyTextKind(ctx, environment);
    applyMarkdownKind(ctx, environment);
    applyHtmlKind(ctx, environment);
    applyImageKind(ctx, environment);
    applyPdfKind(ctx, environment);
    applyCodeKind(ctx, environment);
    applyOfficeKind(ctx, {
      ...environment,
      officePrimitives: {
        FileTypeIcon: primitives.FileTypeIcon,
        classifyFileType: primitives.classifyFileType as (name: string) => string,
        Button: primitives.Button,
      },
      fontNoticePrimitives: {
        Tooltip: primitives.Tooltip,
        Button: primitives.Button,
        IconWarningTriangleOutlineRegular: primitives.IconWarningTriangleOutlineRegular,
        IconCloseOutlineRegular: primitives.IconCloseOutlineRegular,
        useAnchoredPosition: primitives.useAnchoredPosition as (spec: Record<string, unknown>) => Record<string, unknown> | null,
        useDismissOnOutsidePointer: primitives.useDismissOnOutsidePointer as (anchor: unknown, open: boolean, close: () => void, panel: unknown) => void,
      },
      createPortal: reactDom.createPortal,
      lazyPdfBody: createLazyPdfBody(runtime, react, LoadingIndicator, () => requireAsync("./client.pdf.js") as Promise<{ PdfBody: unknown }>),
      pdfPresentation,
      renderSlot: undefined,
      limits: config.office,
    });
    applyExcelKind(ctx, {
      previews,
      runtime,
      react,
      LoadingIndicator,
      loadExcel: () => requireAsync("./client.excel.js") as Promise<{ ExcelBody: unknown }>,
      limits: config.excel,
    });
  }

  /**
   * Nap mot chunk noi bo cua chinh goi nay qua require.async cua bang module.
   * Nhan: id — duong dan chunk tuong doi (vi du "./client.pdf.js").
   * Tra: loi hua ve exports cua chunk.
   */
  function requireAsync(id: string): Promise<unknown> {
    const async = (requireFn as { async?: (id: string) => Promise<unknown> }).async;
    if (typeof async !== "function") return Promise.reject(new Error("ui-sidebar-documentpreview: require.async khong co tren bang module"));
    return async(id);
  }
}

/** Tai xuat de test doc duoc id nguoi ngoi cua ban xem van ban. */
export { basenameOf };
