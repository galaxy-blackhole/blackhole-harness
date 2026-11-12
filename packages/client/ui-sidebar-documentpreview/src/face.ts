/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat cua ban xem: noi viec doc trang / doc byte vao Remote, va gom trang thai ve store theo tab
 */

import { ResourceGroup } from "./document/resource-group.ts";
import type { RemoteFailureLike } from "./failure-line.ts";
import type { HostFile } from "./rpc.ts";
import type { RemoteResultLike } from "./types.ts";

/** Mot lan doc mot trang van ban. */
export type ReadPage = (sessionId: string, path: string, offset: number, signal: AbortSignal) => Promise<RemoteResultLike<{ offset: number; text: string; lines: number; eof: boolean; version: number }>>;

/** Mot lan doc tron byte cua mot tep workspace. */
export type ReadAllBytes = (file: HostFile, signal: AbortSignal) => Promise<RemoteResultLike<{ data: Uint8Array; version: number; absolutePath: string }>>;

/** Nguon metadata dung chung ma nhom tai nguyen doc. */
export interface ResourcesLike {
  /** Nguon cua mot dia chi. */
  source(address: string): { getSnapshot(): { status: string; value?: { version?: unknown; absolutePath?: string }; failure?: { code?: string } }; subscribe(listener: () => void): () => void };
}

/** Hanh dong cua store ma mat ban xem goi (da bind, khong con tham so ban nhap). */
export interface FaceActionsLike {
  /** Bat/tat tu dong lam moi cua mot tab. */
  toggledAutoRefresh(tabId: string): void;
  /** Danh dau mot tai nguyen phu thuoc vua doi. */
  resourceChanged(tabId: string): void;
  /** Ghi lua chon ban cai dat cua nguoi dung. */
  selected(tabId: string, rendererId: string | undefined): void;
  /** Danh dau mot lan doc dang chay. */
  loading(tabId: string, mode: string | undefined, observedVersion: number | undefined, contentRendererId?: string): void;
  /** Ghi ket qua mot lan ve cua renderer. */
  rendered(tabId: string, revision: number, version: number): void;
  /** Ghi mot lan ve that bai cua renderer. */
  rendererFailed(tabId: string, revision: number): void;
  /** Ghi ket qua doc tron byte. */
  complete(tabId: string, file: { data: Uint8Array; version: number; absolutePath: string }): void;
  /** Giu lai mot trang. */
  page(tabId: string, page: { offset: number; text: string; lines: number; eof: boolean; version: number }): void;
  /** Ghi vi sao mot lan doc hong. */
  failed(tabId: string, failure: RemoteFailureLike): void;
  /** Bo moi trang de doc lai tu dau. */
  reset(tabId: string): void;
  /** Ghi vi tri cuon cua than mot tab. */
  scrolled(tabId: string, scrollTop: number): void;
  /** Chuyen mot tab giua ngat dong va khong ngat dong. */
  toggledWrap(tabId: string): void;
  /** Ghi rang than tab da tra loi mot lan dieu huong. */
  navigated(tabId: string, revision: unknown): void;
  /** Bo trang thai cua mot tab da bien mat. */
  forget(tabId: string): void;
}

/** Mat ma cho ngoi sidebar.right.pane.tab nhan qua inject. */
export interface TextFaceLike {
  /** Theo doi them mot tai nguyen phu thuoc. */
  addResource(tabId: string, address: string, signal: AbortSignal): void;
  /** Dat lai tap tai nguyen phu thuoc cua tai lieu hien tai. */
  setResources(tabId: string, addresses: readonly string[], signal: AbortSignal): void;
  /** Doc mot trang nua. */
  loadPage(tabId: string, file: HostFile, offset: number, signal: AbortSignal, observedVersion: number | undefined): void;
  /** Doc lai tu trang dau. */
  reloadPages(tabId: string, file: HostFile, signal: AbortSignal, observedVersion: number | undefined): void;
  /** Doc tron byte. */
  loadAll(tabId: string, file: HostFile, signal: AbortSignal, observedVersion: number | undefined): void;
  /** Chuan bi cho mot renderer tu nap. */
  prepareRenderer(tabId: string, signal: AbortSignal, rendererId: string, observedVersion: number | undefined, reload?: boolean): void;
  /** Doc lai tron byte. */
  reloadAll(tabId: string, file: HostFile, signal: AbortSignal, observedVersion: number | undefined): void;
}

/** Trang thai doc rieng cua mot tab. */
interface TabReads {
  /** The he — ket qua cua the he cu bi bo qua. */
  generation: number;
  /** Phien ban nguon dang giu. */
  version: number | undefined;
  /** Che do nap dang dung. */
  mode: string;
  /** Ban cai dat so huu viec nap nguon, neu co. */
  rendererId?: string;
  /** Bo huy cua lan doc tron byte dang chay. */
  controller?: AbortController;
  /** Nhom tai nguyen phu thuoc cua tab nay. */
  group: ResourceGroup;
}

/**
 * Noi mat cua ban xem vao mot lan doc theo trang va mot lan doc tron byte.
 * Nhan: read — loi goi workspaceFiles.read da bind; readAll — loi goi doc byte day du; resources — nguon metadata dung chung.
 * Tra: factory inject cua slot: actions da bind vao, mat ra. Session id cua slot khong dung vi dia chi da mang theo no.
 */
