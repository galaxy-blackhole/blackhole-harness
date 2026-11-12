/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sau ban xem dung san (van ban · Markdown · HTML · anh · PDF · ma nguon) — moi ban dang ky metadata va slot keyed cua no
 */

import { createCodeBody } from "./code/code-body.ts";
import { documentTabInfoFactory } from "./document/contract.ts";
import { createHtmlBody } from "./html/html-body.ts";
import { HTML_BODY_EXTENSIONS, HTML_BODY_ID, MARKDOWN_BODY_EXTENSIONS, MARKDOWN_BODY_ID, IMAGE_BODY_EXTENSIONS, BINARY_IMAGE_EXTENSIONS, IMAGE_BODY_ID, CODE_BODY_ID, LOADING_BYTES_COMPLETE, LOADING_TEXT_PAGES, NS, PDF_BODY_ID, PLAIN_BODY_ID, PRIORITY_BUILTIN } from "./ids.ts";
import { codeEn, codeZh, htmlEn, htmlZh, imageEn, imageZh, markdownEn, markdownZh, NS_CODE, NS_HTML, NS_IMAGE, NS_MARKDOWN, NS_PDF, pdfEn, pdfZh } from "./locales.ts";
import { createImageBody } from "./image/image-body.ts";
import { createLazyPdfBody } from "./pdf/lazy-pdf-body.ts";
import { createPdfStore } from "./pdf/store.ts";
import { createMarkdownBody } from "./markdown/markdown-body.ts";
import { retainDocumentTabs } from "./document/tab-lifetime.ts";
import type { DocumentPreviewRegistry } from "./document/registry.ts";
import type { LoadingIndicatorProps } from "./loading-indicator.ts";
import type { ClientContextLike, JsxRuntimeLike, ReactLike, StoreModuleLike } from "./types.ts";
import type { ZoomViewportLike } from "./image/image-body.ts";
import type { CodePrimitivesLike } from "./code/code-body.ts";
import type { MarkdownPrimitivesLike, LoadFrontmatterFields } from "./markdown/markdown-body.ts";
import type { LoadPdfBody } from "./pdf/lazy-pdf-body.ts";
import { viMarkdown, viHtml, viImage, viPdf, viCode } from "./locales-vi.ts";

/** Moi thu ma sau ban xem dung san can, do plugin dung san mot lan. */
export interface KindEnvironment {
  /** So ban xem tai lieu (dung chung cho moi ban). */
  previews: DocumentPreviewRegistry;
  /** jsx runtime cua trang. */
  runtime: JsxRuntimeLike;
  /** Hook cua react. */
  react: ReactLike;
  /** Bang module cua trang (lay defineStore). */
  storeModule: StoreModuleLike;
  /** Vong xoay dung chung. */
  LoadingIndicator: (props: LoadingIndicatorProps) => unknown;
  /** Khung nhin thu phong dung chung. */
  ZoomViewport: ZoomViewportLike;
  /** Lop be mat dung chung cua khung nhin thu phong. */
  zoomSurfaceClass: string;
  /** Primitive ma ban xem ma nguon dung. */
  codePrimitives: CodePrimitivesLike;
  /** Primitive ma ban xem Markdown dung. */
  markdownPrimitives: MarkdownPrimitivesLike;
  /** Ham nap chunk danh sach truong frontmatter. */
  loadFrontmatterFields: LoadFrontmatterFields;
  /** Ham nap chunk renderer PDF. */
  loadPdf: LoadPdfBody;
  /** Than van ban thuong (truong hop lui). */
  plainBody: unknown;
}

/**
 * Dang ky ban xem van ban thuong (truong hop lui) va than cua no.
 * Nhan: ctx — context goc phia client; env — moi thu dung san.
 * Tra: khong.
 */
export function applyTextKind(ctx: ClientContextLike, env: KindEnvironment): void {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => env.previews.register({ id: PLAIN_BODY_ID, extensions: [], priority: PRIORITY_BUILTIN, title: () => t("viewer.text"), loading: LOADING_TEXT_PAGES, wrap: true }));
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({ name: "sidebar.right.tab.document", key: PLAIN_BODY_ID }, env.plainBody)));
}

/**
 * Dang ky ban xem Markdown: tu dien rieng, metadata va than keyed.
 * Nhan: ctx — context goc phia client; env — moi thu dung san.
 * Tra: khong.
 */
