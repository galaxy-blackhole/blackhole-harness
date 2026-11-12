/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cac component dong cua cay workspace — nguyen cau truc DOM va ten lop hash cua ban goc (Rows.js)
 */

import { clsx } from "./clsx.ts";
import { rowsStyles } from "./css.ts";
import { abbreviateHomePath } from "./paths.ts";
import { ext, fragment, h, hs, type Dyn } from "./runtime.ts";
import { HOVER_CARD_DELAY_MS, TOOLTIP_DELAY_MS } from "./ids.ts";

/** Do lech toi thieu (px) de mot tieu de bi cat duoc coi la dang cuon. */
const MIN_TITLE_REVEAL_PX = 8;
/** Toc do cuon tieu de (px/ms) — nguyen van ban goc. */
const TITLE_MARQUEE_PX_PER_MS = 0.03;

/**
 * Tieu de hien thi cua mot dong: dong trong hien nhan "phien moi" da dich.
 * Nhan: node — node phien; t — ham dich cua namespace workspace.
 * Tra: chuoi tieu de.
 */
export function displayTitle(node: Dyn, t: Dyn): string {
  return node.blank ? t("session.new") : node.title || t("session.untitled");
}

/**
 * Dat vi tri cuon cua tieu de va phat hai hook mat na cua stylesheet.
 * Nhan: title — phan tu tieu de; left — do lech cuon (px); range — do lech cuon toi da (px).
 * Tra: khong co.
 */
export function placeTitle(title: Dyn, left: number, range: number): void {
  if (typeof title.scrollTo === "function") title.scrollTo({ left, behavior: "instant" });
  else title.scrollLeft = left;
  if (left > 0) title.dataset.scrolled = "";
  else delete title.dataset.scrolled;
  if (left < range) title.dataset.clipped = "";
  else delete title.dataset.clipped;
}

/**
 * Dua tieu de ve trang thai nghi: cuon ve dau va tat ca hai mat na.
 * Nhan: title — phan tu tieu de.
 * Tra: khong co.
 */
export function restTitle(title: Dyn): void {
  if (typeof title.scrollTo === "function") title.scrollTo({ left: 0, behavior: "instant" });
  else title.scrollLeft = 0;
  delete title.dataset.scrolled;
  delete title.dataset.clipped;
}

/**
 * Cuon tieu de dai hon o cua no khi ro chuot vao dong: cuon deu toi mep xa roi dung lai.
 * Nhan: title — tham chieu tieu de cua dong.
 * Tra: cap xu ly enter/leave on dinh cho dong.
 */
export function useTitleMarquee(title: Dyn): { enter: () => void; leave: () => void } {
  const frame = ext.react.useRef(0);
  ext.react.useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
    },
    [],
  );
  return ext.react.useMemo(
    () => ({
      enter: () => {
        if (title.current === null) return;
        const element = title.current;
        const range = element.scrollWidth - element.clientWidth;
        if (range <= MIN_TITLE_REVEAL_PX) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          placeTitle(element, range, range);
          return;
        }
        cancelAnimationFrame(frame.current);
        let previous: number | undefined;
        let position = 0;
        const step = (now: number): void => {
          position += previous === undefined ? 0 : (now - previous) * TITLE_MARQUEE_PX_PER_MS;
          previous = now;
          placeTitle(element, Math.min(position, range), range);
          if (position < range) frame.current = requestAnimationFrame(step);
        };
        frame.current = requestAnimationFrame(step);
      },
      leave: () => {
        cancelAnimationFrame(frame.current);
        if (title.current === null) return;
        restTitle(title.current);
      },
    }),
    [title],
  );
}

/**
 * Nhan thoi gian tuong doi dang rut gon da dich ("vua xong"/"5 phut").
 * Nhan: updatedAt — moc cap nhat (ms); now — moc hien tai (ms); t — ham dich.
 * Tra: chuoi thoi gian.
 */
export function timeLabel(updatedAt: number, now: number, t: Dyn): string {
  const { unit, n } = ext.primitives.relativeTime(updatedAt, now);
  return unit === "now" ? t("time.now") : t("time." + unit, { n });
}

/**
 * Bien the cho the hover: khoang cach duoc boc trong mau "cach day", nhom "vua xong" giu nguyen.
 * Nhan: updatedAt — moc cap nhat (ms); now — moc hien tai (ms); t — ham dich.
 * Tra: chuoi thoi gian.
 */
