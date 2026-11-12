/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Than tab van ban: noi dung tep da doc, hoac ly do no khong hien — kem cong cu chon ban xem, ngat dong va doc lai
 */

import { clsx } from "./clsx.ts";
import { textPreviewStyles as S } from "./class-names.ts";
import { lastLineLoaded, loadedPages, scrollToLine, type LoadedPage } from "./document/lines.ts";
import { binaryDocumentPath, matchingDocumentPreviews, type DocumentPreviewDefinition } from "./document/registry.ts";
import { unviewableBinaryPath } from "./document/unviewable.ts";
import { emptyFailureRecourse, failureLine, type RemoteFailureLike, type Translate } from "./failure-line.ts";
import { PLAIN_BODY_ID } from "./ids.ts";
import type { LoadingIndicatorProps } from "./loading-indicator.ts";
import { hostFileOf, type HostFile } from "./rpc.ts";
import type { JsxRuntimeLike, ReactLike } from "./types.ts";
import { pathPartsOf } from "./workspace-path.ts";

/** Primitive cua DSH ma than tab van ban dung. */
export interface TextPreviewPrimitivesLike {
  /** Nhan duong dan. */
  PathLabel: unknown;
  /** Bieu tuong theo loai tep. */
  FileTypeIcon: unknown;
  /** Phan loai loai tep theo ten. */
  classifyFileType(name: string): string;
  /** Menu noi. */
  Menu: unknown;
  /** Chu thich noi. */
  Tooltip: unknown;
  /** Bieu tuong tat ngat dong. */
  IconNowrapFillRegular: unknown;
  /** Bieu tuong bat ngat dong. */
  IconWrapFillRegular: unknown;
  /** Bieu tuong tam dung tu dong lam moi. */
  IconPauseOutlineRegular: unknown;
  /** Bieu tuong bat tu dong lam moi. */
  IconPlayOutlineRegular: unknown;
  /** Bieu tuong doc lai. */
  IconRefreshOutlineRegular: unknown;
}

/** Trang thai cua mot tab ma than tab doc tu store. */
export interface TextPreviewTabState {
  /** Co tu doc lai khong. */
  autoRefresh: boolean;
  /** Co ngat dong khong. */
  wrap: boolean;
  /** Vi tri cuon (px). */
  scrollTop: number;
  /** Che do nap dang dung. */
  mode?: string;
  /** Ban cai dat do nguoi dung chon. */
  rendererId?: string;
  /** Ban cai dat so huu viec nap nguon. */
  contentRendererId?: string;
  /** Phien ban nguon dang hien. */
  version?: number;
  /** Phien ban metadata quan sat duoc. */
  observedVersion?: number;
  /** Cac trang da doc. */
  pages?: Record<number, { text: string; lines: number }>;
  /** Da doc het chua. */
  eof?: boolean;
  /** Dang doc khong. */
  loading?: boolean;
  /** Vi sao lan doc hong. */
  failure?: RemoteFailureLike;
  /** Co tai nguyen phu thuoc vua doi khong. */
  resourcesDirty?: boolean;
  /** Diep khuc dieu huong da tra loi. */
  revision?: unknown;
  /** So lan nap. */
  loadRevision?: number;
  /** Ket qua doc tron byte. */
  complete?: { data: Uint8Array; absolutePath?: string };
}

