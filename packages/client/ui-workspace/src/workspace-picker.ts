/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc WorkspacePickFlow + WorkspacePicker — luong chon/them workspace cua man trong, nguyen cau truc ban goc
 */

import { workspacePickerStyles } from "./css.ts";
import { ext, fragment, h, hs, type Dyn } from "./runtime.ts";
import { workspaceDisplayTitle } from "./views.ts";

/** Id cua muc "them workspace" trong menu chon — nguyen van ban goc. */
export const ADD_WORKSPACE = "::add-workspace";

/**
 * Render menu chon workspace kem hop thoai loi chon thu muc.
 * Nhan: props — t, open, anchorRef, useWorkspaces, createWorkspace, useDirectoryFlow, renderDirectoryFlow, onPick, onClose, addOnly, onBusyChange, side, selectedId.
 * Tra: cap [menu, hop thoai loi, luong thu muc].
 */
export function WorkspacePickFlow({ t, open, anchorRef, useWorkspaces, createWorkspace, useDirectoryFlow, renderDirectoryFlow, onPick, onClose, addOnly = false, onBusyChange, side = "bottom", selectedId }: Dyn): Dyn {
  const workspaceSnapshot = useWorkspaces((state: Dyn) => state);
  const workspaces = workspaceSnapshot.items;
  const getAnchorRect = ext.react.useCallback(() => anchorRef?.current?.getBoundingClientRect() ?? null, [anchorRef]);
  const [errorOpen, setErrorOpen] = ext.react.useState(false);
  const [modalError, setModalError] = ext.react.useState(null);
  const [flowOpen, setFlowOpen] = ext.react.useState(false);
  const [pickingFolder, setPickingFolder] = ext.react.useState(false);
  const flowBusy = flowOpen || pickingFolder;
  ext.react.useEffect(() => {
    onBusyChange?.(flowBusy);
  }, [flowBusy, onBusyChange]);
  const flowAvailable = useDirectoryFlow((occupied: boolean) => occupied);
  ext.react.useEffect(() => {
    if (flowOpen && !flowAvailable) setFlowOpen(false);
  }, [flowOpen, flowAvailable]);
  const addEntries = flowAvailable ? [{ id: ADD_WORKSPACE, label: t("menu.addWorkspace"), icon: h(ext.primitives.IconPlusOutlineRegular, { size: 16 }), disabled: flowBusy }] : [];
  const pinAdd = !addOnly && workspaces.length > 0;
  const items = pinAdd
    ? workspaces.map((workspace: Dyn) => ({ id: workspace.workspaceId, label: workspaceDisplayTitle(workspace.title, t("workspace.defaultName")), icon: h(ext.primitives.IconFolderCloseRegular, { size: 16 }), disabled: flowBusy }))
    : addEntries;
  const menuIsEmpty = items.length === 0;
  const closeModal = (): void => {
    setErrorOpen(false);
    setModalError(null);
  };
  const adoptDirectory = (path: string): Dyn =>
    createWorkspace({ path })
      .then((workspace: Dyn) => {
        setFlowOpen(false);
        onPick(workspace.workspaceId);
      })
      .catch((reason: unknown) => {
        setModalError(reason instanceof Error ? reason.message : String(reason));
        setFlowOpen(false);
        setErrorOpen(true);
      });
  const openDirectoryFlow = ext.react.useCallback(() => {
    onClose();
    setErrorOpen(false);
    setModalError(null);
    setFlowOpen(true);
  }, [onClose]);
  const listSettled = addOnly || workspaceSnapshot.phase === "ready";
  const addIsTheOnlyEntry = !pinAdd && listSettled && addEntries.length === 1;
  ext.react.useEffect(() => {
    if (open && addIsTheOnlyEntry && !flowBusy) openDirectoryFlow();
  }, [open, addIsTheOnlyEntry, flowBusy, openDirectoryFlow]);
  const flowOwner = {
    open: flowOpen,
    busy: pickingFolder,
    onPicked: (path: string) => {
      setPickingFolder(true);
      adoptDirectory(path).finally(() => {
        setPickingFolder(false);
      });
    },
    onCancel: () => {
      setFlowOpen(false);
    },
    onError: (message: string) => {
      setFlowOpen(false);
      setModalError(message);
      setErrorOpen(true);
    },
  };
  const handleSelect = (id: string): void => {
    if (id === ADD_WORKSPACE) {
      openDirectoryFlow();
      return;
    }
    onPick(id);
  };
  return hs(fragment(), {
    children: [
      h(ext.primitives.Menu, {
        open: open && !addIsTheOnlyEntry && !menuIsEmpty,
        anchor: null,
        items,
        ...(pinAdd ? { footer: addEntries } : {}),
        selectedId,
        onSelect: handleSelect,
        onClose,
        side,
        portal: true,
        getAnchorRect,
      }),
      open && !addIsTheOnlyEntry && !menuIsEmpty && workspaceSnapshot.phase === "pending" && h("div", { className: workspacePickerStyles.menuStatus, role: "status", children: t("picker.loading") }),
      renderDirectoryFlow(flowOwner),
      h(ext.primitives.Modal, {
        open: errorOpen,
        onClose: closeModal,
        closeLabel: t("close"),
        title: t("folderError.title"),
        footer: hs(fragment(), {
          children: [
            h(ext.primitives.Button, { variant: "outline", className: workspacePickerStyles.modalAction, onClick: closeModal, children: t("cancel") }),
            h(ext.primitives.Button, { variant: "primary", className: workspacePickerStyles.modalAction, disabled: !flowAvailable, onClick: openDirectoryFlow, children: t("folderError.retry") }),
          ],
        }),
        children: h("div", { className: workspacePickerStyles.modalError, role: "alert", children: modalError }),
      }),
    ],
  });
}

/**
 * Dang ky cua man trong: chuyen phan chia cua chu so huu sang luong loi (moi trang thai nam trong flow/chu so huu).
 * Nhan: props — open, anchorRef, useWorkspaces, selectedId, onPick, onClose, createWorkspace, useDirectoryFlow, renderSlot, t.
 * Tra: node luong chon.
 */
export function WorkspacePicker({ open, anchorRef, useWorkspaces, selectedId, onPick, onClose, createWorkspace, useDirectoryFlow, renderSlot, t }: Dyn): Dyn {
  return h(WorkspacePickFlow, {
    t,
    open,
    anchorRef,
    useWorkspaces,
    createWorkspace,
    useDirectoryFlow,
    renderDirectoryFlow: (owner: Dyn) => renderSlot("conversation.hero.workspace.directoryFlow", owner),
    selectedId,
    onPick,
    onClose,
  });
}
