/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Store cua ban xem van ban: trang da doc, vi tri cuon, che do ngat dong — tach theo tung tab
 */

import type { StoreModuleLike } from "./types.ts";
import type { RemoteFailureLike } from "./failure-line.ts";

/** Mot trang da luu trong store. */
export interface StoredPage {
  /** Van ban cua trang. */
  text: string;
  /** So dong cua trang. */
  lines: number;
}

/** Trang thai cua MOT tab truoc khi no doc, cuon, bat/tat hay tra loi gi. */
export interface TextTabState {
  /** Co tu doc lai khi tep doi khong. */
  autoRefresh: boolean;
  /** Co tai nguyen phu thuoc nao vua doi khong. */
  resourcesDirty: boolean;
  /** So lan nap — dung de bo qua ket qua cua lan nap cu. */
  loadRevision: number;
  /** Phien ban nguon dang hien. */
  version: number | undefined;
  /** Phien ban metadata quan sat duoc luc bat dau doc. */
  observedVersion: number | undefined;
  /** Cac trang da doc, khoa theo offset. */
  pages: Record<number, StoredPage>;
  /** Da doc het tep chua. */
  eof: boolean;
  /** Dang doc khong. */
  loading: boolean;
  /** Vi sao lan doc gan nhat hong. */
  failure: RemoteFailureLike | undefined;
  /** Vi tri cuon cua than tab (px). */
  scrollTop: number;
  /** Co ngat dong khong. */
  wrap: boolean;
  /** Diep khuc dieu huong da tra loi. */
  revision: unknown;
  /** Che do nap dang dung. */
  mode?: string;
  /** Ban cai dat do nguoi dung chon, neu co. */
  rendererId?: string;
  /** Ban cai dat so huu viec nap nguon. */
  contentRendererId?: string;
  /** Ket qua doc tron byte. */
  complete?: { data: Uint8Array; version: number; absolutePath: string };
}

/** Trang thai store cua kieu tab van ban (mot instance cho moi phien). */
export interface TextStoreState {
  /** Trang thai cua tung tab, khoa theo id tab. */
  byTab: Record<string, TextTabState>;
  /** Trieu chung cho trinh bien dich: kieu cua ban nhap. */
}

/**
 * Trang thai rong cua mot tab.
 * Nhan: khong.
 * Tra: bucket rong.
 */
function fresh(): TextTabState {
  return {
    autoRefresh: true,
    resourcesDirty: false,
    loadRevision: 0,
    version: undefined,
    observedVersion: undefined,
    pages: {},
    eof: false,
    loading: false,
    failure: undefined,
    scrollTop: 0,
    wrap: true,
    revision: undefined,
  };
}

/**
 * Bucket cua mot tab, tao o lan ghi dau tien.
 * Nhan: state — ban nhap; tabId — tab can lay.
 * Tra: bucket cua tab do.
 */
function bucket(state: TextStoreState, tabId: string): TextTabState {
  state.byTab[tabId] ??= fresh();
  return state.byTab[tabId];
}

/**
 * Khai store cua ban xem van ban.
 *
 * Dung MOT lan trong apply va chia se cho than tab lan cac dang ky cong cu — khung slot cho phep
 * vi ca hai deu theo pham vi phien.
 * Nhan: defineStore — ham cua bang module @galaxy-blackhole/gbh-client-store.
 * Tra: handle store de khai tren ca hai dang ky.
 */
