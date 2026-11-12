/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng lib/types/client/MenuView.js của bản gốc — menu ứng viên (overlay ô nhập), giữ NGUYÊN VĂN cây element
 */

import { MAX_MENU_HEIGHT, MENU_TOP_MARGIN, OPTION_ID_PREFIX } from "./ids.ts";
import { clsx } from "./clsx.ts";
import { MENU_STYLES as styles } from "./menu-css.ts";
import type { JsxRuntimeLike, MenuViewProps, PrimitivesLike, ReactLike } from "./types.ts";

/** Phần tử DOM tối thiểu mà menu đọc (vùng cuộn). */
interface ViewportLike {
  /** Vị trí cuộn hiện tại. */
  scrollTop: number;
  /** Chiều cao nhìn thấy. */
  clientHeight: number;
  /** Chiều cao toàn phần. */
  scrollHeight: number;
}

/**
 * DOM id của một dòng ứng viên (đích của aria-activedescendant).
 * Nhận: source - tên nguồn; index - chỉ số ứng viên.
 * Trả: chuỗi id.
 */
function optionId(source: string, index: number): string {
  return `${OPTION_ID_PREFIX}${source}-${index}`;
}

/**
 * Dựng component MenuView của menu ứng viên.
 * Nhận: runtime - jsx runtime; react - phần React cần dùng; primitives - phần ui-primitives cần dùng.
 * Trả: component nhận props của renderer (mặt inject + ghế từ điển).
 */
