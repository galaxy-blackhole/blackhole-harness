/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nam lenh ban phim cua row workspace + nguon yeu cau rieng cua trinh duyet — nguyen id/phim ban goc
 */

import { ext, type Dyn } from "./runtime.ts";

/**
 * Tao nguon yeu cau rieng cua trinh duyet, dung chung cho lenh ban phim va cac nut dieu khien.
 * Nhan: khong co.
 * Tra: store trang thai kem day du cac ham doi trang thai.
 */
export function createWorkspaceShortcutControls(): Dyn {
  const state = ext.store.createSnapshotStore({ searchRequest: 0, addRequested: false, directoryBusy: false, renameTarget: null });
  return {
    state,
    search: () => {
      state.set({ ...state.getSnapshot(), searchRequest: state.getSnapshot().searchRequest + 1 });
    },
    add: () => {
      state.set(state.getSnapshot().directoryBusy ? state.getSnapshot() : { ...state.getSnapshot(), addRequested: true });
    },
    closeAdd: () => {
      state.set({ ...state.getSnapshot(), addRequested: false });
    },
    directoryBusy: (busy: boolean) => {
      state.set({ ...state.getSnapshot(), directoryBusy: busy });
    },
    rename: (sessionId: string, currentTitle: string) => {
      state.set({ ...state.getSnapshot(), renameTarget: { sessionId, currentTitle } });
    },
    closeRename: () => {
      state.set({ ...state.getSnapshot(), renameTarget: null });
    },
  };
}

/**
 * Dang ky nam lenh dieu huong cua workspace tren chu so huu hien co.
 * Nhan: ctx — context co shortcuts/locale/sessions/layout; navigation — mo phien trong va fork; controls — nguon yeu cau cua trinh duyet; archiveSession — hanh dong luu tru dung chung; reportForkFailure — bao loi fork qua kenh thong bao.
 * Tra: khong co.
 */
export function installWorkspaceShortcuts(ctx: Dyn, navigation: Dyn, controls: Dyn, archiveSession: Dyn, reportForkFailure: Dyn): void {
  const t = ctx.locale.bind("workspace");
  const current = (): Dyn => Object.values(ctx.sessions.list.getSnapshot().byId as Record<string, Dyn>).find((row: Dyn) => (row.retainedBy.mainView ?? 0) > 0);
  const addReason = (): string | null => (ctx.slots.entries("sidebar.workspaces.directoryFlow").length === 0 ? t("shortcut.noPicker") : controls.state.getSnapshot().directoryBusy ? t("shortcut.directoryBusy") : null);
  const register = (id: string, label: () => string, aliases: string[], code: string, modifiers: string[], webModifiers: string[], resolve: (context: Dyn) => Dyn): void => {
    ctx.effect(
      () =>
        ctx.shortcuts.register({
          id,
          label,
          aliases,
          defaults: {
            "desktop:macos": { code, modifiers },
            "desktop:windows": { code, modifiers },
            "desktop:linux": { code, modifiers },
            "web:macos": { code, modifiers: webModifiers },
            "web:windows": { code, modifiers: webModifiers },
          },
          regions: ["page", "editable"],
          modals: [],
          resolve,
        }),
      "ui-workspace: shortcut " + id,
    );
  };
  register("session.new", () => t("session.new"), ["new session"], "KeyN", ["primary"], ["primary", "alt"], () => ({
    status: "handled",
    run: () => {
      navigation.startSession(undefined, { clearPreviousDraft: false });
    },
  }));
  register("session.search", () => t("search.sessions.aria"), ["search sessions"], "KeyK", ["primary"], ["primary", "alt"], () => ({ status: "handled", run: controls.search }));
  register("workspace.add", () => t("workspace.add"), ["add workspace", "open folder"], "KeyO", ["primary"], ["primary", "alt"], () => {
    const reason = addReason();
    return reason === null ? { status: "handled", run: controls.add } : { status: "blocked", reason };
  });
  register("session.rename", () => t("rename.session.title"), ["rename session"], "KeyG", ["primary", "alt"], ["primary", "alt"], (context: Dyn) => {
    const target = current();
    return target === undefined || target.blank || context.modal !== null || ctx.layout.panelInfo.getSnapshot().activePanelId !== null
      ? { status: "blocked", reason: t("shortcut.noSession") }
      : {
          status: "handled",
          run: () => {
            controls.rename(target.id, target.title?.trim() ?? "");
          },
        };
  });
  register("session.fork", () => t("menu.fork"), ["fork session"], "KeyF", ["primary", "alt"], ["primary", "shift"], () => {
    const target = current();
    if (target === undefined) return { status: "blocked", reason: t("shortcut.noSession") };
    if (target.blank) return { status: "blocked", reason: t("shortcut.noCompletedTurn") };
    return {
      status: "handled",
      run: () => {
        navigation.forkSession(target.id).catch((error: Dyn) => {
          const unavailable = error instanceof Error && error.name === "SessionForkError" && (error as Dyn).rpcError.code === "session/fork-unavailable";
          reportForkFailure(unavailable ? "unavailable" : "failed");
        });
      },
    };
  });
  register("session.archive", () => t("menu.archiveSession"), ["archive session"], "KeyA", ["primary", "shift"], ["primary", "alt"], () => {
    const target = current();
    return target === undefined
      ? { status: "blocked", reason: t("shortcut.noSession") }
      : {
          status: "handled",
          run: () => {
            archiveSession(target.id);
          },
        };
  });
}
