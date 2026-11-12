/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Byte anh day du duoc ve trong khung nhin thu phong dung chung
 */

import { imageBodyStyles as S } from "../class-names.ts";
import { clsx } from "../clsx.ts";
import type { LoadingIndicatorProps } from "../loading-indicator.ts";
import type { ZoomViewportProps } from "../zoom/viewport.ts";
import { hostFileOf } from "../rpc.ts";
import type { JsxRuntimeLike, ReactLike } from "../types.ts";
import { pathPartsOf } from "../workspace-path.ts";
import { DEFAULT_ZOOM, type createZoomStore } from "../zoom/store.ts";
import type { ZoomPreference } from "../zoom/types.ts";

/** Bang loai media theo hau to — nguyen van ban goc. */
export const IMAGE_MEDIA_TYPES: Readonly<Record<string, string>> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp", ico: "image/x-icon", svg: "image/svg+xml",
};

/** Nhan thu phong da dich. */
export interface ImageLabels {
  /** Nhan cua ca thanh. */
  controls: string;
  /** Nhan cua menu chon ti le. */
  menu: string;
  /** Nhan nut thu nho. */
  out: string;
  /** Nhan nut phong to. */
  into: string;
  /** Nhan nut vua rong. */
  fitWidth: string;
  /** Dinh dang mot ti le phan tram. */
  value(percent: number): string;
}

/** Props ma than anh nhan tu slot. */
export interface ImageBodyProps {
  /** Noi dung da doc. */
  content: { kind: string; data?: Uint8Array };
  /** Dia chi tai nguyen cua tai lieu. */
  resourceAddress: string;
  /** Bo doc thong tin tab. */
  useTabInfo: () => { tab: { id: string; signal: AbortSignal } };
  /** Bo doc tuy chon thu phong cua tab. */
  useStore: <T>(selector: (state: { byTab: Record<string, ZoomPreference> }) => T) => T;
  /** Hanh dong cua store thu phong. */
  actions: { zoom(tabId: string, preference: ZoomPreference): void };
  /** Giu trang thai khung nhin theo vong doi tab. */
  retainTab(tabId: string, signal: AbortSignal): void;
  /** Tra ve khung cuon cho chu so huu. */
  scrollportRef(node: HTMLElement | null): void;
  /** Ham dich cua namespace anh. */
  t: (key: string) => string;
}

/** Kieu cua khung nhin thu phong da dung — DUNG props that cua ZoomViewport (import kieu, khong vong runtime). */
export interface ZoomViewportLike {
  /** Ve khung nhin thu phong voi props cua no. */
  (props: ZoomViewportProps): unknown;
}

/** Kieu chu thich cua store thu phong (chi de tai lieu hoa). */
export type UnusedZoomStore = typeof createZoomStore;

/**
 * Giai mot ten tep da ho tro thanh loai media gan cho Blob cua no.
 * Nhan: path — duong dan tep workspace da giai ma.
 * Tra: loai media cua anh, hoac undefined voi hau to chua dang ky.
 */
export function imageMediaType(path: string): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  const name = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
  return IMAGE_MEDIA_TYPES[name.slice(name.lastIndexOf(".") + 1)];
}

/**
 * Dung than anh.
 * Nhan: runtime — jsx runtime; react — hook cua react; LoadingIndicator — vong xoay dung chung;
 *        ZoomViewport — khung nhin thu phong da dung; zoomSurfaceClass — lop be mat dung chung.
 * Tra: component nhan props cua slot.
 */
