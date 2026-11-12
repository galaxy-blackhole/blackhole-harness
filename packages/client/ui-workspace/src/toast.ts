/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc The toast hanh dong tren dong + Factory "workspace.toast.content" (component WorkspaceToast NGUYEN BAN) + muoi mot muc toast
 */

import { TOAST_KEYS } from "./ids.ts";
import { ext, h, type Dyn } from "./runtime.ts";

/**
 * The toast hanh dong tren mot dong phien: dieu phoi thong bao hien tai xuong muc KEYED "workspace.toast"
 * theo dung kind cua no (entryKey), KHONG tu dien giai nghiep vu.
 *
 * ⚠️ 18/10/2026 — SUA LOI (b): ban truoc tu goi ext.primitives.Toast va tu tra cuu chuoi bang
 * t("toast." + kind) ⇒ muc keyed "workspace.toast" khong bao gio duoc goi, nen toan bo 11 dang ky
 * muc toast (va ca hanh dong "hoan tac" / "loc") khong bao gio render. Ban goc uy quyen cho
 * renderSlot voi entryKey = notice.kind — port nguyen van.
 * Nhan: props — { useToast, dismissToast, renderSlot }.
 * Tra: node muc toast da chon, hoac null khi khong co thong bao.
 */
export function RowActionToast({ useToast, dismissToast, renderSlot }: Dyn): Dyn {
  const notice = useToast((current: Dyn) => current);
  if (notice === null || notice === undefined) return null;
  return renderSlot("workspace.toast", { ...notice, dismissToast }, { entryKey: notice.kind });
}

/**
 * Mot muc toast don gian: dung phan trinh bay cua chu so huu roi tra cho Factory dung chung.
 * Nhan: props — { display, t, dismissToast, renderFactorySlot, seq }.
 * Tra: node cua Factory "workspace.toast.content".
 */
export function ToastEntry(props: Dyn): Dyn {
  const { dismissToast, display, t, renderFactorySlot, seq } = props;
  return renderFactorySlot("workspace.toast.content", {
    ...display(props, t, dismissToast),
    seq,
    onDone: dismissToast,
  });
}

/**
 * Muc toast "da luu tru": nhu ToastEntry nhung tu them hanh dong "loc phien luu tru" khi bo loc dang tat.
 * Nhan: props — { display, filterAction, useStore, t, dismissToast, renderFactorySlot, seq }.
 * Tra: node cua Factory "workspace.toast.content".
 */
export function ArchiveToastEntry(props: Dyn): Dyn {
  const { dismissToast, display, filterAction, useStore, t, renderFactorySlot, seq } = props;
  const archivedVisible = useStore((state: Dyn) => (state.archivedFilter ?? "default") !== "default");
  const fields = display(props, t, dismissToast);
  return renderFactorySlot("workspace.toast.content", {
    ...fields,
    actions: [...(fields.actions ?? []), ...(archivedVisible ? [] : [filterAction(t, dismissToast)])],
    seq,
    onDone: dismissToast,
  });
}

/**
 * Than chung cua moi muc toast: trinh bay du lieu hien thi bang primitive Toast (nhan sac thai, thoi gian giu, hanh dong).
 *
 * ⚠️ 18/10/2026 — SUA LOI (b): ban truoc thay component nay bang mot HAM TRA CUU dinh nghia
 * (toastDefinitions) nen Factory "workspace.toast.content" tra ve mot node tu che, khong phai
 * component nguyen ban; muc "warning" con mat bieu tuong IconWarningOutlineRegular. Ban goc la
 * component duoi day — port nguyen van.
 * Nhan: props — { seq, text, tone, holdMs, actions, onDone }.
 * Tra: node Toast, remount chi khi seq doi.
 */
export function WorkspaceToast({ seq, text, tone, holdMs, actions, onDone }: Dyn): Dyn {
  return h(
    ext.primitives.Toast,
    {
      text,
      onDone,
      ...(tone === "success" ? { tone: "success" } : {}),
      ...(tone === "warning" ? { icon: h(ext.primitives.IconWarningOutlineRegular, {}) } : {}),
      ...(holdMs === undefined ? {} : { holdMs }),
      ...(actions === undefined ? {} : { actions }),
    },
    seq,
  );
}

/** Mot dinh nghia muc toast: khoa, phan trinh bay, va co phai muc luu tru khong. */
interface ToastDefinition {
  /** Khoa trong slot keyed workspace.toast. */
  key: string;
  /** Ham dung phan trinh bay (chu, sac thai, thoi gian giu, hanh dong). */
  display: (notice: Dyn, t: Dyn, dismiss: () => void) => Dyn;
  /** Muc luu tru thi dung ArchiveToastEntry + store cua kho xem. */
  archive?: boolean;
}