export function hoverTimeLabel(updatedAt: number, now: number, t: Dyn): string {
  const { unit, n } = ext.primitives.relativeTime(updatedAt, now);
  return unit === "now" ? t("time.now") : t("time.ago", { t: t("time." + unit, { n }) });
}

/**
 * Thoi diem tao tuyet doi qua mau ngay cua tu dien (khong dung toLocaleString vi no theo ngon ngu trinh duyet).
 * Nhan: createdAt — moc tao (ms); t — ham dich.
 * Tra: chuoi "tao luc …".
 */
export function createdLabel(createdAt: number, t: Dyn): string {
  const d = new Date(createdAt);
  const pad2 = (v: number): string => String(v).padStart(2, "0");
  const date = t("date.ymd", { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
  return t("hover.created", { time: date + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) });
}

/**
 * Than the hover cua mot dong workspace: ten, duong dan hien thi, thoi diem tao tuyet doi.
 * Nhan: props.label — ten workspace; props.cwd — duong dan; props.createdAt — moc tao; props.t — ham dich.
 * Tra: node the hover.
 */
export function WorkspaceHoverContent({ label, cwd, createdAt, t }: Dyn): Dyn {
  return hs("div", {
    className: rowsStyles.hoverContent,
    children: [h("div", { className: rowsStyles.hoverTitle, children: label }), h("div", { className: rowsStyles.hoverPath, children: cwd }), h("div", { className: rowsStyles.hoverTime, children: createdLabel(createdAt, t) })],
  });
}

/**
 * Nua vi tri chuot cua mot dong (duong chen o tren hay o duoi).
 * Nhan: e — su kien chuot.
 * Tra: "before" hoac "after".
 */
export function rowHalf(e: Dyn): string {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

/**
 * Dong tieu de cua mot workspace (nhom): thu muc + ten; ro chuot hien chevron va nut tao phien.
 * Nhan: props.group — nhom da suy dien; props.containsCurrentDescendant — to sang to tien ke ca khi thu gon; props.onToggle/onCreate/actions/drag/home/newShortcut/t — nhu ban goc.
 * Tra: node dong.
 */
export function ProjectRowItem({ group, containsCurrentDescendant = false, onToggle, onCreate, actions, drag, home, newShortcut, t }: Dyn): Dyn {
  const row = group;
  const label = row.workspaceId === undefined ? t("group.ungrouped") : row.label;
  const active = containsCurrentDescendant || (group.expanded && group.containsCurrent);
  const [menuOpen, setMenuOpen] = ext.react.useState(false);
  const workspaceMenuItems = [
    { id: "rename", label: t("rename"), icon: h(ext.primitives.IconEditOutlineRegular, {}) },
    { id: "delete", label: t("delete.workspace"), icon: h(ext.primitives.IconTrashOutlineRegular, {}), danger: true },
  ];
  const ownRow = hs("div", {
    className: clsx(rowsStyles.projectRow, menuOpen && rowsStyles.menuOpen),
    "data-row-key": "workspace:" + String(group.key),
    role: "treeitem",
    "aria-expanded": row.expanded,
    onClick: onToggle,
    draggable: drag !== undefined,
    onDragStart:
      drag === undefined
        ? undefined
        : (e: Dyn) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", row.key);
            drag.start();
          },
    onDragEnd: drag?.end,
    children: [
      h("span", { className: clsx(rowsStyles.slot, rowsStyles.folder, active && rowsStyles.folderActive), children: row.expanded ? h(ext.primitives.IconFolderOpenRegular, {}) : h(ext.primitives.IconFolderCloseRegular, {}) }),
      h("span", { className: clsx(rowsStyles.slot, rowsStyles.chevron), children: h(ext.primitives.IconTriangleRightFillRegular, { className: clsx(rowsStyles.arrow, row.expanded && rowsStyles.arrowOpen) }) }),
      h("span", { className: rowsStyles.projectText, children: h("span", { className: rowsStyles.title, children: label }) }),
      hs("span", {
        className: rowsStyles.rowActions,
        children: [
          actions !== undefined &&
            h(ext.primitives.Menu, {
              open: menuOpen,
              onClose: () => {
                setMenuOpen(false);
              },
              items: workspaceMenuItems,
              onSelect: (id: string) => {
                setMenuOpen(false);
                if (id !== "rename" && id !== "delete") return;
                if (id === "rename") actions.rename();
                else actions.delete();
              },
              portal: true,
              closeOnPointerLeave: true,
              anchor: h("button", {
                type: "button",
                className: rowsStyles.iconButton,
                "aria-label": t("actions.workspace.aria", { name: label }),
                onClick: (e: Dyn) => {
                  e.stopPropagation();
                  setMenuOpen((v: boolean) => !v);
                },
                children: h(ext.primitives.IconEllipsisOutlineRegular, {}),
              }),
            }),
          h(ext.primitives.Tooltip, {
            label: t("actions.newSession"),
            shortcutKeys: newShortcut?.keys,
            side: "bottom",
            align: "end",
            delayMs: TOOLTIP_DELAY_MS,
            portal: true,
            children: h("button", {
              type: "button",
              className: rowsStyles.iconButton,
              "aria-keyshortcuts": newShortcut?.aria,
              "aria-label": t("actions.newSession.aria", { name: label }),
              onClick: (e: Dyn) => {
                e.stopPropagation();
                onCreate();
              },
              children: h(ext.primitives.IconNewChatOutlineRegular, {}),
            }),
          }),
        ],
      }),
    ],
  });
  if (row.createdAt === undefined) return ownRow;
  return h(ext.primitives.HoverCard, {
    anchor: ownRow,
    content: h(WorkspaceHoverContent, { label: row.label, cwd: row.cwd === undefined ? undefined : abbreviateHomePath(row.cwd, home), createdAt: row.createdAt, t }),
    openDelayMs: HOVER_CARD_DELAY_MS,
    grouped: true,
    disabled: menuOpen,
    copyText: row.cwd,
    copyLabel: t("copy"),
    copiedLabel: t("hover.copied"),
  });
}

/**
 * Trang thai hien thi cua mot phien: tuong tac dang cho la chinh, hoat dong song cao hon nhac hoan thanh.
 * Nhan: node — node phien; t — ham dich.
 * Tra: mang trang thai { state, label, trailingLabel? }.
 */
export function sessionStatuses(node: Dyn, t: Dyn): Dyn[] {
  const subagents =
    node.runningSubagentCount === 0
      ? undefined
      : { state: "ongoing", label: t(node.runningSubagentCount === 1 ? "status.subagentsRunning.one" : "status.subagentsRunning.other", { n: node.runningSubagentCount }) };
  let pending: Dyn;
  switch (node.pendingInteraction) {
    case "approval":
      pending = { state: "warning", label: t("status.waitingApproval"), trailingLabel: t("status.compact.approval") };
      break;
    case "plan-review":
      pending = { state: "warning", label: t("status.planReview"), trailingLabel: t("status.compact.planReview") };
      break;
    case "question":
      pending = { state: "warning", label: t("status.waitingAnswer"), trailingLabel: t("status.compact.answer") };
      break;
    case undefined:
      break;
    default:
      throw new Error("unknown pending interaction: " + String(node.pendingInteraction));
  }
  if (pending !== undefined) return subagents === undefined ? [pending] : [pending, subagents];
  if (node.running) {
    const primary = { state: "ongoing", label: t("status.running") };
    return subagents === undefined ? [primary] : [primary, subagents];
  }
  if (subagents !== undefined) return [subagents];
  if (node.completed) return [{ state: "done", label: t("status.completed") }];
  return [{ state: "idle", label: t("status.idle") }];
}

/**
 * Cham trang thai chinh kem nhan cho trinh doc man hinh, dung chung cho dong tim kiem va dong phien.
 * Nhan: props.statuses — mang trang thai.
 * Tra: node cham trang thai.
 */
export function SessionStatusDots({ statuses }: Dyn): Dyn {
  return hs(fragment(), {
    children: [
      h(ext.primitives.StateDot, { state: statuses[0].state }),
      statuses.map((status: Dyn) => h("span", { className: rowsStyles.visuallyHidden, children: status.label }, status.label)),
    ],
  });
}

/**
 * Dau hieu dong da ghim (khong tuong tac); dong bao quanh van la hanh dong duy nhat.
 * Nhan: props.t — ham dich.
 * Tra: node dau hieu ghim.
 */
export function PinnedIndicator({ t }: Dyn): Dyn {
  const label = t("row.pinned");
  return h("span", { className: rowsStyles.pinIndicator, role: "img", "aria-label": label, title: label, children: h(ext.primitives.IconPinFillRegular, { size: 14 }) });
}

/**
 * Than the hover cua mot dong phien: tieu de day du, thoi gian tuong doi, cho cam cua row khac, va moi trang thai lien quan.
 * Nhan: props.node — node phien; props.now — moc hien tai; props.renderSlot — ham render slot con; props.t — ham dich.
 * Tra: node the hover.
 */
export function SessionHoverContent({ node, now, renderSlot, t }: Dyn): Dyn {
  const statuses = sessionStatuses(node, t).filter((status: Dyn) => !(node.archived && (status.state === "done" || status.state === "idle")));
  return hs("div", {
    className: rowsStyles.hoverContent,
    children: [
      h("div", { className: rowsStyles.hoverTitle, children: displayTitle(node, t) }),
      !node.blank && h("div", { className: rowsStyles.hoverTime, children: hoverTimeLabel(node.updatedAt, now, t) }),
      renderSlot("sidebar.session.row.hover", { sessionId: node.id }),
      statuses.map((status: Dyn) =>
        hs("div", { className: rowsStyles.hoverStatus, children: [h(ext.primitives.StateDot, { state: status.state }), h("span", { children: status.label })] }, status.label),
      ),
      node.archived &&
        hs("div", {
          className: clsx(rowsStyles.hoverStatus, rowsStyles.hoverArchived),
          children: [h(ext.primitives.IconArchiveOutlineRegular, { size: 14 }), h("span", { children: t("row.archived") })],
        }),
    ],
  });
}

/**
 * Mot dong ket qua tim kiem phang: tieu de, ngu canh workspace, va doan trich noi dung neu co.
 * Nhan: props.result — dong ket qua; props.currentId — phien dang chon; props.onOpen — mo phien; props.onUnarchive — bo luu tru; props.t — ham dich.
 * Tra: node dong ket qua.
 */
export function SearchResultItem({ result, currentId, onOpen, onUnarchive, t }: Dyn): Dyn {
  const selected = result.id === currentId;
  const statuses = sessionStatuses(result, t);
  const primaryStatus = statuses[0];
  return hs("div", {
    className: clsx(rowsStyles.searchResultRow, selected && rowsStyles.selected, result.archived && rowsStyles.archived),
    role: "treeitem",
    "aria-selected": selected,
    "aria-description": result.archived ? t("toast.archivedNotOpenable") : undefined,
    onClick: () => {
      onOpen(result.id);
    },
    children: [
      hs("span", {
        className: rowsStyles.searchResultHeading,
        children: [
          h("span", { className: rowsStyles.slot, children: !result.archived && primaryStatus.state !== "idle" && h(SessionStatusDots, { statuses }) }),
          h("span", { className: rowsStyles.searchResultTitle, children: result.title || t("session.untitled") }),
          result.archived &&
            h("span", {
              className: rowsStyles.rowActions,
              children: h(ext.primitives.Tooltip, {
                label: t("actions.unarchive"),
                side: "bottom",
                align: "end",
                delayMs: TOOLTIP_DELAY_MS,
                portal: true,
                children: h("button", {
                  type: "button",
                  className: rowsStyles.iconButton,
                  "aria-label": t("menu.unarchiveSession"),
                  onClick: (e: Dyn) => {
                    e.stopPropagation();
                    onUnarchive(result.id);
                  },
                  children: h(ext.primitives.IconUnarchiveOutlineRegular, { size: 14 }),
                }),
              }),
            }),
        ],
      }),
      hs("span", {
        className: rowsStyles.searchResultMeta,
        children: [
          h("span", { className: rowsStyles.searchResultWorkspace, children: result.workspace || t("group.ungrouped") }),
          result.snippet !== undefined && h("span", { className: rowsStyles.searchResultSnippet, children: result.snippet }),
        ],
      }),
    ],
  });
}

/**
 * Mot dong phien cap cao 32px: o dan dau 16px, tieu de, thoi gian tuong doi, va menu hanh dong cua dong.
 * Nhan: props.node — node phien; props.currentId — phien dang chon; props.now — moc hien tai; props.onOpen/onRenameRequest/renderSlot/onReveal/drag/t — nhu ban goc.
 * Tra: node dong phien.
 */
export function SessionNodeItem({ node, currentId, now, onOpen, onRenameRequest, renderSlot, onReveal, drag, t }: Dyn): Dyn {
  const row = node;
  const title = displayTitle(node, t);
  const selected = node.id === currentId;
  const statuses = sessionStatuses(node, t);
  const primaryStatus = statuses[0];
  const showStatus = primaryStatus.state !== "idle";
  const draggable = drag !== undefined && !row.blank && !row.archived;
  const [menuOpen, setMenuOpen] = ext.react.useState(false);
  const menuOpenState = ext.react.useMemo(() => [menuOpen, setMenuOpen], [menuOpen]);
  const rowRef = ext.react.useRef(null);
  const titleRef = ext.react.useRef(null);
  const marquee = useTitleMarquee(titleRef);
  ext.react.useEffect(() => {
    if (onReveal === undefined) return;
    rowRef.current?.scrollIntoView({ block: "nearest" });
    onReveal();
  }, [onReveal]);
  return h(ext.primitives.HoverCard, {
    anchor: hs("div", {
      ref: rowRef,
      "data-row-key": "session:" + String(node.id),
      className: clsx(
        rowsStyles.sessionRow,
        selected && rowsStyles.selected,
        menuOpen && rowsStyles.menuOpen,
        row.archived && rowsStyles.archived,
        drag?.marker === "before" && rowsStyles.dropBefore,
        drag?.marker === "after" && rowsStyles.dropAfter,
      ),
      role: "treeitem",
      "aria-selected": selected,
      "aria-description": row.archived ? t("toast.archivedNotOpenable") : undefined,
      onClick: () => {
        onOpen(node.id);
      },
      onPointerEnter: marquee.enter,
      onPointerLeave: marquee.leave,
      draggable,
      onDragStart: !draggable
        ? undefined
        : (e: Dyn) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", node.id);
            drag.start();
          },
      onDragEnd: !draggable ? undefined : drag.end,
      onDragOver:
        drag === undefined
          ? undefined
          : (e: Dyn) => {
              if (!drag.active) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              drag.hover(rowHalf(e));
            },
      onDrop:
        drag === undefined
          ? undefined
          : (e: Dyn) => {
              if (!drag.active) return;
              e.preventDefault();
              drag.drop(rowHalf(e));
            },
      children: [
        h("span", { className: rowsStyles.slot, children: !row.archived && !row.blank && (showStatus ? h(SessionStatusDots, { statuses }) : renderSlot("sidebar.session.row.leading", { sessionId: node.id })) }),
        h("span", {
          ref: titleRef,
          className: rowsStyles.title,
          onDoubleClick: row.blank
            ? undefined
            : (e: Dyn) => {
                e.stopPropagation();
                onRenameRequest(node.id, row.title);
              },
          children: title,
        }),
        !row.blank && h("span", { className: rowsStyles.time, "aria-hidden": primaryStatus.trailingLabel === undefined ? undefined : true, children: primaryStatus.trailingLabel ?? timeLabel(row.updatedAt, now, t) }),
        row.pinned && !row.archived && h(PinnedIndicator, { t }),
        !row.blank &&
          hs("span", {
            className: rowsStyles.rowActions,
            onClick: (e: Dyn) => {
              e.stopPropagation();
            },
            children: [
              h(ext.primitives.Menu, {
                open: menuOpen,
                onClose: () => {
                  setMenuOpen(false);
                },
                portal: true,
                closeOnPointerLeave: true,
                anchor: h("button", {
                  type: "button",
                  className: rowsStyles.iconButton,
                  "aria-label": t("actions.session.aria", { name: title }),
                  onClick: () => {
                    setMenuOpen((v: boolean) => !v);
                  },
                  children: h(ext.primitives.IconEllipsisOutlineRegular, {}),
                }),
                children: renderSlot("sidebar.workspaces.session.menu.item", { sessionId: node.id, displayTitle: row.title }, { hookContext: menuOpenState }),
              }),
              renderSlot("sidebar.workspaces.session.row.action", { sessionId: node.id, displayTitle: row.title }),
            ],
          }),
      ],
    }),
    content: h(SessionHoverContent, { node, now, renderSlot, t }),
    openDelayMs: HOVER_CARD_DELAY_MS,
    grouped: true,
    disabled: menuOpen || drag?.active === true,
    copyText: row.blank || row.title === "" ? undefined : row.title,
    copyLabel: t("copy"),
    copiedLabel: t("hover.copied"),
  });
}