export function textFace(read: ReadPage, readAll: ReadAllBytes, resources: ResourcesLike): (sessionId: string, actions: FaceActionsLike) => TextFaceLike {
  return (_sessionId: string, actions: FaceActionsLike): TextFaceLike => {
    const tabs = new Map<string, TabReads>();
    const readsOf = (tabId: string, signal: AbortSignal): TabReads => {
      const held = tabs.get(tabId);
      if (held !== undefined) return held;
      const created: TabReads = {
        generation: 0,
        version: undefined,
        mode: "text-pages",
        group: new ResourceGroup(resources, () => { actions.resourceChanged(tabId); }),
      };
      tabs.set(tabId, created);
      signal.addEventListener("abort", () => {
        created.controller?.abort();
        created.group.close();
        tabs.delete(tabId);
        actions.forget(tabId);
      }, { once: true });
      return created;
    };
    const modeOf = (tabId: string, signal: AbortSignal, mode: string, rendererId?: string): TabReads => {
      const reads = readsOf(tabId, signal);
      if (reads.mode !== mode || reads.rendererId !== rendererId) {
        reads.controller?.abort();
        if (rendererId === undefined) delete reads.rendererId;
        else reads.rendererId = rendererId;
        reads.mode = mode;
        reads.generation++;
        reads.version = undefined;
        actions.reset(tabId);
      }
      return reads;
    };
    const loadPage = (tabId: string, file: HostFile, offset: number, signal: AbortSignal, observedVersion: number | undefined): void => {
      if (signal.aborted) return;
      const reads = modeOf(tabId, signal, "text-pages");
      const { generation } = reads;
      actions.loading(tabId, "text-pages", observedVersion);
      void read(file.sessionId, file.path, offset, signal).then((result) => {
        if (signal.aborted || reads.generation !== generation) return;
        if (!result.ok) {
          actions.failed(tabId, result.error);
          return;
        }
        if (offset !== 1 && reads.version !== undefined && result.value.version !== reads.version) {
          restart(tabId, file, signal, observedVersion);
          return;
        }
        reads.version = result.value.version;
        actions.page(tabId, result.value);
      });
    };
    const loadAll = (tabId: string, file: HostFile, signal: AbortSignal, observedVersion: number | undefined): void => {
      if (signal.aborted) return;
      const reads = modeOf(tabId, signal, "bytes-complete");
      reads.controller?.abort();
      const controller = new AbortController();
      reads.controller = controller;
      const lifetime = AbortSignal.any([signal, controller.signal]);
      actions.loading(tabId, "bytes-complete", observedVersion);
      void readAll(file, lifetime).then((result) => {
        if (lifetime.aborted) return;
        if (!result.ok) {
          actions.failed(tabId, result.error);
          return;
        }
        reads.version = result.value.version;
        actions.complete(tabId, result.value);
      }, (error: unknown) => {
        if (lifetime.aborted) return;
        const cause = error instanceof Error ? error.message : String(error);
        actions.failed(tabId, { code: "gateway/internal", message: cause });
      });
    };
    const restart = (tabId: string, file: HostFile, signal: AbortSignal, observedVersion: number | undefined, mode = "text-pages"): void => {
      if (signal.aborted) return;
      const reads = readsOf(tabId, signal);
      reads.controller?.abort();
      reads.generation += 1;
      reads.version = undefined;
      actions.reset(tabId);
      if (mode === "text-pages") loadPage(tabId, file, 1, signal, observedVersion);
      else loadAll(tabId, file, signal, observedVersion);
    };
    return {
      addResource: (tabId, address, signal) => {
        if (!signal.aborted) readsOf(tabId, signal).group.add(address);
      },
      setResources: (tabId, addresses, signal) => {
        if (!signal.aborted) readsOf(tabId, signal).group.set(addresses);
      },
      loadPage,
      reloadPages: restart,
      loadAll,
      prepareRenderer: (tabId, signal, rendererId, observedVersion, reload = false) => {
        if (signal.aborted) return;
        modeOf(tabId, signal, "renderer", rendererId);
        if (reload) actions.reset(tabId);
        actions.loading(tabId, "renderer", observedVersion, rendererId);
      },
      reloadAll: (tabId, file, signal, observedVersion) => {
        restart(tabId, file, signal, observedVersion, "bytes-complete");
      },
    };
  };
}

/** Doc mot trang van ban tu Remote cua trang. */
export type CreateReadPage = (remote: { workspaceFiles: { read(sessionId: string, path: string, options: { offset: number }, signal: AbortSignal): Promise<RemoteResultLike<{ offset: number; text: string; lines: number; eof: boolean; version: number }>> } }) => ReadPage;

/**
 * Bind viec doc theo trang vao mot mat Remote. Do dai trang la muc tran Host da cau hinh, nen khong gui limit.
 * Nhan: remote — Remote cua Client mang namespace workspaceFiles.
 * Tra: phep doc ma mat thuc hien.
 */
export const createReadPage: CreateReadPage = (remote) => (sessionId, path, offset, signal) => remote.workspaceFiles.read(sessionId, path, { offset }, signal);
