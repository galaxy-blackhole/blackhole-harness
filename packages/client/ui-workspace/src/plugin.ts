/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-workspace: tu dien, service uiWorkspace, sau slot nguyen van cua ban goc, cong chan cai hai lan, migration khoa persist dsh.*→gbh.*
 */

import { createAnimatedRowsComponents } from "./animated-rows.ts";
import { ANIMATED_ROWS_CSS, ROWS_CSS, WORKSPACEBROWSER_CSS, WORKSPACEPICKER_CSS } from "./css.ts";
import { FlatList, SearchResults } from "./flat-list.ts";
import { EFFECT, INJECT, NS, PACKAGE_NAME, SLOT_HERO_WORKSPACE, SLOT_SESSION_MENU_ITEM, SLOT_SESSION_ROW_ACTION, SLOT_SHELL_OVERLAY, SLOT_WORKSPACES, STYLE_TAGS } from "./ids.ts";
import { en, zh } from "./locales.ts";
import type { RequireFn } from "./plugin-types.ts";
import { bindRuntime, ext, type Dyn } from "./runtime.ts";
import { SessionTree } from "./session-tree.ts";
import { ArchiveSessionMenuItem, ArchiveSessionRowButton, ForkSessionMenuItem, PinSessionMenuItem, PinSessionRowButton, RenameSessionMenuItem, SessionArchiveConfirmDialog, SessionIdMenuItem, SessionRenameDialog } from "./session-actions.ts";
import { createUiWorkspaceServiceClass } from "./service.ts";
import { installWorkspaceShortcuts, createWorkspaceShortcutControls } from "./shortcuts.ts";
import { migratePersistKeys } from "./persist-migration.ts";
import { createWorkspaceViewStore, derive } from "./stores.ts";
import { RowActionToast, registerToasts } from "./toast.ts";
import { WorkspaceBrowser } from "./workspace-browser.ts";
import { WorkspacePicker } from "./workspace-picker.ts";
import { vi } from "./locales-vi.ts";

/**
 * Chen mot the style neu chua co (id the giu NGUYEN duong dan module cua ban goc de khong chen hai lan).
 * Nhan: tagId — id gan vao data-plugin-css; cssText — van ban CSS.
 * Tra: khong co.
 */
function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * Chen ca bon module CSS dung thu tu nhu ban goc (Rows, AnimatedRows, WorkspacePicker, WorkspaceBrowser).
 * Lop Qg_5Eq_exits nam trong AnimatedRows.module.css — nguyen van tung byte.
 * Nhan: khong co.
 * Tra: khong co.
 */
function injectStyles(): void {
  injectStyle(STYLE_TAGS.rows, ROWS_CSS);
  injectStyle(STYLE_TAGS.animatedRows, ANIMATED_ROWS_CSS);
  injectStyle(STYLE_TAGS.picker, WORKSPACEPICKER_CSS);
  injectStyle(STYLE_TAGS.browser, WORKSPACEBROWSER_CSS);
}

/** Mat plugin ma Loader nhan. */
export interface ClientPlugin {
  /** Ten package. */
  readonly name: string;
  /** Seam can co. */
  readonly inject: readonly string[];
  /** Than plugin. */
  apply: (ctx: Dyn) => void;
}

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (xem muc 2 cua recipe).
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service da dang ky.
let uiWorkspaceInstalled = false;