export function applyMarkdownKind(ctx: ClientContextLike, env: KindEnvironment): void {
  const t = ctx.locale.bind(NS_MARKDOWN);
  ctx.effect(() => ctx.locale.register(NS_MARKDOWN, { vi: viMarkdown, zh: markdownZh, en: markdownEn }), "document-markdown: dictionaries");
  ctx.effect(() => env.previews.register({ id: MARKDOWN_BODY_ID, extensions: MARKDOWN_BODY_EXTENSIONS, priority: PRIORITY_BUILTIN, title: () => t("viewer.label"), loading: LOADING_TEXT_PAGES, wrap: false }), "document-markdown: metadata");
  const MarkdownBody = createMarkdownBody(env.runtime, env.react, env.markdownPrimitives, env.loadFrontmatterFields);
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({ name: "sidebar.right.tab.document", key: MARKDOWN_BODY_ID, locale: NS_MARKDOWN }, MarkdownBody)), "document-markdown: body");
}

/**
 * Dang ky ban xem HTML: tu dien, metadata va than keyed kem bo doc phu thuoc tuong doi.
 * Nhan: ctx — context goc phia client; env — moi thu dung san.
 * Tra: khong.
 */
export function applyHtmlKind(ctx: ClientContextLike, env: KindEnvironment): void {
  const t = ctx.locale.bind(NS_HTML);
  ctx.effect(() => ctx.locale.register(NS_HTML, { vi: viHtml, zh: htmlZh, en: htmlEn }));
  ctx.effect(() => env.previews.register({ id: HTML_BODY_ID, extensions: HTML_BODY_EXTENSIONS, priority: PRIORITY_BUILTIN, title: () => t("title"), loading: LOADING_BYTES_COMPLETE, wrap: false }));
  const HtmlBody = createHtmlBody(env.runtime, env.react, env.LoadingIndicator);
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
    name: "sidebar.right.tab.document",
    key: HTML_BODY_ID,
    locale: NS_HTML,
    inject: () => ({
      hooks: { interactivePreview: ctx.configForms.developerTools.enabled },
      readRelated: (address: string, relativePath: string, signal: AbortSignal) => {
        const parsed = hostFileOfLocal(address);
        return ctx.remote.workspaceFiles.readBytes(parsed.sessionId, relativePath, { baseFile: parsed.path }, signal);
      },
    }),
  }, HtmlBody)));
}

/**
 * Dang ky ban xem anh: tu dien, metadata va than keyed chia se store thu phong.
 * Nhan: ctx — context goc phia client; env — moi thu dung san.
 * Tra: khong.
 */
export function applyImageKind(ctx: ClientContextLike, env: KindEnvironment): void {
  const t = ctx.locale.bind(NS_IMAGE);
  ctx.effect(() => ctx.locale.register(NS_IMAGE, { vi: viImage, zh: imageZh, en: imageEn }), "document-image: dictionaries");
  ctx.effect(() => env.previews.register({ id: IMAGE_BODY_ID, extensions: IMAGE_BODY_EXTENSIONS, binaryExtensions: BINARY_IMAGE_EXTENSIONS, priority: PRIORITY_BUILTIN, title: () => t("title"), loading: LOADING_BYTES_COMPLETE, wrap: false }), "document-image: metadata");
  const store = createZoomStoreLocal(env.storeModule);
  const retainTab = retainDocumentTabs(ctx);
  const ImageBody = createImageBody(env.runtime, env.react, env.LoadingIndicator, env.ZoomViewport, env.zoomSurfaceClass);
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
    name: "sidebar.right.tab.document",
    key: IMAGE_BODY_ID,
    locale: NS_IMAGE,
    store,
    inject: (_sessionId: string, actions: { forget(tabId: string): void }) => ({
      retainTab: (tabId: string, signal: AbortSignal) => { retainTab(tabId, signal, actions.forget); },
    }),
  }, ImageBody)), "document-image: body");
}

/**
 * Dang ky ban xem PDF: metadata, store tuy chon xem va than treo.
 * Nhan: ctx — context goc phia client; env — moi thu dung san.
 * Tra: khong.
 */
