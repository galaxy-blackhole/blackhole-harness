/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nam muc menu "..." + hai nut tren dong + hai hop thoai cua mot phien — port LAI TUNG DONG theo ban goc
 */

import { rowsStyles, workspaceBrowserStyles } from "./css.ts";
import { TOOLTIP_DELAY_MS } from "./ids.ts";
import { ext, fragment, h, hs, type Dyn } from "./runtime.ts";

/**
 * Trang thai ghim/luu tru cua mot dong, moi thu mot lan tra cuu Tap.
 *
 * ⚠️ 18/10/2026 — SUA LOI MAT NOI DUNG AM THAM: ban truoc viet usePinned((v) => v) nen hook tra ve
 * CA TAP (luon truthy) thay vi mot boolean. Hau qua: archived luon dung ⇒ PinSessionMenuItem va
 * PinSessionRowButton LUON tra null (mat nut ghim tren MOI dong) va muc "luu tru" luon hien nhan
 * "bo luu tru". Ban goc tra cuu bang .has(sessionId) — port nguyen van.
 * Nhan: props — { sessionId, usePinned, useArchived }.
 * Tra: { pinned, archived } — hai boolean cua rieng dong nay.
 */
export function usePinState(props: Dyn): Dyn {
  const { sessionId, usePinned, useArchived } = props;
  return {
    pinned: usePinned((pinned: Dyn) => pinned.has(sessionId)),
    archived: useArchived((archived: Dyn) => archived.has(sessionId)),
  };
}

/**
 * Mot muc menu "ghim / bo ghim" cua mot phien (slot sidebar.workspaces.session.menu.item, id "pin", order 100).
 * Nhan: props.sessionId — phien; props.usePinned/useArchived — hook dang ky; props.useMenuOpenState — cap trang thai mo menu; props.pinSession/unpinSession — hanh dong; props.t — ham dich.
 * Tra: node MenuItemButton, hoac null khi dong da luu tru (ban goc: ghim va luu tru loai tru nhau).
 */
export function PinSessionMenuItem(props: Dyn): Dyn {
  const { sessionId, useMenuOpenState, pinSession, unpinSession, t } = props;
  const [, setMenuOpen] = useMenuOpenState();
  const { pinned, archived } = usePinState(props);
  if (archived) return null;
  return h(ext.primitives.MenuItemButton, {
    icon: pinned ? h(ext.primitives.IconPinFillRegular, {}) : h(ext.primitives.IconPinOutlineRegular, {}),
    onSelect: () => {
      setMenuOpen(false);
      if (pinned) unpinSession(sessionId);
      else pinSession(sessionId);
    },
    children: t(pinned ? "menu.unpinSession" : "menu.pinSession"),
  });
}

/**
 * Mot muc menu "doi ten" cua mot phien (slot sidebar.workspaces.session.menu.item, id "rename", order 200).
 * Nhan: props.sessionId — phien; props.displayTitle — tieu de hien tai; props.useMenuOpenState — cap trang thai mo menu; props.useShortcuts — danh muc phim tat; props.requestSessionRename — mo hop thoai doi ten; props.t — ham dich.
 * Tra: node MenuItemButton.
 */
export function RenameSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, useShortcuts, requestSessionRename, t }: Dyn): Dyn {
  const [, setMenuOpen] = useMenuOpenState();
  return h(ext.primitives.MenuItemButton, {
    shortcut: useShortcuts((rows: Dyn) => rows.find((row: Dyn) => row.id === "session.rename")),
    icon: h(ext.primitives.IconEditOutlineRegular, {}),
    onSelect: () => {
      setMenuOpen(false);
      requestSessionRename(sessionId, displayTitle);
    },
    children: t("rename"),
  });
}

/**
 * Mot muc menu "fork" cua mot phien (slot sidebar.workspaces.session.menu.item, id "fork", order 300).
 * Nhan: props.sessionId — phien; props.useMenuOpenState — cap trang thai mo menu; props.useShortcuts — danh muc phim tat; props.useSessionAccess — hook quyen theo phien; props.forkSession — hanh dong fork; props.t — ham dich.
 * Tra: node MenuItemButton, hoac null khi nguoi goi khong duoc phep fork phien nay.
 */