/**
 * Dung mat plugin cua row ui-workspace.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  bindRuntime(requireFn);
  injectStyles();
  const { AnimatedRows } = createAnimatedRowsComponents({ Component: ext.react.Component, createRef: ext.react.createRef });
  const UiWorkspaceService = createUiWorkspaceServiceClass();
  /**
   * Than plugin: tu dien, service uiWorkspace, va sau slot nguyen van cua ban goc (idempotent).
   * Nhan: ctx — context goc phia client.
   * Tra: khong co.
   */
  function apply(ctx: Dyn): void {
    if (uiWorkspaceInstalled) {
      console.warn("gbh-client-ui-workspace: bundle da duoc cai, bo qua lan thu hai");
      return;
    }
    try {
      applyInner(ctx);
      // ⚠️ 18/10/2026: CO CHI BAT SAU KHI applyInner CHAY XONG. Bat som ⇒ neu dang ky nem giua duong thi
      //   co da = true ⇒ lan cai thu hai thoat som ⇒ slot KHONG BAO GIO duoc dang ky lai ⇒ renderer gap
      //   undefined ⇒ React #130.
      uiWorkspaceInstalled = true;
    } catch (error) {
      console.error("gbh-client-ui-workspace: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }
  applyInnerImpl = applyInner;
  return { name: PACKAGE_NAME, inject: INJECT, apply };

  /**
   * Than cua apply: tu dien, service uiWorkspace, toast, va sau slot cua ban goc.
   * Nhan: ctx — context goc phia client.
   * Tra: khong co.
   */
  function applyInner(ctx: Dyn): void {
    const sessions = ctx.get("sessions");
    const workspaces = ctx.get("workspaces");
    // 18/10/2026 (task-30): MIGRATION MỘT LẦN khoá persist dsh.* → gbh.* TRƯỚC khi tạo store (store đọc
    //   localStorage trong constructor) — nếu chạy sau thì store đã đọc khoá mới (chưa có) và mất dữ liệu cũ.
    migratePersistKeys();
    const viewHandle = createWorkspaceViewStore();
    const viewInstance = viewHandle.create();
    const viewStore = { ...viewHandle, create: () => viewInstance };
    const rowToast = ext.store.createSnapshotStore(null);
    let toastSeq = 0;
    const notify = (toast: Dyn): void => {
      rowToast.set({ ...toast, seq: (toastSeq += 1) });
    };
    const uiWorkspace = new UiWorkspaceService(ctx, ctx.remote.directoryPicker, workspaces, sessions, viewInstance.actions, notify);
    ctx.slots.provideRoot({
      hooks: { workspaces: workspaces.list },
      keyedHooks: { workspaceAccess: (workspaceId: string, action: Dyn) => (action === undefined ? undefined : ctx.remoteAccess.source("workspace", workspaceId, action)) },
    });
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), EFFECT.dictionaries);
    const shortcutControls = createWorkspaceShortcutControls();
    const searchSessions = async (query: string, signal: AbortSignal): Promise<Dyn> => {
      const result = await sessions.search(query, signal);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    };
    const flowSource = (hole: string): Dyn => ({
      getSnapshot: () => ctx.slots.entries(hole).length > 0,
      subscribe: (listener: () => void) => ctx.slots.subscribe(hole, listener),
    });
    const browserFlowSource = flowSource("sidebar.workspaces.directoryFlow");
    const hostInfo = {
      getSnapshot: () => ctx.remote.$host,
      subscribe: (listener: () => void) => ctx.on("connection/reset", listener),
    };
    const pickerFlowSource = flowSource("conversation.hero.workspace.directoryFlow");
    const openSession = (sessionId: string): void => {
      uiWorkspace.openSession(sessionId);
    };
    const pinnedSet = derive(workspaces.list, (snapshot: Dyn) => new Set(snapshot.pinnedSessionIds));
    const archivedSet = derive(workspaces.list, (snapshot: Dyn) => new Set(snapshot.archivedSessionIds));
    const renameRequest = derive(shortcutControls.state, (state: Dyn) => state.renameTarget);
    const archiveRequest = ext.store.createSnapshotStore(null);
    const requestSessionRename = shortcutControls.rename;
    const unarchiveSession = (sessionId: string): void => {
      uiWorkspace.unarchiveSession(sessionId).catch((reason: unknown) => {
        console.warn("session unarchive rejected:", reason);
      });
    };
    const renameSession = async (sessionId: string, title: string): Promise<void> => {
      const result = await sessions.using(sessionId, { source: "workspaceOperation" }, (reference: Dyn) => reference.binding.session.rename(title));
      if (!result.ok) throw new Error(result.error.message);
    };
    const pinInjected = (): Dyn => ({
      hooks: { pinned: pinnedSet, archived: archivedSet },
      pinSession: (sessionId: string) => {
        uiWorkspace.pinSession(sessionId).catch(() => {
          notify({ kind: "pinFailed" });
        });
      },
      unpinSession: (sessionId: string) => {
        uiWorkspace.unpinSession(sessionId).catch(() => {
          notify({ kind: "unpinFailed" });
        });
      },
    });
    const archiveInjected = (): Dyn => ({
      hooks: { archived: archivedSet },
      archiveSession: (sessionId: string) => {
        uiWorkspace
          .archiveSession(sessionId)
          .then(() => {
            notify({ kind: "archived", sessionId });
          })
          .catch((reason: unknown) => {
            const activity = activeSessionRefusal(reason);
            if (activity === undefined) {
              console.warn("session archive rejected:", reason);
              return;
            }
            const displayTitle = sessions.list.getSnapshot().byId[sessionId]?.displayTitle ?? sessionId;
            archiveRequest.set({ sessionId, displayTitle, activity });
          });
      },
      unarchiveSession,
    });
    installWorkspaceShortcuts(ctx, uiWorkspace, shortcutControls, archiveInjected().archiveSession, (reason: string) => {
      notify({ kind: "shortcutForkFailed", reason });
    });
    const archiveConfirmInjected = (): Dyn => ({
      hooks: { archiveRequest },
      settleSessionArchive: () => {
        archiveRequest.set(null);
      },
      stopAndArchiveSession: async (sessionId: string) => {
        await uiWorkspace.archiveSession(sessionId, { stopActivity: true });
        notify({ kind: "stoppedAndArchived", sessionId });
      },
    });
    const forkInjected = (): Dyn => ({
      forkSession: (sessionId: string) => {
        uiWorkspace
          .forkSession(
            sessionId,
            (childId: string) => {
              ctx.get("productAnalytics")?.track("branch_session_click", { session_id: childId, parent_session_id: sessionId, click_position: "sidebar" });
            },
            { allowMigration: false },
          )
          .catch((error: Dyn) => {
            if (error instanceof Error && error.name === "SessionForkError" && (error as Dyn).rpcError.code === "session/migration-required") notify({ kind: "forkRequiresOpen", sessionId });
          });
      },
    });
    const sessionIdInjected = (): Dyn => ({
      copySessionId: async (sessionId: string) => {
        notify({ kind: (await ext.primitives.writeClipboard(sessionId)) ? "sessionIdCopied" : "sessionIdCopyFailed" });
      },
    });
    const renameInjected = (): Dyn => ({ requestSessionRename });
    const renameDialogInjected = (): Dyn => ({ hooks: { renameRequest }, settleSessionRename: shortcutControls.closeRename, renameSession });
    registerToasts(ctx, viewStore, {
      undoArchive: unarchiveSession,
      showArchived: () => {
        viewInstance.actions.setArchivedFilter("show");
      },
      openForkSource: (sessionId: string) => {
        if (workspaces.list.getSnapshot().archivedSessionIds.includes(sessionId)) {
          notify({ kind: "archivedNotOpenable" });
          return;
        }
        openSession(sessionId);
      },
    });
    const rowToastInjected = (): Dyn => ({
      hooks: { toast: rowToast },
      dismissToast: () => {
        rowToast.set(null);
      },
    });
    const browserInjected = (): Dyn => ({
      startSession: (workspaceId: string, options: Dyn) => {
        uiWorkspace.startSession(workspaceId, options);
      },
      open: openSession,
      searchSessions,
      searchResultLimit: sessions.searchResultLimit,
      requestSessionRename,
      notifyArchivedNotOpenable: () => {
        notify({ kind: "archivedNotOpenable" });
      },
      renameWorkspace: async (workspaceId: string, title: string) => {
        await workspaces.rename(workspaceId, title);
      },
      deleteWorkspace: async (workspaceId: string) => {
        await workspaces.delete(workspaceId);
      },
      insertWorkspaceBefore: async (workspaceId: string, beforeWorkspaceId: string | undefined) => {
        await workspaces.insertBefore(workspaceId, beforeWorkspaceId);
      },
      unarchiveSession: async (sessionId: string) => {
        await uiWorkspace.unarchiveSession(sessionId);
      },
      createWorkspace: (input: Dyn) => workspaces.create(input),
      requestSearch: shortcutControls.search,
      requestAddWorkspace: shortcutControls.add,
      closeAddWorkspace: shortcutControls.closeAdd,
      setDirectoryBusy: shortcutControls.directoryBusy,
      hooks: { directoryFlow: browserFlowSource, hostInfo, workspaceShortcuts: shortcutControls.state, shortcuts: shortcutCatalogSource(ctx) },
    });
    const pickerInjected = (): Dyn => ({ createWorkspace: (input: Dyn) => workspaces.create(input), hooks: { directoryFlow: pickerFlowSource } });
    const withBodies = (Base: Dyn, extras: Dyn): Dyn => {
      /**
       * Than slot: ghep phan chia cua chu so huu voi cac than rieng cua trinh duyet.
       * Nhan: props — props cua slot.
       * Tra: node than.
       */
      const Wrapped = (props: Dyn): Dyn => ext.jsxRuntime.jsx(Base, { ...props, ...extras });
      Wrapped.displayName = "WorkspaceSlotBody";
      return Wrapped;
    };
    const browserBodies = { AnimatedRows, SessionTree, FlatList, SearchResults };
    // ⚠️ TEN SLOT PHAI LA LITERAL trong register({ name: "..." }): check:rows chi nhan dang duoc khuon do.
    ctx.slots.inject(SLOT_WORKSPACES, () =>
      ctx.slots.register(
        {
          name: "sidebar.workspaces",
          children: {
            "sidebar.workspaces.directoryFlow": { kind: "single", scope: "root" },
            "sidebar.workspaces.session.menu.item": { kind: "list", scope: "root", inject: { hooks: { menuOpenState: menuOpenStateFactory, shortcuts: shortcutCatalogSource(ctx) } } },
            "sidebar.workspaces.session.row.action": { kind: "list", scope: "root" },
            "sidebar.session.row.leading": { kind: "list", scope: "root" },
            "sidebar.session.row.hover": { kind: "list", scope: "root" },
          },
          store: viewStore,
          inject: browserInjected,
          locale: NS,
        },
        withBodies(WorkspaceBrowser, browserBodies),
      ),
    );
    ctx.slots.inject(SLOT_SESSION_MENU_ITEM, function* () {
      // ⚠️ id NGUYEN VAN (literal) — khong truu tuong hoa qua hang so: check:rows va nguoi doc sau deu phai
      //   thay dung chuoi cua ban goc ngay tai cho dang ky (bai hoc tu ui-subagent: truu tuong hoa ten slot/id
      //   lam phep kiem bao THIEU).
      yield ctx.slots.register({ name: "sidebar.workspaces.session.menu.item", id: "pin", order: 100, locale: NS, inject: pinInjected }, PinSessionMenuItem);
      yield ctx.slots.register({ name: "sidebar.workspaces.session.menu.item", id: "rename", order: 200, locale: NS, inject: renameInjected }, RenameSessionMenuItem);
      yield ctx.slots.register({ name: "sidebar.workspaces.session.menu.item", id: "fork", order: 300, locale: NS, inject: forkInjected }, ForkSessionMenuItem);
      yield ctx.slots.register({ name: "sidebar.workspaces.session.menu.item", id: "archive", order: 400, locale: NS, inject: archiveInjected }, ArchiveSessionMenuItem);
      yield ctx.slots.register({ name: "sidebar.workspaces.session.menu.item", id: "session-id", order: 450, locale: NS, inject: sessionIdInjected }, SessionIdMenuItem);
    });
    ctx.slots.inject(SLOT_SESSION_ROW_ACTION, function* () {
      yield ctx.slots.register({ name: "sidebar.workspaces.session.row.action", id: "archive", order: 100, locale: NS, inject: archiveInjected }, ArchiveSessionRowButton);
      yield ctx.slots.register({ name: "sidebar.workspaces.session.row.action", id: "pin", order: 200, locale: NS, inject: pinInjected }, PinSessionRowButton);
    });
    ctx.slots.inject(SLOT_SHELL_OVERLAY, function* () {
      yield ctx.slots.register({ name: "shell.overlay", id: "workspace.session-rename", locale: NS, inject: renameDialogInjected }, SessionRenameDialog);
      yield ctx.slots.register({ name: "shell.overlay", id: "workspace.session-archive", locale: NS, inject: archiveConfirmInjected }, SessionArchiveConfirmDialog);
      yield ctx.slots.register({ name: "shell.overlay", id: "workspace.row-toast", inject: rowToastInjected, children: { "workspace.toast": { kind: "keyed", scope: "root" } } }, RowActionToast);
    });
    ctx.slots.inject(SLOT_HERO_WORKSPACE, () =>
      ctx.slots.register({ name: "conversation.hero.workspace", children: { "conversation.hero.workspace.directoryFlow": { kind: "single", scope: "root" } }, inject: pickerInjected, locale: NS }, WorkspacePicker),
    );
  }
}