export function applyPdfKind(ctx: ClientContextLike, env: KindEnvironment): void {
  ctx.effect(() => ctx.locale.register(NS_PDF, { vi: viPdf, zh: pdfZh, en: pdfEn }));
  const t = ctx.locale.bind(NS_PDF);
  ctx.effect(() => env.previews.register({ id: PDF_BODY_ID, extensions: ["pdf"], binaryExtensions: ["pdf"], priority: PRIORITY_BUILTIN, title: () => t("title"), loading: LOADING_BYTES_COMPLETE, wrap: false }));
  const presentation = pdfBodyRegistrationLocal(ctx, env);
  const LazyPdfBody = createLazyPdfBody(env.runtime, env.react, env.LoadingIndicator, env.loadPdf);
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
    name: "sidebar.right.tab.document",
    key: PDF_BODY_ID,
    locale: NS_PDF,
    ...presentation,
  }, LazyPdfBody)));
}

/**
 * Dang ky ban xem ma nguon: tu dien, metadata theo CODE_HIGHLIGHT_EXTENSIONS va than keyed.
 * Nhan: ctx — context goc phia client; env — moi thu dung san.
 * Tra: khong.
 */
export function applyCodeKind(ctx: ClientContextLike, env: KindEnvironment): void {
  ctx.effect(() => ctx.locale.register(NS_CODE, { vi: viCode, zh: codeZh, en: codeEn }));
  const t = ctx.locale.bind(NS_CODE);
  const extensions = env.codePrimitives.CODE_HIGHLIGHT_EXTENSIONS;
  ctx.effect(() => env.previews.register({ id: CODE_BODY_ID, extensions, priority: PRIORITY_BUILTIN, title: () => t("title"), loading: LOADING_TEXT_PAGES, wrap: true }));
  const CodeBody = createCodeBody(env.runtime, env.codePrimitives);
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({ name: "sidebar.right.tab.document", key: CODE_BODY_ID, locale: NS_CODE }, CodeBody)));
}

/**
 * Giu trang thai xem PDF theo vong doi tab va gom store + inject dung chung cho ca ban xem thuong lan ban xem Office.
 * Nhan: ctx — context dang ky so huu; env — moi thu dung san.
 * Tra: store va inject dung chung.
 */
export function pdfBodyRegistrationLocal(ctx: ClientContextLike, env: KindEnvironment): { store: unknown; inject: (sessionId: string, actions: { forget(tabId: string): void }) => Record<string, unknown> } {
  const store = createPdfStore(env.storeModule.defineStore);
  const retainTab = retainDocumentTabs(ctx);
  return {
    store,
    inject: (_sessionId, actions) => ({
      retainTab: (tabId: string, signal: AbortSignal) => { retainTab(tabId, signal, actions.forget); },
      ZoomViewport: env.ZoomViewport,
      zoomSurfaceClass: env.zoomSurfaceClass,
    }),
  };
}

/**
 * Khai store thu phong (u 2 dong de giu mot cho duy nhat).
 * Nhan: storeModule — bang module cua trang.
 * Tra: handle store.
 */
function createZoomStoreLocal(storeModule: StoreModuleLike): unknown {
  return storeModule.defineStore({
    init: () => ({ byTab: {} }),
    actions: {
      /** Ghi tuy chon thu phong cua mot tab. */
      zoom: (draft: { byTab: Record<string, unknown> }, tabId: string, preference: unknown): void => { draft.byTab[tabId] = preference; },
      /** Bo tuy chon thu phong cua mot tab da dong. */
      forget: (draft: { byTab: Record<string, unknown> }, tabId: string): void => { delete draft.byTab[tabId]; },
    },
  });
}

/**
 * Doc phien va duong dan tu dia chi tep — ban dia phuong de tranh vong import.
 * Nhan: address — dia chi gbh-resource://file/....
 * Tra: { sessionId, path }.
 */
function hostFileOfLocal(address: string): { sessionId: string; path: string } {
  // 18/10/2026 (task-29): nhận CẢ HAI scheme — địa chỉ cũ trong lịch sử phiên vẫn phải đọc được.
  const prefixes = ["gbh-resource://file/session/", "dsh-resource://file/session/"];
  const matched = prefixes.find((prefix) => address.startsWith(prefix));
  if (matched === undefined) throw new Error("khong phai dia chi file cua phien: " + address);
  const rest = address.slice(matched.length);
  const cut = rest.indexOf("/");
  return { sessionId: decodeURIComponent(rest.slice(0, cut)), path: rest.slice(cut + 1).split("/").map(decodeURIComponent).join("/") };
}

/** Kieu cua store module ma kinds dung — tai xuat cho plugin. */
export type { StoreModuleLike };