export function ForkSessionMenuItem({ sessionId, useMenuOpenState, useShortcuts, useSessionAccess, forkSession, t }: Dyn): Dyn {
  const [, setMenuOpen] = useMenuOpenState();
  const shortcut = useShortcuts((rows: Dyn) => rows.find((row: Dyn) => row.id === "session.fork"));
  if (!useSessionAccess(sessionId, "session/fork")) return null;
  return h(ext.primitives.MenuItemButton, {
    shortcut,
    icon: h(ext.primitives.IconBranchOutlineRegular, {}),
    onSelect: () => {
      setMenuOpen(false);
      forkSession(sessionId);
    },
    children: t("menu.fork"),
  });
}

/**
 * Mot muc menu "luu tru / bo luu tru" cua mot phien (slot sidebar.workspaces.session.menu.item, id "archive", order 400).
 * Nhan: props.sessionId — phien; props.useArchived — hook dang ky; props.useMenuOpenState — cap trang thai mo menu; props.useShortcuts — danh muc phim tat; props.archiveSession/unarchiveSession — hanh dong; props.t — ham dich.
 * Tra: node MenuItemButton (nhan va bieu tuong doi theo trang thai luu tru).
 */
export function ArchiveSessionMenuItem({ sessionId, useArchived, useMenuOpenState, useShortcuts, archiveSession, unarchiveSession, t }: Dyn): Dyn {
  const [, setMenuOpen] = useMenuOpenState();
  const shortcut = useShortcuts((rows: Dyn) => rows.find((row: Dyn) => row.id === "session.archive"));
  const archived = useArchived((set: Dyn) => set.has(sessionId));
  return h(ext.primitives.MenuItemButton, {
    shortcut: archived ? undefined : shortcut,
    icon: archived ? h(ext.primitives.IconUnarchiveOutlineRegular, { size: 14 }) : h(ext.primitives.IconArchiveOutlineRegular, { size: 14 }),
    onSelect: () => {
      setMenuOpen(false);
      if (archived) unarchiveSession(sessionId);
      else archiveSession(sessionId);
    },
    children: t(archived ? "menu.unarchiveSession" : "menu.archiveSession"),
  });
}

/**
 * Muc menu cuoi cung "sao chep Session ID" (slot sidebar.workspaces.session.menu.item, id "session-id", order 450).
 * Nhan: props.sessionId — phien; props.useMenuOpenState — cap trang thai mo menu; props.copySessionId — hanh dong; props.t — ham dich.
 * Tra: node MenuItemButton.
 */
export function SessionIdMenuItem({ sessionId, useMenuOpenState, copySessionId, t }: Dyn): Dyn {
  const [, setMenuOpen] = useMenuOpenState();
  return h(ext.primitives.MenuItemButton, {
    icon: h(ext.primitives.IconCopyOutlineRegular, {}),
    onSelect: () => {
      setMenuOpen(false);
      void copySessionId(sessionId);
    },
    children: t("menu.sessionId"),
  });
}

/**
 * Nut "luu tru / bo luu tru" hien khi ro chuot tren mot dong phien (slot sidebar.workspaces.session.row.action, id "archive", order 100).
 * Nhan: props.sessionId — phien; props.useArchived — hook dang ky; props.archiveSession/unarchiveSession — hanh dong; props.t — ham dich.
 * Tra: node nut trong Tooltip (portal, canh day, align end — nguyen ban goc).
 */
export function ArchiveSessionRowButton({ sessionId, useArchived, archiveSession, unarchiveSession, t }: Dyn): Dyn {
  const archived = useArchived((set: Dyn) => set.has(sessionId));
  return h(ext.primitives.Tooltip, {
    label: t(archived ? "actions.unarchive" : "actions.archive"),
    side: "bottom",
    align: "end",
    delayMs: TOOLTIP_DELAY_MS,
    portal: true,
    children: h("button", {
      type: "button",
      className: rowsStyles.iconButton,
      "aria-label": t(archived ? "menu.unarchiveSession" : "menu.archiveSession"),
      onClick: () => {
        if (archived) unarchiveSession(sessionId);
        else archiveSession(sessionId);
      },
      children: archived ? h(ext.primitives.IconUnarchiveOutlineRegular, { size: 14 }) : h(ext.primitives.IconArchiveOutlineRegular, { size: 14 }),
    }),
  });
}