export function makeMenuView(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  primitives: PrimitivesLike,
): (props: MenuViewProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;
  const MenuSurface = primitives.MenuSurface;
  const IconChevronRightOutlineRegular = primitives.IconChevronRightOutlineRegular;
  const ReferenceIconRegular = primitives.ReferenceIconRegular;
  const useAnchoredMaxHeight = primitives.useAnchoredMaxHeight;

  /**
   * Menu ứng viên của trigger: vẽ store menu của InputTriggerService vào neo overlay của ô nhập.
   * Trạng thái đóng vẽ null (slot overlay vẫn mounted); các nhóm vẽ theo thứ tự roster dưới dòng
   * tiêu đề đã bản địa hoá. Nhóm đang chờ vẫn hiện các dòng đã có và chỉ rơi về hai dòng xương khi
   * chưa có dòng nào; pick bằng con trỏ định tuyến ngược qua controller (mẫu combobox — focus không
   * rời textarea, nên các dòng xử lý mousedown và tô sáng lộ qua aria-activedescendant trên listbox).
   * Nhận: props - mặt inject (store menu, store breadcrumb, các tuyến pick) và ghế từ điển t.
   * Trả: dropdown khi mở; null khi đóng.
   */
  return function MenuView({ menu, headers, onPick, onCrumb, onHover, onDismiss, t }: MenuViewProps): unknown {
    const state = react.useSyncExternalStore(
      (fn) => menu.subscribe(fn),
      () => menu.getSnapshot(),
    );
    const crumbs = react.useSyncExternalStore(
      (fn) => headers.subscribe(fn),
      () => headers.getSnapshot(),
    );
    const listRef = react.useRef<Element | null>(null);
    const viewportRef = react.useRef<ViewportLike | null>(null);
    const [hasOverflowBelow, setHasOverflowBelow] = react.useState(false);
    const maxHeight = useAnchoredMaxHeight(listRef, MAX_MENU_HEIGHT, state, MENU_TOP_MARGIN);
    const updateOverflowHint = react.useCallback(() => {
      const viewport = viewportRef.current;
      setHasOverflowBelow(
        viewport !== null && viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1,
      );
    }, []);
    react.useLayoutEffect(() => {
      updateOverflowHint();
    }, [state, maxHeight, updateOverflowHint]);
    const highlight = state.open ? state.highlight : null;
    react.useEffect(() => {
      if (highlight === null) return;
      document.getElementById(optionId(highlight.source, highlight.index))?.scrollIntoView({ block: "nearest" });
    }, [highlight]);
    react.useEffect(() => {
      if (!state.open) return;
      const onPointerDown = (ev: PointerEvent): void => {
        if (!(ev.target instanceof Node)) return;
        if (listRef.current?.contains(ev.target)) return;
        if (listRef.current?.closest("[data-composer-card]")?.contains(ev.target)) return;
        onDismiss();
      };
      document.addEventListener("pointerdown", onPointerDown, true);
      return () => {
        document.removeEventListener("pointerdown", onPointerDown, true);
      };
    }, [state.open, onDismiss]);
    if (!state.open) return null;
    return jsxs(MenuSurface, {
      ref: listRef,
      className: styles.menu,
      style: { maxHeight },
      "data-trigger-menu": "",
      "data-overflow-below": hasOverflowBelow || undefined,
      children: [
        state.groups.map((group) => {
          const trail = crumbs.get(group.source);
          return trail === undefined
            ? null
            : jsx(
                "nav",
                {
                  className: styles.crumbs,
                  "aria-label": t("crumbs.aria"),
                  children: trail.map((crumb, index) =>
                    jsxs(
                      Fragment,
                      {
                        children: [
                          index > 0 &&
                            jsx("span", {
                              className: styles.crumbSeparator,
                              "aria-hidden": true,
                              children: jsx(IconChevronRightOutlineRegular, {}),
                            }),
                          jsx("button", {
                            type: "button",
                            className: clsx(styles.crumb, crumb.current === true && styles.crumbCurrent),
                            "aria-current": crumb.current === true ? "location" : undefined,
                            disabled: crumb.current === true,
                            onMouseDown: (ev: MouseEvent) => {
                              ev.preventDefault();
                              onCrumb(group.source, index);
                            },
                            children: crumb.label,
                          }),
                        ],
                      },
                      `${String(index)}-${crumb.value}`,
                    ),
                  ),
                },
                group.source,
              );
        }),
        jsx("div", {
          ref: viewportRef,
          className: styles.viewport,
          role: "listbox",
          "aria-label": t("suggestions.aria"),
          "aria-activedescendant": highlight !== null ? optionId(highlight.source, highlight.index) : undefined,
          onScroll: updateOverflowHint,
          children: state.groups.map((group) =>
            group.status === "ready" && group.items.length === 0
              ? null
              : jsxs(
                  Fragment,
                  {
                    children: [
                      group.showGroupTitle === false || group.items.some((item) => item.section !== undefined)
                        ? null
                        : jsx("div", {
                            className: styles.groupTitle,
                            role: "presentation",
                            "data-source": group.source,
                            children: t(group.source),
                          }),
                      group.status === "pending" && group.items.length === 0
                        ? jsxs("div", {
                            role: "status",
                            "aria-label": t("loading"),
                            "data-source": group.source,
                            children: [
                              jsx("div", {
                                className: styles.skeletonRow,
                                children: jsx("span", {
                                  className: styles.skeletonBar,
                                  style: { width: "32%" },
                                }),
                              }),
                              jsx("div", {
                                className: styles.skeletonRow,
                                children: jsx("span", {
                                  className: styles.skeletonBar,
                                  style: { width: "48%" },
                                }),
                              }),
                            ],
                          })
                        : group.items.map((item, index) => {
                            const active =
                              highlight !== null && highlight.source === group.source && highlight.index === index;
                            return jsxs(
                              Fragment,
                              {
                                children: [
                                  item.section !== undefined && item.section !== group.items[index - 1]?.section
                                    ? jsx("div", {
                                        className: styles.sectionTitle,
                                        role: "presentation",
                                        children: item.section,
                                      })
                                    : null,
                                  jsxs(
                                    "button",
                                    {
                                      id: optionId(group.source, index),
                                      type: "button",
                                      role: "option",
                                      "aria-selected": active,
                                      className: clsx(styles.item, active && styles.active),
                                      onMouseDown: (ev: MouseEvent) => {
                                        ev.preventDefault();
                                        onPick(group.source, index);
                                      },
                                      onMouseMove: active
                                        ? undefined
                                        : () => {
                                            onHover(group.source, index);
                                          },
                                      children: [
                                        item.icon !== undefined &&
                                          jsx("span", {
                                            className: styles.itemIcon,
                                            "aria-hidden": true,
                                            children:
                                              typeof item.icon === "string"
                                                ? jsx(ReferenceIconRegular, {
                                                    kind: item.icon,
                                                    size: 14,
                                                  })
                                                : jsx(item.icon, { size: 14 }),
                                          }),
                                        jsx("span", {
                                          className: styles.itemName,
                                          children: item.label ?? item.name,
                                        }),
                                        item.label !== undefined &&
                                          item.label.toLowerCase() !== item.name.toLowerCase() &&
                                          jsx("span", {
                                            className: styles.itemAlias,
                                            children: item.name,
                                          }),
                                        item.description !== undefined &&
                                          jsx("span", {
                                            className: styles.itemDescription,
                                            children: item.description,
                                          }),
                                        item.drill === true &&
                                          jsxs("span", {
                                            className: styles.trailing,
                                            children: [
                                              jsx("span", {
                                                className: styles.drillHintText,
                                                "aria-hidden": true,
                                                children: t("drill.hint"),
                                              }),
                                              jsx("kbd", {
                                                className: styles.drillHint,
                                                "aria-hidden": true,
                                                children: t("drill.key"),
                                              }),
                                              jsx("span", {
                                                role: "button",
                                                "aria-label": t("drill.aria"),
                                                className: styles.drill,
                                                onMouseDown: (ev: MouseEvent) => {
                                                  ev.preventDefault();
                                                  ev.stopPropagation();
                                                  onPick(group.source, index, "drill");
                                                },
                                                children: jsx(IconChevronRightOutlineRegular, { size: 12 }),
                                              }),
                                            ],
                                          }),
                                      ],
                                    },
                                  ),
                                ],
                              },
                              optionId(group.source, index),
                            );
                          }),
                    ],
                  },
                  group.source,
                ),
          ),
        }),
      ],
    });
  };
}