/** Props ma slot sidebar.right.pane.tab bom cho than tab van ban. */
export interface TextPreviewProps {
  /** Bo doc thong tin tab cua khung. */
  useTabInfo: () => { tab: {
    /** Id tab. */
    id: string;
    /** Dia chi noi dung. */
    contentId: string;
    /** Tieu de tab. */
    title: string;
    /** Tin hieu vong doi cua tab. */
    signal: AbortSignal;
    /** Trang thai dieu huong. */
    navigation: { revision: unknown; params?: Record<string, unknown> };
    /** Phim tat doc lai cua tab. */
    refreshShortcut?: { keys?: unknown; aria?: string };
    /** Hanh dong cua tab. */
    actions: { bindCommands(commands: Record<string, unknown>): unknown };
  } };
  /** Bo doc metadata cua mot tai nguyen. */
  useResource: (address: string) => { status: string; value?: { version?: number; absolutePath?: string }; failure?: RemoteFailureLike };
  /** Bo doc store cua kieu tab nay. */
  useStore: <T>(selector: (state: { byTab: Record<string, TextPreviewTabState> }) => T) => T;
  /** Hanh dong store da bind. */
  actions: {
    /** Ghi mot lan dieu huong da tra loi. */
    navigated(tabId: string, revision: unknown): void;
    /** Ghi vi tri cuon. */
    scrolled(tabId: string, scrollTop: number): void;
    /** Ghi ban cai dat nguoi dung chon. */
    selected(tabId: string, rendererId: string | undefined): void;
    /** Chuyen ngat dong. */
    toggledWrap(tabId: string): void;
    /** Chuyen tu dong lam moi. */
    toggledAutoRefresh(tabId: string): void;
    /** Ghi mot lan ve renderer that bai. */
    rendererFailed(tabId: string, revision: number): void;
    /** Ghi mot lan ve renderer thanh cong. */
    rendered(tabId: string, revision: number, version: number): void;
  };
  /** Doc mot trang nua. */
  loadPage(tabId: string, file: HostFile, offset: number, signal: AbortSignal, observedVersion: number | undefined): void;
  /** Doc lai tu trang dau. */
  reloadPages(tabId: string, file: HostFile, signal: AbortSignal, observedVersion: number | undefined): void;
  /** Doc tron byte. */
  loadAll(tabId: string, file: HostFile, signal: AbortSignal, observedVersion: number | undefined): void;
  /** Doc lai tron byte. */
  reloadAll(tabId: string, file: HostFile, signal: AbortSignal, observedVersion: number | undefined): void;
  /** Chuan bi mot renderer tu nap. */
  prepareRenderer(tabId: string, signal: AbortSignal, rendererId: string, observedVersion: number | undefined, reload?: boolean): void;
  /** Bo doc so ban xem tai lieu. */
  useDocumentPreviews: <T>(selector: (value: readonly DocumentPreviewDefinition[]) => T) => T;
  /** Ve mot slot con. */
  renderSlot(name: string, props: Record<string, unknown>, options?: Record<string, unknown>): unknown;
  /** Ham dich cua namespace sidebarDocumentPreview. */
  t: Translate;
  /** Theo doi them mot tai nguyen phu thuoc. */
  addResource(tabId: string, address: string, signal: AbortSignal): void;
  /** Dat lai tap tai nguyen phu thuoc. */
  setResources(tabId: string, addresses: readonly string[], signal: AbortSignal): void;
}

/** Noi dung da chuan bi de giao cho mot than tai lieu. */
type PreparedContent =
  | { kind: "renderer"; revision: number; reload: () => void; failed: () => void; loaded: (version: number) => void }
  | { kind: "bytes"; data: Uint8Array }
  | { kind: "text"; pages: LoadedPage[]; text: string; eof: boolean | undefined };

/**
 * Dung than tab van ban.
 * Nhan: runtime — jsx runtime cua trang; react — hook cua react; primitives — primitive cua DSH;
 *        LoadingIndicator — vong xoay dung chung.
 * Tra: component nhan props cua slot.
 */