/**
 * Nut "ghim / bo ghim" hien khi ro chuot tren mot dong phien (slot sidebar.workspaces.session.row.action, id "pin", order 200).
 * Nhan: props.sessionId — phien; props.usePinned/useArchived — hook dang ky; props.pinSession/unpinSession — hanh dong; props.t — ham dich.
 * Tra: node nut trong Tooltip, hoac null khi dong da luu tru.
 */
export function PinSessionRowButton(props: Dyn): Dyn {
  const { sessionId, pinSession, unpinSession, t } = props;
  const { pinned, archived } = usePinState(props);
  if (archived) return null;
  return h(ext.primitives.Tooltip, {
    label: t(pinned ? "actions.unpin" : "actions.pin"),
    side: "bottom",
    align: "end",
    delayMs: TOOLTIP_DELAY_MS,
    portal: true,
    children: h("button", {
      type: "button",
      className: rowsStyles.iconButton,
      "aria-label": t(pinned ? "menu.unpinSession" : "menu.pinSession"),
      onClick: () => {
        if (pinned) unpinSession(sessionId);
        else pinSession(sessionId);
      },
      children: pinned ? h(ext.primitives.IconPinFillRegular, { size: 14 }) : h(ext.primitives.IconPinOutlineRegular, { size: 14 }),
    }),
  });
}

/**
 * Mot dong trong danh sach "cong viec se bi dung" cua hop thoai xac nhan luu tru.
 * Ban goc nhan entry theo HO { kind, items: [{ id, label }] } va co nhanh rieng cho "turn".
 * Nhan: entry — { kind, items }; t — ham dich.
 * Tra: chuoi mo ta hoat dong.
 */
export function activityLine(entry: Dyn, t: Dyn): string {
  const items = (entry.items ?? []) as Dyn[];
  const n = items.length;
  const names = items.map((item: Dyn) => item.label ?? item.id).join(t("archive.confirm.listSeparator"));
  const plural = n === 1 ? "one" : "other";
  switch (entry.kind) {
    case "turn":
      return t("archive.confirm.turn");
    case "subagent":
      return t("archive.confirm.subagents." + plural, { n, names });
    case "job":
      return t("archive.confirm.jobs." + plural, { n, names });
    case "schedule":
      return t("archive.confirm.schedules." + plural, { n, names });
    default:
      return t("archive.confirm.other." + plural, { kind: entry.kind, n });
  }
}

/**
 * Than mot hop thoai xac nhan "dung va luu tru" (mount theo key = sessionId nen trang thai chet theo yeu cau).
 * Nhan: props.request — { sessionId, displayTitle, activity }; props.stopAndArchiveSession — hanh dong; props.onSettle — dong hop thoai; props.t — ham dich.
 * Tra: node Modal day du (title, description, footer, danh sach hoat dong).
 */