/** Ham applyInner cua lan createPlugin gan nhat — giu de test goi thang than apply khi can. */
export let applyInnerImpl: ((ctx: Dyn) => void) | undefined;

/**
 * Boc danh muc lenh ban phim cua seam `shortcuts` thanh mot NGUON ANH CHUP an toan.
 *
 * ⚠️ 18/10/2026 (do that trong lab 5463): khung slot goi `bindSnapshotSelector(w)` ⇒ `w.getSnapshot()` cho
 * MOI gia tri trong `hooks`. Ban goc truyen thang `ctx.shortcuts.catalog` (dich vu stock phoi catalog la
 * mot store). Nua client cua ta cho row `shortcuts` KHONG phoi `catalog` ⇒ `w` la undefined ⇒
 * `TypeError: w.getSnapshot is not a function` ⇒ `slot entry crashed in 'sidebar.workspaces'` ⇒ ca thanh
 * ben khong render (#root 68.760 -> 37.727). O day ta tu bao ve: khong co catalog thi dung danh muc RONG,
 * UI van chay (chi mat goi y phim tat) thay vi sap ca vung duyet.
 * Nhan: ctx — context goc.
 * Tra: nguon anh chup cua danh muc lenh (that hoac rong).
 */
export function shortcutCatalogSource(ctx: Dyn): Dyn {
  const catalog = ctx.shortcuts?.catalog as Dyn;
  if (catalog !== undefined && typeof catalog.getSnapshot === "function") return catalog;
  console.warn("gbh-client-ui-workspace: seam shortcuts.catalog khong phai nguon anh chup — dung danh muc rong");
  return { getSnapshot: () => [] as Dyn[], subscribe: () => () => undefined };
}

/**
 * Nguoi ngoi menu chia se cap trang thai mo giua chu so huu va muc menu.
 * Nhan: _standard — props chuan cua khung (khong dung); state — cap trang thai mo cua lan render.
 * Tra: hook ma muc menu goi.
 */
export function menuOpenStateFactory(_standard: Dyn, state: Dyn): () => Dyn {
  return () => state;
}

/**
 * Hoat dong ma mot lan tu choi `workspace/session-active` bao ve, hoac undefined cho moi loi khac.
 * Nhan: reason — loi bat duoc.
 * Tra: mo ta hoat dong, hoac undefined.
 */
export function activeSessionRefusal(reason: unknown): Dyn {
  if (!(reason instanceof Error) || reason.name !== "WorkspaceArchiveError") return undefined;
  const rpcError = (reason as Dyn).rpcError;
  return rpcError.code === "workspace/session-active" ? rpcError.details.activity : undefined;
}
