/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc HTML tinh hoac tuong tac trong mot iframe goc mo duc, khong cham duoc vao ung dung cha
 */

import { htmlBodyStyles as S } from "../class-names.ts";
import { injectStyle } from "../css-inject.ts";
import { createBasicHtmlDocument } from "./basic-document.ts";
import { createHtmlDocument, type HtmlBundle } from "./bootstrap.ts";
import { packHtml } from "./pack.ts";
import { createReadHtmlRelative } from "./read-relative.ts";
import { CSS_TAGS } from "../css-registry.ts";
import { INJECTED_CSS } from "../css-inject.ts";
import type { LoadingIndicatorProps } from "../loading-indicator.ts";
import type { JsxRuntimeLike, ReactLike } from "../types.ts";
import type { RelativeReadResult } from "./pack.ts";

/** Props ma than HTML nhan tu slot. */
export interface HtmlBodyProps {
  /** Noi dung da doc. */
  content: { kind: string; data?: Uint8Array };
  /** Dia chi tai nguyen cua tai lieu. */
  resourceAddress: string;
  /** Bo doc phu thuoc tuong doi (do plugin bom qua inject). */
  readRelated: (address: string, relativePath: string, signal: AbortSignal) => Promise<RelativeReadResult>;
  /** Bo doc thong tin tab. */
  useTabInfo: () => { tab: { id: string; signal: AbortSignal } };
  /** Bo doc cong tac xem tuong tac. */
  useInteractivePreview: <T>(selector: (value: boolean) => T) => T;
  /** Theo doi them mot tai nguyen phu thuoc. */
  addResource(address: string): void;
  /** Dat lai tap tai nguyen phu thuoc. */
  setResources(addresses: readonly string[]): void;
  /** Ham dich cua namespace HTML. */
  t: (key: string) => string;
}

/**
 * Dung than HTML.
 * Nhan: runtime — jsx runtime; react — hook cua react; LoadingIndicator — vong xoay dung chung.
 * Tra: component nhan props cua slot.
 */
export function createHtmlBody(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  LoadingIndicator: (props: LoadingIndicatorProps) => unknown,
): (props: HtmlBodyProps) => unknown {
  const { jsx } = runtime;
  const { useState, useEffect, useMemo } = react;

  /** Mot tep da gan so huu mot Blob goc; doi noi dung la doi luon ngu canh duyet. */
  function HtmlFrame(props: {
    data: Uint8Array;
    resourceAddress: string;
    readRelated: HtmlBodyProps["readRelated"];
    addResource(address: string): void;
    setResources(addresses: readonly string[]): void;
    signal: AbortSignal;
    frameName: string;
    t: (key: string) => string;
  }): unknown {
    const [frame, setFrame] = useState<{ data: Uint8Array; readRelated: HtmlBodyProps["readRelated"]; url?: string } | undefined>(undefined);
    useEffect(() => {
      const controller = new AbortController();
      const resources = new Set<string>();
      const readRelative = createReadHtmlRelative(props.readRelated, props.resourceAddress, props.signal, (address) => {
        resources.add(address);
        props.addResource(address);
      });
      let url: string | undefined;
      void (async () => {
        try {
          const bundle: HtmlBundle = await packHtml(props.data, readRelative, controller.signal);
          controller.signal.throwIfAborted();
          const html = createHtmlDocument(bundle);
          url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
          setFrame({ data: props.data, readRelated: props.readRelated, url });
        } catch {
          if (!controller.signal.aborted) setFrame({ data: props.data, readRelated: props.readRelated, url: undefined });
        } finally {
          if (!controller.signal.aborted && !props.signal.aborted) props.setResources([...resources]);
        }
      })();
      return () => {
        controller.abort();
        if (url !== undefined) URL.revokeObjectURL(url);
      };
    }, [props.data, props.readRelated, props.resourceAddress, props.addResource, props.setResources, props.signal]);
    if (frame?.data !== props.data || frame.readRelated !== props.readRelated) return jsx(LoadingIndicator, { label: props.t("loading") });
    if (frame.url === undefined) return jsx("p", { className: S.status, role: "alert", children: props.t("failed") });
    return jsx("iframe", {
      name: props.frameName,
      className: S.frame,
      src: frame.url,
      sandbox: "allow-scripts",
      title: props.t("frame"),
      "data-html-preview": true,
    }, frame.url);
  }

  /** Ban xem tinh mount mot ngu canh duyet rieng de doi che do la nghi huu script dang chay. */
  function BasicHtmlFrame({ data, frameName, t }: { data: Uint8Array; frameName: string; t: (key: string) => string }): unknown {
    const html = useMemo(() => {
      try {
        return createBasicHtmlDocument(data);
      } catch {
        return undefined;
      }
    }, [data]);
    if (html === undefined) return jsx("p", { className: S.status, role: "alert", children: t("failed") });
    return jsx("iframe", {
      name: frameName,
      className: S.frame,
      srcDoc: html,
      sandbox: "",
      title: t("frame"),
      "data-html-preview": true,
    });
  }

  return function HtmlBody(props: HtmlBodyProps): unknown {
    const interactivePreview = props.useInteractivePreview((value) => value);
    const { tab } = props.useTabInfo();
    useEffect(() => {
      if (!interactivePreview) props.setResources([]);
    }, [interactivePreview, props.setResources]);
    if (props.content.kind !== "bytes") return null;
    const frameName = "dsh-sidebar-html-" + tab.id;
    if (!interactivePreview) return jsx(BasicHtmlFrame, { data: props.content.data as Uint8Array, frameName, t: props.t });
    return jsx(HtmlFrame, {
      data: props.content.data as Uint8Array,
      resourceAddress: props.resourceAddress,
      readRelated: props.readRelated,
      signal: tab.signal,
      frameName,
      addResource: props.addResource,
      setResources: props.setResources,
      t: props.t,
    }, props.resourceAddress);
  };
}

/**
 * Bao dam CSS cua HtmlBody da co trong trang truoc khi than HTML ve.
 * Nhan: khong.
 * Tra: khong.
 */
export function ensureHtmlBodyCss(): void {
  injectStyle(CSS_TAGS.HtmlBody as string, INJECTED_CSS.HtmlBody as string);
}