export function ArchiveConfirmForm({ request, stopAndArchiveSession, onSettle, t }: Dyn): Dyn {
  const [archiving, setArchiving] = ext.react.useState(false);
  const [error, setError] = ext.react.useState(null);
  const close = (): void => {
    if (archiving) return;
    onSettle();
  };
  const confirm = (): void => {
    setArchiving(true);
    setError(null);
    stopAndArchiveSession(request.sessionId)
      .then(() => {
        setArchiving(false);
        onSettle();
      })
      .catch((reason: unknown) => {
        setArchiving(false);
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  };
  return hs(ext.primitives.Modal, {
    open: true,
    onClose: close,
    closeLabel: t("close"),
    title: t("archive.confirm.title"),
    description: t("archive.confirm.desc", { title: request.displayTitle }),
    footer: hs(fragment(), {
      children: [
        h(ext.primitives.Button, { variant: "outline", disabled: archiving, onClick: close, children: t("cancel") }),
        h(ext.primitives.Button, { variant: "outline", className: workspaceBrowserStyles.deleteAction, disabled: archiving, onClick: confirm, children: t("archive.confirm.action") }),
      ],
    }),
    children: [
      h("ul", {
        className: workspaceBrowserStyles.archiveActivity,
        "aria-label": t("archive.confirm.activity"),
        children: (request.activity as Dyn[]).map((entry: Dyn, index: number) => h("li", { children: activityLine(entry, t) }, entry.kind + "-" + String(index))),
      }),
      archiving && h("div", { className: workspaceBrowserStyles.deleteStatus, role: "status", children: t("archive.confirm.pending") }),
      error !== null && h("div", { className: workspaceBrowserStyles.renameError, role: "alert", children: error }),
    ],
  });
}

/**
 * Lop phu "dung va luu tru" (shell.overlay, id "workspace.session-archive").
 * Nhan: props.useArchiveRequest — hook dang ky yeu cau; props.settleSessionArchive — dong yeu cau; props.stopAndArchiveSession — hanh dong; props.t — ham dich.
 * Tra: node hop thoai, hoac null khi khong co yeu cau nao (ban goc KHONG mount Modal rong).
 */
export function SessionArchiveConfirmDialog({ useArchiveRequest, settleSessionArchive, stopAndArchiveSession, t }: Dyn): Dyn {
  const request = useArchiveRequest((pending: Dyn) => pending);
  if (request === null || request === undefined) return null;
  return h(ArchiveConfirmForm, { request, stopAndArchiveSession, onSettle: settleSessionArchive, t }, request.sessionId);
}

/**
 * Than hop thoai doi ten mot phien (mount theo key = sessionId; ban nhap lay tu yeu cau luc mount).
 * Nhan: props.request — { sessionId, currentTitle }; props.renameSession — hanh dong; props.onSettle — dong hop thoai; props.t — ham dich.
 * Tra: node Modal day du (title, footer, o nhap, loi).
 */
export function RenameForm({ request, renameSession, onSettle, t }: Dyn): Dyn {
  const [draft, setDraft] = ext.react.useState(request.currentTitle);
  const [renaming, setRenaming] = ext.react.useState(false);
  const [error, setError] = ext.react.useState(null);
  const composingRef = ext.react.useRef(false);
  const trimmed = (draft as string).trim();
  const blocked = renaming || trimmed === "";
  const close = (): void => {
    if (renaming) return;
    onSettle();
  };
  const confirm = (): void => {
    if (blocked) return;
    setRenaming(true);
    setError(null);
    renameSession(request.sessionId, trimmed)
      .then(() => {
        setRenaming(false);
        onSettle();
      })
      .catch((reason: unknown) => {
        setRenaming(false);
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  };
  return hs(ext.primitives.Modal, {
    open: true,
    onClose: close,
    closeLabel: t("close"),
    title: t("rename.session.title"),
    footer: hs(fragment(), {
      children: [
        h(ext.primitives.Button, { variant: "outline", disabled: renaming, onClick: close, children: t("cancel") }),
        h(ext.primitives.Button, { variant: "primary", disabled: blocked, onClick: confirm, children: t("rename") }),
      ],
    }),
    children: [
      h("input", {
        className: workspaceBrowserStyles.renameInput,
        value: draft,
        "aria-label": t("field.sessionName"),
        "data-modal-autofocus": true,
        disabled: renaming,
        onFocus: (e: Dyn) => {
          e.target.select();
        },
        onChange: (e: Dyn) => {
          setDraft(e.target.value);
          setError(null);
        },
        onCompositionStart: () => {
          composingRef.current = true;
        },
        onCompositionEnd: () => {
          composingRef.current = false;
        },
        onKeyDown: (e: Dyn) => {
          if (e.key === "Enter" && !composingRef.current) {
            e.preventDefault();
            confirm();
          }
        },
      }),
      error !== null && h("div", { className: workspaceBrowserStyles.renameError, role: "alert", children: error }),
    ],
  });
}

/**
 * Lop phu doi ten mot phien (shell.overlay, id "workspace.session-rename").
 * Nhan: props.useRenameRequest — hook dang ky yeu cau; props.settleSessionRename — dong yeu cau; props.renameSession — hanh dong; props.t — ham dich.
 * Tra: node hop thoai, hoac null khi khong co yeu cau nao (ban goc KHONG mount Modal rong).
 */
export function SessionRenameDialog({ useRenameRequest, settleSessionRename, renameSession, t }: Dyn): Dyn {
  const request = useRenameRequest((pending: Dyn) => pending);
  if (request === null || request === undefined) return null;
  return h(RenameForm, { request, renameSession, onSettle: settleSessionRename, t }, request.sessionId);
}
