/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Office trinh bay ket qua chuyen doi da giu va canh bao font quanh ban xem PDF dung chung
 */

import { officeBodyStyles as S } from "../class-names.ts";
import { textPreviewStyles as TP } from "../class-names.ts";
import type { LoadingIndicatorProps } from "../loading-indicator.ts";
import { hostFileOf } from "../rpc.ts";
import type { JsxRuntimeLike, ReactLike } from "../types.ts";
import { pathPartsOf } from "../workspace-path.ts";
import type { OfficeTabView } from "./store.ts";

/** Primitive ma than Office dung. */
export interface OfficePrimitivesLike {
  /** Bieu tuong theo loai tep. */
  FileTypeIcon: unknown;
  /** Phan loai loai tep theo ten. */
  classifyFileType(name: string): string;
  /** Nut cua DSH. */
  Button: unknown;
}

/** Props ma than Office nhan tu slot. */
export interface OfficeBodyProps {
  /** Yeu cau nap cua renderer. */
  content: { kind: string; revision?: number; loaded?: (version: number) => void; failed?: () => void; reload?: () => void };
  /** Dia chi tai nguyen cua tai lieu. */
  resourceAddress: string;
  /** Bo doc thong tin tab. */
  useTabInfo: () => { tab: { id: string; signal: AbortSignal } };
  /** Bo doc store Office. */
  useStore: <T>(selector: (state: { byTab: Record<string, OfficeTabView> }) => T) => T;
  /** Ham doc chuyen doi da uy quyen. */
  load(tabId: string, revision: number, file: { sessionId: string; path: string }, signal: AbortSignal, loaded: (version: number) => void, failed: () => void): void;
  /** Giu trang thai theo vong doi tab. */
  retainTab(tabId: string, signal: AbortSignal): void;
  /** Ve mot slot con. */
  renderSlot(name: string, props: Record<string, unknown>, options: Record<string, unknown>): unknown;
  /** Co ngat dong khong. */
  wrap: boolean;
  /** Tra ve khung cuon cho chu so huu. */
  scrollportRef(node: HTMLElement | null): void;
  /** Theo doi them mot tai nguyen phu thuoc. */
  addResource(address: string): void;
  /** Dat lai tap tai nguyen phu thuoc. */
  setResources(addresses: readonly string[]): void;
  /** Bo doc thong tin tab de truyen xuong slot con. */
  useTabInfoFactory: unknown;
  /** Ham dich cua namespace Office. */
  t: (key: string) => string;
}

/**
 * Dung than Office.
 * Nhan: runtime — jsx runtime; react — hook cua react; primitives — primitive cua DSH;
 *        LoadingIndicator — vong xoay dung chung.
 * Tra: component nhan props cua slot.
 */
export function createOfficeBody(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  primitives: OfficePrimitivesLike,
  LoadingIndicator: (props: LoadingIndicatorProps) => unknown,
): (props: OfficeBodyProps) => unknown {
  const { jsx, jsxs } = runtime;
  const { useEffect } = react;
  const OFFICE_ID = "@galaxy-blackhole/gbh-client-ui-sidebar-documentpreview/office";
  return function OfficeBody(props: OfficeBodyProps): unknown {
    const { tab } = props.useTabInfo();
    const { load, retainTab, resourceAddress, t } = props;
    const request = props.content.kind === "renderer" ? props.content : undefined;
    const revision = request?.revision;
    const held = props.useStore((state) => state.byTab[tab.id]);
    const view = held?.revision === revision ? held : undefined;
    const settled = view?.file !== undefined || view?.failure !== undefined;
    useEffect(() => { retainTab(tab.id, tab.signal); }, [retainTab, tab.id, tab.signal]);
    useEffect(() => {
      if (request === undefined || settled || tab.signal.aborted) return;
      const controller = new AbortController();
      const signal = AbortSignal.any([controller.signal, tab.signal]);
      load(tab.id, request.revision as number, hostFileOf(resourceAddress), signal, request.loaded as (version: number) => void, request.failed as () => void);
      return () => { controller.abort(); };
    }, [revision, resourceAddress, tab.id, tab.signal, load, settled]);
    const file = view?.file;
    if (request === undefined) return null;
    if (view?.failure !== undefined) {
      const { name } = pathPartsOf(resourceAddress);
      return jsxs("div", {
        className: TP.empty,
        "data-textpreview-failed": view.failure.code,
        children: [
          jsx(primitives.FileTypeIcon, { kind: primitives.classifyFileType(name), size: 36 }),
          jsx("p", { className: TP.emptyLine, children: view.failure.message }),
          jsx(primitives.Button, { size: "sm", onClick: request.reload, children: t("retry") }),
        ],
      });
    }
    if (file === undefined) return jsx(LoadingIndicator, { label: t("loading") });
    return jsx("div", {
      className: S.body,
      children: props.renderSlot("sidebar.right.tab.document.office.pdf", {
        resourceAddress,
        content: { kind: "bytes", data: file.data },
        wrap: props.wrap,
        scrollportRef: props.scrollportRef,
        addResource: props.addResource,
        setResources: props.setResources,
      }, { entryKey: OFFICE_ID, hookContext: props.useTabInfo }),
    });
  };
}