export function createTextStore(defineStore: StoreModuleLike["defineStore"]): unknown {
  return defineStore({
    init: (): TextStoreState => ({ byTab: {} }),
    actions: {
      /** Bat/tat tu dong lam moi cua mot tab. */
      toggledAutoRefresh: (draft: TextStoreState, tabId: string): void => {
        const state = bucket(draft, tabId);
        state.autoRefresh = !state.autoRefresh;
      },
      /** Danh dau mot tai nguyen phu thuoc vua doi. */
      resourceChanged: (draft: TextStoreState, tabId: string): void => {
        bucket(draft, tabId).resourcesDirty = true;
      },
      /**
       * Ghi lua chon ban cai dat cua nguoi dung.
       * Nhan: draft — ban nhap; tabId — tab so huu; rendererId — lua chon thu cong, hoac undefined de tu chon.
       * Tra: khong.
       */
      selected: (draft: TextStoreState, tabId: string, rendererId: string | undefined): void => {
        if (rendererId === undefined) delete bucket(draft, tabId).rendererId;
        else bucket(draft, tabId).rendererId = rendererId;
      },
      /**
       * Danh dau mot lan doc trang la dang chay.
       * Nhan: draft — ban nhap; tabId — tab dang ve; mode — che do nap cua renderer da chon;
       *       observedVersion — phien ban metadata luc bat dau doc; contentRendererId — ban cai dat so huu viec nap nguon.
       * Tra: khong.
       */
      loading: (draft: TextStoreState, tabId: string, mode: string | undefined, observedVersion: number | undefined, contentRendererId?: string): void => {
        const state = bucket(draft, tabId);
        if (state.version === undefined && !state.loading) state.observedVersion = observedVersion;
        if (contentRendererId === undefined) delete state.contentRendererId;
        else state.contentRendererId = contentRendererId;
        state.loading = true;
        state.failure = undefined;
        if (mode !== undefined) state.mode = mode;
      },
      /**
       * Ghi ket qua mot lan ve cua renderer.
       * Nhan: draft — ban nhap; tabId — tab so huu; revision — diep khuc noi dung dang hoat dong; version — phien ban nguon dang hien.
       * Tra: khong.
       */
      rendered: (draft: TextStoreState, tabId: string, revision: number, version: number): void => {
        const state = draft.byTab[tabId];
        if (state?.mode !== "renderer" || state.loadRevision !== revision) return;
        state.version = version;
        state.loading = false;
      },
      /**
       * Ghi mot lan ve that bai cua renderer.
       * Nhan: draft — ban nhap; tabId — tab so huu; revision — diep khuc noi dung da hong.
       * Tra: khong.
       */
      rendererFailed: (draft: TextStoreState, tabId: string, revision: number): void => {
        const state = draft.byTab[tabId];
        if (state?.mode !== "renderer" || state.loadRevision !== revision) return;
        state.loading = false;
      },
      /**
       * Ghi ket qua doc tron byte.
       * Nhan: draft — ban nhap; tabId — tab so huu; file — ket qua byte day du.
       * Tra: khong.
       */
      complete: (draft: TextStoreState, tabId: string, file: { data: Uint8Array; version: number; absolutePath: string }): void => {
        const state = bucket(draft, tabId);
        state.complete = file;
        state.version = file.version;
        state.eof = true;
        state.loading = false;
        state.failure = undefined;
      },
      /**
       * Giu lai mot trang. Mot trang tu phien ban moi hon lam mat hieu luc cac trang cua phien ban cu,
       * nen than tab khong bao gio hien hai phien ban cung luc.
       * Nhan: draft — ban nhap; tabId — tab dang ve; page — trang Host tra ve.
       * Tra: khong.
       */
      page: (draft: TextStoreState, tabId: string, page: { offset: number; text: string; lines: number; eof: boolean; version: number }): void => {
        const state = bucket(draft, tabId);
        if (state.version !== undefined && state.version !== page.version) state.pages = {};
        state.version = page.version;
        state.pages[page.offset] = { text: page.text, lines: page.lines };
        state.eof = page.eof;
        state.loading = false;
        state.failure = undefined;
      },
      /**
       * Ghi vi sao mot lan doc trang hong; cac trang da giu van o lai.
       * Nhan: draft — ban nhap; tabId — tab dang ve; failure — loi Remote da settled.
       * Tra: khong.
       */
      failed: (draft: TextStoreState, tabId: string, failure: RemoteFailureLike): void => {
        const state = bucket(draft, tabId);
        state.loading = false;
        state.failure = failure;
      },
      /**
       * Bo moi trang, giu nguyen khung nhin, de doc lai tu dong dau.
       * Nhan: draft — ban nhap; tabId — tab dang ve.
       * Tra: khong.
       */
      reset: (draft: TextStoreState, tabId: string): void => {
        const state = bucket(draft, tabId);
        state.resourcesDirty = false;
        state.loadRevision++;
        state.pages = {};
        delete state.complete;
        state.eof = false;
        state.version = undefined;
        state.observedVersion = undefined;
        state.loading = false;
        state.failure = undefined;
      },
      /**
       * Ghi vi tri cuon cua than mot tab.
       * Nhan: draft — ban nhap; tabId — tab dang ve; scrollTop — do lech cuon (px).
       * Tra: khong.
       */
      scrolled: (draft: TextStoreState, tabId: string, scrollTop: number): void => {
        bucket(draft, tabId).scrollTop = scrollTop;
      },
      /**
       * Chuyen mot tab giua ngat dong va khong ngat dong.
       * Nhan: draft — ban nhap; tabId — tab dang ve.
       * Tra: khong.
       */
      toggledWrap: (draft: TextStoreState, tabId: string): void => {
        const state = bucket(draft, tabId);
        state.wrap = !state.wrap;
      },
      /**
       * Ghi rang than tab da tra loi mot lan dieu huong, de lan mount lai khoi nhay lai.
       * Nhan: draft — ban nhap; tabId — tab dang ve; revision — navigation.revision da tra loi.
       * Tra: khong.
       */
      navigated: (draft: TextStoreState, tabId: string, revision: unknown): void => {
        bucket(draft, tabId).revision = revision;
      },
      /**
       * Bo trang thai cua mot tab da bien mat.
       * Nhan: draft — ban nhap; tabId — tab da di.
       * Tra: khong.
       */
      forget: (draft: TextStoreState, tabId: string): void => {
        const byTab: Record<string, TextTabState> = {};
        for (const [id, state] of Object.entries(draft.byTab)) if (id !== tabId) byTab[id] = state;
        draft.byTab = byTab;
      },
    },
  });
}
