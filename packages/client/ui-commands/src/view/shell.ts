/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Vo the chon popupSelect: giu tieu diem khi mo, loc cuc bo, va dong khi bam ra ngoai
 */

import { MAX_HEIGHT } from "../ids.ts";
import { groupOptions } from "../option-groups.ts";
import { filterOptions, type PopupSelectController } from "../popup.ts";
import type { JsxRuntimeLike, PopupStateLike, PrimitivesLike, ReactHooksLike, SelectOptionLike, Translate } from "../types.ts";
import { createConfirmation } from "./confirmation.ts";
import { CLASS } from "./css.ts";
import { createOptionRow } from "./option-row.ts";

/** Mat nghiep vu ma tang noi phien tiem vao the. */
export interface PopupSelectInjectedLike {
  /** Bo dieu khien the cua phien (kho trang thai + dong tu; khong cham tới kieu context luc mo). */
  readonly popup: PopupSelectController<never>;
}

/** Props day du cua the: mat tiem vao + cho ngoi tu dien. */
export type PopupSelectViewPropsLike = PopupSelectInjectedLike & { readonly t: Translate };

/**
 * Dung thanh phan the chon popupSelect.
 * Nhan: runtime — react/jsx-runtime; react — hook React; primitives — seam ui-primitives.
 * Tra: ham component PopupSelectView(props) -> node (card khi mo, null khi dong).
 */
export function createPopupSelectView(
  runtime: JsxRuntimeLike,
  react: ReactHooksLike,
  primitives: PrimitivesLike,
): (props: PopupSelectViewPropsLike) => unknown {
  const renderOption = createOptionRow(runtime, primitives);
  const renderConfirmation = createConfirmation(runtime, primitives);

  return function PopupSelectView(props: PopupSelectViewPropsLike): unknown {
    const { popup, t } = props;
    const state = react.useSyncExternalStore(
      (onChange: () => void) => popup.state.subscribe(onChange),
      () => popup.state.getSnapshot(),
    ) as PopupStateLike;
    const cardRef = react.useRef<HTMLElement | null>(null);
    const searchRef = react.useRef<HTMLInputElement | null>(null);
    const viewportRef = react.useRef<HTMLElement | null>(null);
    const rows = react.useMemo(
      () => filterOptions(state.options, state.search, state.searchMode, primitives.rankByName),
      [state.options, state.search, state.searchMode],
    );
    const groups = react.useMemo(() => groupOptions(rows), [rows]);
    react.useEffect(() => {
      const viewport = viewportRef.current;
      if (viewport === null) return;
      return primitives.observeStickyMenuGroups(viewport);
    }, [state.open, state.status, state.confirming, groups]);
    const maxHeight = primitives.useAnchoredMaxHeight(cardRef, MAX_HEIGHT, state);
    const active = state.open ? state.active : null;
    react.useEffect(() => {
      if (active === null) return;
      cardRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    }, [active, rows, state.confirming]);
    react.useEffect(() => {
      if (!state.open || state.confirming !== null) return;
      const onPointerDown = (ev: PointerEvent): void => {
        if (cardRef.current !== null && ev.target instanceof Node && cardRef.current.contains(ev.target)) return;
        popup.dismiss();
      };
      document.addEventListener("pointerdown", onPointerDown, true);
      return () => {
        document.removeEventListener("pointerdown", onPointerDown, true);
      };
    }, [state.open, state.confirming, popup]);
    react.useEffect(() => {
      if (state.open && state.confirming === null) searchRef.current?.focus();
    }, [state.open, state.confirming]);
    if (!state.open) return null;
    const confirmation = state.confirming?.confirmation;
    const emptyLabel =
      state.searchLabels === null ? t("status.empty") : state.options.length === 0 ? state.searchLabels.empty : state.searchLabels.noResults;
    const onKeyDown = (ev: KeyboardEvent): void => {
      switch (ev.key) {
        case "ArrowDown":
          ev.preventDefault();
          popup.move(1);
          return;
        case "ArrowUp":
          ev.preventDefault();
          popup.move(-1);
          return;
        case "Enter":
          ev.preventDefault();
          void popup.select(state.active);
          return;
        case "Tab":
          if (!ev.shiftKey && (state.status !== "ready" || rows.length === 0)) return;
          ev.preventDefault();
          if (ev.shiftKey) popup.dismiss({ focusComposer: true });
          else void popup.select(state.active);
          return;
        case "Escape":
          ev.preventDefault();
          popup.dismiss({ focusComposer: true });
          return;
        default:
      }
    };
    let optionIndex = 0;
    return runtime.jsxs(
      runtime.Fragment,
      {
        children: [
          state.confirming === null &&
            runtime.jsxs(
              primitives.MenuSurface,
              {
                ref: cardRef,
                className: CLASS.card,
                style: { maxHeight },
                "aria-label": t("overlay.aria", { command: String(state.command) }),
                onKeyDown,
                children: [
                  runtime.jsx(
                    "input",
                    {
                      ref: searchRef,
                      className: CLASS.search,
                      type: "text",
                      placeholder: state.searchLabels?.placeholder ?? t("search.placeholder"),
                      "aria-label": t("search.aria"),
                      value: state.search,
                      readOnly: state.submitting,
                      onChange: (ev: { currentTarget: { value: string } }): void => {
                        popup.setSearch(ev.currentTarget.value);
                      },
                    },
                    undefined,
                  ),
                  state.error !== null &&
                    runtime.jsxs(
                      "div",
                      {
                        className: CLASS.error,
                        role: "alert",
                        children: [
                          runtime.jsx("span", { className: CLASS.errorText, children: state.error }, undefined),
                          state.status === "failed" &&
                            runtime.jsx(
                              "button",
                              {
                                type: "button",
                                className: CLASS.retry,
                                onClick: (): void => {
                                  popup.retry();
                                },
                                children: t("retry"),
                              },
                              undefined,
                            ),
                        ],
                      },
                      undefined,
                    ),
                  state.status === "pending" && runtime.jsx("div", { className: CLASS.status, children: t("status.loading") }, undefined),
                  state.submitting && runtime.jsx("div", { className: CLASS.status, children: t("status.applying") }, undefined),
                  state.status === "ready" && rows.length === 0 && runtime.jsx("div", { className: CLASS.status, children: emptyLabel }, undefined),
                  state.status === "ready" &&
                    runtime.jsx(
                      "div",
                      {
                        ref: viewportRef,
                        role: "listbox",
                        "aria-label": t("listbox.aria", { command: String(state.command) }),
                        className: CLASS.viewport,
                        children: groups.map(({ group, rows: groupRows }) =>
                          group === undefined
                            ? runtime.jsx(react.Fragment, { children: groupRows.map((option: SelectOptionLike) => renderOption(option, optionIndex++, state.active, popup)) }, "ungrouped")
                            : runtime.jsx(
                                primitives.MenuGroup,
                                {
                                  label: group.label,
                                  children: groupRows.map((option: SelectOptionLike) => renderOption(option, optionIndex++, state.active, popup)),
                                },
                                "group:" + group.name,
                              ),
                        ),
                      },
                      undefined,
                    ),
                ],
              },
              undefined,
            ),
          state.confirming !== null && renderConfirmation(state, popup, t),
        ],
      },
      undefined,
    );
  };
}
