/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Manh trinh bay cua trinh duyet workspace: menu tuy chon, trang thai rong, watermark, keo tha — nguyen hanh vi ban goc
 */

import { clsx } from "./clsx.ts";
import { workspaceBrowserStyles } from "./css.ts";
import { pinCurrentBlank } from "./derive.ts";
import { DEFAULT_WORKSPACE_TITLE, SEARCH_QUERY_MAX_CODE_UNITS, SESSION_WATERMARK_AUTO_MAX, SESSION_WATERMARK_BASE } from "./ids.ts";
import { ext, h, hs, type Dyn } from "./runtime.ts";

/**
 * Tieu de hien thi cua mot workspace: thay ten MA HOST tu dat bang ten mac dinh da dich.
 * Nhan: title — ten da luu; localizedDefault — ten mac dinh da dich.
 * Tra: tieu de hien thi.
 */
export function workspaceDisplayTitle(title: string, localizedDefault: string): string {
  return title === DEFAULT_WORKSPACE_TITLE ? localizedDefault : title;
}

/**
 * Hien dong trong cong voi `watermark` dong khong trong dau tien, theo thu tu danh sach.
 * Nhan: sessions — cac dong phien; watermark — so dong khong trong toi da hien.
 * Tra: { rows, hiddenCount } — dong hien duoc va so dong bi an.
 */
export function watermarkRows(sessions: readonly Dyn[], watermark: number): { rows: Dyn[]; hiddenCount: number } {
  let count = 0;
  const rows = sessions.filter((session: Dyn) => {
    if (session.blank) return true;
    count += 1;
    return count <= watermark;
  });
  return { rows, hiddenCount: sessions.length - rows.length };
}

/**
 * Watermark nho nhat bao du moi dong dang chay/co con chay/dang cho/co nhac chua doc/dang chon trong gioi han tu dong.
 * Nhan: sessions — cac dong phien; current — phien dang chon; revealSessionId — phien can dua vao tam nhin.
 * Tra: watermark can thiet.
 */
export function requiredWatermark(sessions: readonly Dyn[], current: string | undefined, revealSessionId: string | undefined): number {
  let index = 0;
  let required = 0;
  for (const session of sessions) {
    if (session.blank) continue;
    index += 1;
    if ((index <= SESSION_WATERMARK_AUTO_MAX && (session.running || session.runningSubagentCount > 0 || session.pendingInteraction !== undefined || session.completed || session.id === current)) || session.id === revealSessionId) required = index;
  }
  return required;
}

/**
 * Nang watermark cua tung nhom len muc can thiet; tra lai chinh `marks` khi khong co gi tang.
 * Nhan: marks — watermark da luu; required — watermark can thiet theo nhom.
 * Tra: bang watermark moi (hoac chinh `marks`).
 */
export function raiseWatermarks(marks: Record<string, number>, required: Map<string, number>): Record<string, number> {
  let raised = marks;
  for (const [key, watermark] of required) if (watermark > (raised[key] ?? SESSION_WATERMARK_BASE)) raised = { ...raised, [key]: watermark };
  return raised;
}

/**
 * Giu o nhap lieu va payload RPC trong hop dong day cua session.search.
 * Nhan: value — van ban nguoi dung go.
 * Tra: van ban da bo ky tu NUL va cat theo gioi han don vi ma.
 */
export function sanitizeSearchQuery(value: string): string {
  const withoutNul = value.replaceAll("\u0000", "");
  if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul;
  let end = SEARCH_QUERY_MAX_CODE_UNITS;
  const last = withoutNul.charCodeAt(end - 1);
  const next = withoutNul.charCodeAt(end);
  if (last >= 55296 && last <= 56319 && next >= 56320 && next <= 57343) end--;
  return withoutNul.slice(0, end);
}

/**
 * Chap nhan keo tha native o cap document trong khi mot dong dang duoc keo.
 * Nhan: active — co dong nao dang duoc keo khong.
 * Tra: khong co.
 */
export function useNativeDragAcceptance(active: boolean): void {
  ext.react.useEffect(() => {
    if (!active) return;
    const acceptDrag = (event: Dyn): void => {
      event.preventDefault();
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
    };
    const acceptDrop = (event: Dyn): void => {
      event.preventDefault();
    };
    document.addEventListener("dragover", acceptDrag);
    document.addEventListener("drop", acceptDrop);
    return () => {
      document.removeEventListener("dragover", acceptDrag);
      document.removeEventListener("drop", acceptDrop);
    };
  }, [active]);
}

/**
 * Ap mot lan tha hien duoc vao toan bo tai khoan ma khong bo cac thanh vien dang bi an.
 * Nhan: order — thu tu day du; rows — dong dang hien; drag — trang thai keo; over — dich tha.
 * Tra: thu tu moi, hoac undefined khi lan tha khong doi gi.
 */