export function createImageBody(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  LoadingIndicator: (props: LoadingIndicatorProps) => unknown,
  ZoomViewport: ZoomViewportLike,
  zoomSurfaceClass: string,
): (props: ImageBodyProps) => unknown {
  const { jsx, jsxs } = runtime;
  const { useState, useEffect, useCallback, useMemo } = react;

  /** SVG o lai che do anh tinh cua trinh duyet vi byte cua no chi toi mot URL Blob cua the img. */
  function LoadedImage(props: {
    url: string;
    name: string;
    preference: ZoomPreference;
    onPreference(next: ZoomPreference): void;
    labels: ImageLabels;
    signal: AbortSignal;
    scrollportRef(node: HTMLElement | null): void;
    t: (key: string) => string;
  }): unknown {
    const [state, setState] = useState("loading");
    const [width, setWidth] = useState<number | undefined>(undefined);
    return jsx(ZoomViewport, {
      preference: props.preference,
      intrinsicWidth: width,
      horizontalInset: 24,
      labels: props.labels,
      signal: props.signal,
      scrollportRef: props.scrollportRef,
      onPreference: props.onPreference,
      children: jsxs("div", {
        className: S.frame,
        "data-image-preview": true,
        children: [
          state === "loading" && jsx(LoadingIndicator, { label: props.t("loading") }),
          state === "failed" && jsx("p", { className: S.status, role: "alert", children: props.t("failed") }),
          jsx("div", {
            className: S.surface + " " + zoomSurfaceClass,
            "data-document-zoom-surface": true,
            style: { "--document-zoom-width": String(width ?? 0) + "px" },
            hidden: state !== "ready",
            children: jsx("img", {
              className: S.image,
              src: props.url,
              alt: props.t("preview").replace("{name}", props.name),
              decoding: "async",
              draggable: false,
              referrerPolicy: "no-referrer",
              onLoad: (event: { currentTarget: { naturalWidth: number } }) => {
                setWidth(event.currentTarget.naturalWidth);
                setState("ready");
              },
              onError: () => { setState("failed"); },
            }),
          }),
        ],
      }),
    });
  }

  return function ImageBody(props: ImageBodyProps): unknown {
    const { content, resourceAddress, t } = props;
    const { tab } = props.useTabInfo();
    const preference = props.useStore((state) => state.byTab[tab.id] ?? DEFAULT_ZOOM);
    const path = useMemo(() => hostFileOf(resourceAddress).path, [resourceAddress]);
    const mediaType = imageMediaType(path);
    const data = content.kind === "bytes" ? content.data : undefined;
    const [source, setSource] = useState<{ kind: string; data?: Uint8Array; mediaType?: string; url?: string } | undefined>(undefined);
    const setPreference = useCallback((value: ZoomPreference) => { props.actions.zoom(tab.id, value); }, [props.actions, tab.id]);
    useEffect(() => { props.retainTab(tab.id, tab.signal); }, [props.retainTab, tab.id, tab.signal]);
    useEffect(() => {
      if (data === undefined || mediaType === undefined) return;
      let url: string | undefined;
      try {
        url = URL.createObjectURL(new Blob([data as BlobPart], { type: mediaType }));
        setSource({ kind: "ready", data, mediaType, url });
      } catch {
        setSource({ kind: "failed", data, mediaType });
      }
      return () => { if (url !== undefined) URL.revokeObjectURL(url); };
    }, [data, mediaType]);
    if (data === undefined || mediaType === undefined) return jsx("p", { className: S.status, role: "alert", children: t("unsupported") });
    if (source?.data !== data || source.mediaType !== mediaType) return jsx(LoadingIndicator, { label: t("loading") });
    if (source.kind === "failed") return jsx("p", { className: S.status, role: "alert", children: t("failed") });
    const { name } = pathPartsOf(path);
    const labels: ImageLabels = {
      controls: t("zoomControls"),
      menu: t("zoomMenu"),
      out: t("zoomOut"),
      into: t("zoomIn"),
      fitWidth: t("zoomFitWidth"),
      value: (percent: number) => t("zoomValue").replace("{percent}", String(percent)),
    };
    return jsx(LoadedImage, {
      url: source.url as string,
      name,
      preference,
      onPreference: setPreference,
      labels,
      signal: tab.signal,
      scrollportRef: props.scrollportRef,
      t,
    }, source.url);
  };
}