export function createTextPreview(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  primitives: TextPreviewPrimitivesLike,
  LoadingIndicator: (props: LoadingIndicatorProps) => unknown,
): (props: TextPreviewProps) => unknown {
  const { jsx, jsxs } = runtime;
  const { useMemo, useCallback, useEffect, useRef, useState } = react;

  return function TextPreview(props: TextPreviewProps): unknown {
    const { t, actions, renderSlot } = props;
    const { tab } = props.useTabInfo();
    const { navigation, signal } = tab;
    const meta = props.useResource(tab.contentId);
    const canRead = meta.status !== "none";
    const file = useMemo(() => hostFileOf(tab.contentId), [tab.contentId]);
    const state = props.useStore((s) => s.byTab[tab.id]);
    const definitions = props.useDocumentPreviews((value) => value);
    const unviewable = useMemo(() => unviewableBinaryPath(file.path), [file.path]);
    const candidates = useMemo(() => {
      const matched = matchingDocumentPreviews(definitions, file.path);
      if (matched.length > 0 && binaryDocumentPath(definitions, file.path)) return matched;
      if (matched.length === 0 && unviewable) return matched;
      const fallback = definitions.find((definition) => definition.id === PLAIN_BODY_ID);
      return fallback === undefined ? matched : [...matched, fallback];
    }, [definitions, file.path, unviewable]);
    const selected = candidates.find((candidate) => candidate.id === state?.rendererId) ?? candidates[0];
    const mode = selected?.loading;
    const contentRendererId = mode === "renderer" ? selected?.id : undefined;
    const current = (state?.mode ?? "text-pages") === mode && state?.contentRendererId === contentRendererId ? state : undefined;
    const add = useCallback((address: string) => { props.addResource(tab.id, address, signal); }, [props.addResource, tab.id, signal]);
    const set = useCallback((addresses: readonly string[]) => { props.setResources(tab.id, [tab.contentId, ...addresses], signal); }, [props.setResources, tab.id, tab.contentId, signal]);
    useEffect(() => { set([]); }, [set, selected?.id]);
    const bodyRef = useRef<HTMLElement | null>(null);
    const scrollportRef = useRef<HTMLElement | null>(null);
    const storedScrollTopRef = useRef(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const absolutePath = meta.value?.absolutePath ?? current?.complete?.absolutePath;
    const displayPath = absolutePath ?? file.path;
    const fileOwner = absolutePath === undefined ? undefined : { absolutePath };
    const line = navigation.params !== undefined && "line" in navigation.params ? (navigation.params.line as number | undefined) : undefined;
    const pages = current?.pages;
    const loaded = useMemo(() => loadedPages(pages ?? {}), [pages]);
    const loadedThrough = lastLineLoaded(loaded);
    const hasContent = mode === "renderer" ? current?.version !== undefined : loaded.length > 0 || current?.complete !== undefined;
    storedScrollTopRef.current = state?.scrollTop ?? 0;
    const bindBody = useCallback((body: HTMLElement | null) => {
      const previous = bodyRef.current;
      bodyRef.current = body;
      if (scrollportRef.current === null || scrollportRef.current === previous) scrollportRef.current = body;
    }, []);
    const bindScrollport = useCallback((scrollport: HTMLElement | null) => {
      const next = scrollport ?? bodyRef.current;
      scrollportRef.current = next;
      if (next !== null) next.scrollTop = storedScrollTopRef.current;
    }, []);
    const started = current !== undefined;
    useEffect(() => {
      if (started || !canRead || mode === undefined || selected === undefined) return;
      if (mode === "text-pages") props.loadPage(tab.id, file, 1, signal, meta.value?.version);
      else if (mode === "bytes-complete") props.loadAll(tab.id, file, signal, meta.value?.version);
      else props.prepareRenderer(tab.id, signal, selected.id, meta.value?.version);
    }, [started, tab.id, file, signal, props.loadPage, props.loadAll, props.prepareRenderer, canRead, mode, selected, meta.value?.version]);
    useEffect(() => {
      const body = scrollportRef.current;
      if (hasContent && body !== null && state !== undefined) body.scrollTop = state.scrollTop;
    }, [hasContent, selected?.id]);
    useEffect(() => {
      const body = scrollportRef.current;
      if (current === undefined || body === null || current.revision === navigation.revision) return;
      if (line === undefined || mode !== "text-pages") {
        actions.navigated(tab.id, navigation.revision);
        return;
      }
      if (line > loadedThrough && !current.eof) {
        if (!current.loading && current.failure === undefined && canRead) props.loadPage(tab.id, file, loadedThrough + 1, signal, meta.value?.version);
        return;
      }
      if (!scrollToLine(body, line) && line <= loadedThrough) return;
      actions.navigated(tab.id, navigation.revision);
      actions.scrolled(tab.id, body.scrollTop);
    }, [navigation.revision, line, loadedThrough, current?.eof, current?.loading, current?.failure, started, selected?.id, mode, file, canRead, meta.value?.version]);
    const rendererReload = useCallback(() => {
      if (canRead && selected !== undefined) props.prepareRenderer(tab.id, signal, selected.id, meta.value?.version, true);
    }, [canRead, props.prepareRenderer, tab.id, signal, selected?.id, meta.value?.version]);
    const observedVersion = meta.value?.version;
    const changed = (current?.version !== undefined && observedVersion !== undefined && observedVersion !== current.version && observedVersion !== current.observedVersion) || state?.resourcesDirty === true;
    const reload = useCallback(() => {
      if (!canRead) return;
      if (mode === "text-pages") props.reloadPages(tab.id, file, signal, observedVersion);
      else if (mode === "bytes-complete") props.reloadAll(tab.id, file, signal, observedVersion);
      else rendererReload();
    }, [canRead, mode, props.reloadPages, props.reloadAll, rendererReload, tab.id, file, signal, observedVersion]);
    useEffect(() => tab.actions.bindCommands({ refresh: reload }), [tab.actions, reload]);
    useEffect(() => {
      if (state?.autoRefresh && changed && current !== undefined && !current.loading && meta.status === "live") reload();
    }, [state?.autoRefresh, changed, current?.loading, meta.status, reload]);
    const content: PreparedContent | undefined = useMemo(() => {
      if (mode === "renderer") {
        if (current === undefined) return undefined;
        const revision = current.loadRevision as number;
        return {
          kind: "renderer",
          revision,
          reload: rendererReload,
          failed: () => { actions.rendererFailed(tab.id, revision); },
          loaded: (version: number) => { actions.rendered(tab.id, revision, version); },
        };
      }
      if (mode === "bytes-complete") return current?.complete === undefined ? undefined : { kind: "bytes", data: current.complete.data };
      if (current === undefined || loaded.length === 0) return undefined;
      return {
        kind: "text",
        pages: loaded,
        text: loaded.filter((page) => page.lines > 0).map((page) => page.text).join("\n"),
        eof: current.eof,
      };
    }, [mode, loaded, current?.complete, current?.eof, current?.loadRevision, rendererReload, actions, tab.id]);

    if (selected === undefined && unviewable) {
      const { name: unsupportedName } = pathPartsOf(displayPath);
      return jsxs("div", {
        className: S.preview,
        "data-textpreview-state": "unsupported",
        "data-textpreview-url": tab.contentId,
        children: [
          jsxs("div", {
            className: S.header,
            children: [
              jsx(primitives.PathLabel, { path: displayPath, className: S.path, "data-textpreview-path": true }),
              fileOwner !== undefined && renderSlot("sidebar.right.tab.document.actions", fileOwner),
            ],
          }),
          jsx("div", {
            className: S.body,
            "data-textpreview-body": true,
            children: jsxs("div", {
              className: S.empty,
              "data-textpreview-unsupported": true,
              children: [
                jsx(primitives.FileTypeIcon, { kind: primitives.classifyFileType(unsupportedName), size: 36, className: S.emptyIcon }),
                jsx("p", { className: S.emptyLine, children: t("unsupportedFile") }),
                fileOwner !== undefined && renderSlot("sidebar.right.tab.document.unpreviewable", fileOwner),
              ],
            }),
          }),
        ],
      });
    }
    if (state === undefined || selected === undefined) {
      return jsx("div", {
        className: S.status,
        "data-textpreview-state": "loading",
        children: meta.status === "none"
          ? jsx("p", { className: S.statusLine, children: t("resourceUnavailable") })
          : jsx(LoadingIndicator, { label: t("loading") }),
      });
    }
    const next = loadedThrough + 1;
    const { name } = pathPartsOf(displayPath);
    const loadNext = (): void => {
      if (!canRead || current?.loading || current?.eof) return;
      props.loadPage(tab.id, file, next, signal, meta.value?.version);
    };
    return jsxs("div", {
      className: S.preview,
      "data-textpreview-state": "text",
      "data-textpreview-url": tab.contentId,
      "data-document-preview": selected.id,
      children: [
        meta.failure !== undefined && hasContent
          ? jsxs("p", {
            className: S.changed,
            "data-textpreview-meta-failed": meta.failure.code,
            children: [
              jsx("span", { children: failureLine(t, meta.failure) }),
              jsx("button", { type: "button", className: S.action, "data-textpreview-reload-now": true, onClick: reload, children: t("reloadNow") }),
            ],
          })
          : changed && jsxs("p", {
            className: S.changed,
            "data-textpreview-changed": true,
            children: [
              jsx("span", { children: t("changed") }),
              jsx("button", { type: "button", className: S.action, "data-textpreview-reload-now": true, onClick: reload, children: t("reloadNow") }),
            ],
          }),
        jsxs("div", {
          className: S.header,
          children: [
            jsx(primitives.PathLabel, { path: displayPath, className: S.path, "data-textpreview-path": true }),
            candidates.length > 1 && jsx(primitives.Menu, {
              open: menuOpen,
              anchor: jsx("button", {
                type: "button",
                className: clsx(S.tool, S.viewerTool),
                "aria-label": t("openWith"),
                title: selected.title(),
                "data-document-viewer-menu": true,
                onClick: () => { setMenuOpen((value) => !value); },
                children: selected.title(),
              }),
              items: candidates.map((candidate) => ({ id: candidate.id, label: candidate.title() })),
              selectedId: selected.id,
              onSelect: (id: string) => { actions.selected(tab.id, id); setMenuOpen(false); },
              onClose: () => { setMenuOpen(false); },
              align: "end",
              portal: true,
              dense: true,
            }),
            selected.wrap === true && jsx(primitives.Tooltip, {
              label: t(state.wrap ? "wrap.disable" : "wrap.enable"),
              side: "bottom",
              delayMs: 500,
              children: jsx("button", {
                type: "button",
                className: S.tool,
                "aria-pressed": state.wrap,
                "aria-label": t("wrap.aria"),
                "data-textpreview-tool": "wrap",
                onClick: () => { actions.toggledWrap(tab.id); },
                children: state.wrap ? jsx(primitives.IconNowrapFillRegular, {}) : jsx(primitives.IconWrapFillRegular, {}),
              }),
            }),
            content !== undefined && renderSlot("sidebar.right.tab.document.action", { content }, { entryKey: selected.id, hookContext: props.useTabInfo }),
            jsx("span", {
              hidden: true,
              children: jsx(primitives.Tooltip, {
                label: t(state.autoRefresh ? "autoRefresh.disable" : "autoRefresh.enable"),
                side: "bottom",
                delayMs: 500,
                children: jsx("button", {
                  type: "button",
                  className: S.tool,
                  "aria-label": t("autoRefresh"),
                  "aria-pressed": state.autoRefresh,
                  "data-textpreview-tool": "auto-refresh",
                  onClick: () => { actions.toggledAutoRefresh(tab.id); },
                  children: state.autoRefresh ? jsx(primitives.IconPauseOutlineRegular, {}) : jsx(primitives.IconPlayOutlineRegular, {}),
                }),
              }),
            }),
            jsx(primitives.Tooltip, {
              label: t("reload"),
              shortcutKeys: tab.refreshShortcut?.keys,
              side: "bottom",
              delayMs: 500,
              children: jsx("button", {
                type: "button",
                className: S.tool,
                "aria-label": t("reload"),
                "data-textpreview-tool": "reload",
                "aria-keyshortcuts": tab.refreshShortcut?.aria,
                onClick: reload,
                children: jsx(primitives.IconRefreshOutlineRegular, {}),
              }),
            }),
            fileOwner !== undefined && renderSlot("sidebar.right.tab.document.actions", fileOwner),
          ],
        }),
        jsxs("div", {
          ref: bindBody,
          className: clsx(S.body, state.wrap && S.wrap),
          "data-textpreview-body": true,
          "data-textpreview-wrap": state.wrap ? "" : undefined,
          onScrollCapture: (event: { target: unknown }) => {
            const body = scrollportRef.current;
            if (body === null) return;
            if (event.target !== body) return;
            actions.scrolled(tab.id, body.scrollTop);
            if (mode === "text-pages" && current?.failure === undefined && body.clientHeight > 0 && body.scrollTop + body.clientHeight >= body.scrollHeight - 1) loadNext();
          },
          children: [
            mode !== "renderer" && !hasContent && current?.failure === undefined && jsx(LoadingIndicator, { label: t("loading") }),
            content !== undefined && renderSlot("sidebar.right.tab.document", {
              resourceAddress: tab.contentId,
              content,
              wrap: state.wrap,
              scrollportRef: bindScrollport,
              addResource: add,
              setResources: set,
            }, {
              entryKey: selected.id,
              hookContext: props.useTabInfo,
              fallback: jsx("p", { className: S.statusLine, children: t("rendererUnavailable", { name: selected.title() }) }),
            }),
            current?.failure !== undefined && (hasContent
              ? jsxs("p", {
                className: S.statusLine,
                "data-textpreview-failed": current.failure.code,
                children: [
                  jsx("span", { children: failureLine(t, current.failure) }),
                  jsx("button", { type: "button", className: S.action, "data-textpreview-retry": true, onClick: loadNext, children: t("retry") }),
                ],
              })
              : jsxs("div", {
                className: S.empty,
                "data-textpreview-failed": current.failure.code,
                children: [
                  jsx(primitives.FileTypeIcon, { kind: primitives.classifyFileType(name), size: 36, className: S.emptyIcon }),
                  jsx("p", { className: S.emptyLine, children: failureLine(t, current.failure) }),
                  emptyFailureRecourse(current.failure) === "open" && fileOwner !== undefined && renderSlot("sidebar.right.tab.document.unpreviewable", fileOwner),
                  emptyFailureRecourse(current.failure) === "retry" && jsxs("button", {
                    type: "button",
                    className: S.retry,
                    "data-textpreview-retry": true,
                    onClick: reload,
                    children: [jsx(primitives.IconRefreshOutlineRegular, { size: 14 }), t("retry")],
                  }),
                ],
              })),
            mode === "text-pages" && current !== undefined && loaded.length > 0 && !current.eof && current.failure === undefined && jsx("button", {
              type: "button",
              className: S.more,
              disabled: current.loading,
              "data-textpreview-more": true,
              onClick: loadNext,
              children: current.loading ? jsx(LoadingIndicator, { inline: true, label: t("loading") }) : t("loadMore"),
            }),
          ],
        }),
      ],
    });
  };
}