/**
 * Muoi mot dinh nghia muc toast cua row — NGUYEN khoa va NGUYEN cau chu cua ban goc.
 * Nhan: actions — { undoArchive, showArchived, openForkSource }.
 * Tra: mang dinh nghia toast theo dung thu tu dang ky cua ban goc.
 */
export function toastDefinitions(actions: Dyn): ToastDefinition[] {
  const definitions: ToastDefinition[] = [
    { key: "sessionIdCopied", display: (_notice: Dyn, t: Dyn) => ({ text: t("toast.sessionIdCopied"), tone: "success" }) },
    { key: "sessionIdCopyFailed", display: (_notice: Dyn, t: Dyn) => ({ text: t("toast.sessionIdCopyFailed"), tone: "warning" }) },
    { key: "pinFailed", display: (_notice: Dyn, t: Dyn) => ({ text: t("toast.pinFailed"), tone: "warning" }) },
    { key: "unpinFailed", display: (_notice: Dyn, t: Dyn) => ({ text: t("toast.unpinFailed"), tone: "warning" }) },
    { key: "archivedNotOpenable", display: (_notice: Dyn, t: Dyn) => ({ text: t("toast.archivedNotOpenable"), tone: "warning" }) },
    { key: "defaultWorkspaceFailed", display: (_notice: Dyn, t: Dyn) => ({ text: t("defaultWorkspace.failed"), tone: "warning" }) },
    { key: "shortcutForkFailed", display: (notice: Dyn, t: Dyn) => ({ text: t(notice.reason === "unavailable" ? "shortcut.noCompletedTurn" : "shortcut.forkFailed"), tone: "plain" }) },
    { key: "createFailed", display: (notice: Dyn, t: Dyn) => ({ text: t("toast.createFailed", { message: notice.message }), tone: "warning", holdMs: 6000 }) },
    {
      key: "forkRequiresOpen",
      display: (notice: Dyn, t: Dyn, dismiss: () => void) => ({
        text: t("toast.forkRequiresOpen"),
        tone: "warning",
        holdMs: 6000,
        actions: [
          {
            label: t("toast.openForkSource"),
            onClick: () => {
              dismiss();
              actions.openForkSource(notice.sessionId);
            },
          },
        ],
      }),
    },
    {
      key: "archived",
      archive: true,
      display: (notice: Dyn, t: Dyn, dismiss: () => void) => ({
        text: t("toast.archived"),
        tone: "success",
        holdMs: 6000,
        actions: [
          {
            label: t("toast.archivedUndo"),
            onClick: () => {
              dismiss();
              actions.undoArchive(notice.sessionId);
            },
          },
        ],
      }),
    },
    {
      key: "stoppedAndArchived",
      archive: true,
      display: (notice: Dyn, t: Dyn, dismiss: () => void) => ({
        text: t("toast.stoppedAndArchived"),
        tone: "success",
        holdMs: 6000,
        actions: [
          {
            label: t("toast.archivedUndo"),
            onClick: () => {
              dismiss();
              actions.undoArchive(notice.sessionId);
            },
          },
        ],
      }),
    },
  ];
  // Cong chan: tap khoa phai khop NGUYEN VAN danh sach cua ban goc (fail som neu ai sua lech).
  const keys = definitions.map((definition) => definition.key);
  if (keys.length !== TOAST_KEYS.length || TOAST_KEYS.some((key, index) => key !== keys[index])) {
    throw new Error("ui-workspace: tap khoa toast lech ban goc");
  }
  return definitions;
}

/**
 * Dang ky Factory than toast + muoi mot muc toast keyed (nguyen khoa, nguyen store, nguyen hanh dong).
 * Nhan: ctx — context goc; viewStore — kho xem (lam store cho hai muc luu tru); actions — { undoArchive, showArchived, openForkSource }.
 * Tra: khong co.
 */
export function registerToasts(ctx: Dyn, viewStore: Dyn, actions: Dyn): void {
  const archiveFilterAction = (t: Dyn, dismiss: () => void): Dyn => ({
    prefix: t("toast.archivedOr"),
    label: t("toast.archivedFilter"),
    onClick: () => {
      dismiss();
      actions.showArchived();
    },
  });
  ctx.slots.registerFactory({ name: "workspace.toast.content", scope: "root" }, WorkspaceToast);
  ctx.slots.inject("workspace.toast", function* () {
    for (const definition of toastDefinitions(actions)) {
      yield ctx.slots.register(
        {
          name: "workspace.toast",
          key: definition.key,
          locale: "workspace",
          ...(definition.archive === true ? { store: viewStore } : {}),
          inject: () =>
            definition.archive === true
              ? { display: definition.display, filterAction: archiveFilterAction }
              : { display: definition.display },
        },
        definition.archive === true ? ArchiveToastEntry : ToastEntry,
      );
    }
  });
}