export function sessionDragOrder(order: readonly string[], rows: readonly Dyn[], drag: Dyn, over: Dyn): string[] | undefined {
  const source = rows.find((row: Dyn) => row.id === drag.sessionId);
  const target = rows.find((row: Dyn) => row.id === over.id);
  if (source === undefined || target === undefined || source.blank || source.pinned !== drag.pinned || target.pinned !== drag.pinned || source.id === target.id || !order.includes(source.id)) return undefined;
  const section = rows.filter((row: Dyn) => row.pinned === drag.pinned);
  const sourceIndex = section.findIndex((row: Dyn) => row.id === source.id);
  if (section.filter((row: Dyn) => row.id !== source.id).findIndex((row: Dyn) => row.id === target.id) + (over.half === "after" ? 1 : 0) === sourceIndex) return undefined;
  const next = order.filter((id) => id !== source.id);
  const targetIndex = next.indexOf(target.id);
  if (targetIndex === -1) return undefined;
  next.splice(targetIndex + (over.half === "after" ? 1 : 0), 0, source.id);
  return pinCurrentBlank(next, rows.find((row: Dyn) => row.blank)?.id);
}

/**
 * Xac dinh ben chen (truoc/sau) theo vi tri chuot tren dong tieu de workspace.
 * Nhan: e — su kien chuot.
 * Tra: "before" hoac "after".
 */
export function workspaceGroupHalf(e: Dyn): string {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

/**
 * Menu tuy chon che do xem: nhom, thu tu, va bo loc phien luu tru; tu giu trang thai mo.
 * Nhan: props.groupBy/orderBy/archivedFilter — lua chon hien tai; props.onGroupPick/onOrderPick/onArchivedFilterPick — ham chon; props.t — ham dich.
 * Tra: node menu.
 */
export function ViewOptionsMenu({ groupBy, orderBy, archivedFilter, onGroupPick, onOrderPick, onArchivedFilterPick, t }: Dyn): Dyn {
  const [open, setOpen] = ext.react.useState(false);
  return h(ext.primitives.Menu, {
    open,
    onClose: () => {
      setOpen(false);
    },
    items: [
      { type: "label", id: "group-by", text: t("groupBy.label") },
      { id: "workspace", label: t("groupBy.workspace"), icon: h(ext.primitives.IconFolderCloseRegular, {}) },
      { id: "workspace-tree", label: t("groupBy.workspaceTree"), icon: h(ext.primitives.IconWorkspaceTreeOutlineRegular, {}) },
      { id: "flat", label: t("groupBy.flat"), icon: h(ext.primitives.IconFlatListOutlineRegular, {}) },
      { type: "separator", id: "order-by-separator" },
      { type: "label", id: "order-by", text: t("orderBy.label") },
      { id: "manual", label: t("orderBy.manual"), icon: h(ext.primitives.IconChevronsUpDownOutlineRegular, {}) },
      { id: "updated", label: t("orderBy.updated"), icon: h(ext.primitives.IconClockOutlineRegular, {}) },
      { type: "separator", id: "archived-filter-separator" },
      { type: "label", id: "filter-by", text: t("filterBy.label") },
      { id: "hide-archived", label: t("viewOptions.hideArchived"), icon: h(ext.primitives.IconArchiveOffOutlineRegular, {}) },
      { id: "show-archived", label: t("viewOptions.showArchived"), icon: h(ext.primitives.IconQueueOutlineRegular, {}) },
      { id: "only-archived", label: t("viewOptions.onlyArchived"), icon: h(ext.primitives.IconArchiveCheckOutlineRegular, {}) },
    ],
    selectedIds: [groupBy, orderBy, { default: "hide-archived", show: "show-archived", only: "only-archived" }[archivedFilter as string]],
    onSelect: (id: string) => {
      if (id === "workspace" || id === "workspace-tree" || id === "flat") onGroupPick(id);
      else if (id === "manual" || id === "updated") onOrderPick(id);
      else if (id === "hide-archived") onArchivedFilterPick("default");
      else if (id === "show-archived") onArchivedFilterPick("show");
      else if (id === "only-archived") onArchivedFilterPick("only");
      setOpen(false);
    },
    align: "end",
    dense: true,
    listClassName: workspaceBrowserStyles.viewOptionsMenu,
    portal: true,
    anchor: h(ext.primitives.Tooltip, {
      label: t("viewOptions.label"),
      side: "bottom",
      delayMs: 500,
      children: h("button", {
        type: "button",
        className: clsx(workspaceBrowserStyles.iconButton, workspaceBrowserStyles.wide),
        "aria-label": t("viewOptions.label"),
        onClick: () => {
          setOpen((v: boolean) => !v);
        },
        children: h(ext.primitives.IconSlidersTwoOutlineRegular, {}),
      }),
    }),
  });
}

/**
 * Cho trong khi danh sach rong — bieu tuong tren chu; che do "chi luu tru" neu ten bo loc va loi quay lai.
 * Nhan: props.rowState — trang thai ghim/luu tru + bo loc; props.onLeaveArchivedOnly — roi che do chi luu tru; props.t — ham dich.
 * Tra: node trang thai rong.
 */
export function EmptySessions({ rowState, onLeaveArchivedOnly, t }: Dyn): Dyn {
  const archivedOnly = rowState.archivedFilter === "only";
  return hs("div", {
    className: workspaceBrowserStyles.emptyState,
    "data-row-key": "empty",
    children: [
      archivedOnly ? h(ext.primitives.IconArchiveOutlineRegular, { size: 24 }) : h(ext.primitives.IconQueueOutlineRegular, { size: 24 }),
      h("div", { children: archivedOnly ? t("empty.noneArchived") : t("empty.none") }),
      archivedOnly && h("button", { type: "button", className: workspaceBrowserStyles.emptyAction, onClick: onLeaveArchivedOnly, children: t("empty.viewOthers") }),
    ],
  });
}
