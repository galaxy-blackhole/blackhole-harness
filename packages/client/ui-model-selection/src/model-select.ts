/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc ModelSelect — ghe model cua composer (slot conversation.input.model): menu hai tang model / effort
 */

import { MODEL_SELECT_CLASS } from "./class-names.ts";
import { clsx } from "./clsx.ts";
import { ACCOUNT_PROVIDER_ID, CSS_GLOBAL, PACKAGE_NAME, STYLE_MODEL_SELECT } from "./ids.ts";
import { orderModelProviders } from "./provider-order.ts";
import type {
  CatalogGroup,
  CatalogModel,
  FocusEventLike,
  JsxFn,
  JsxRuntime,
  KeyboardEventLike,
  MouseEventLike,
  Primitives,
  ReactDomLike,
  ReactLike,
  Translator,
} from "./runtime.ts";
import type { ModelSelectInjected, ModelSelection } from "./types.ts";

/** Van ban CSS cua module, do build.ts nhung bang define cua Bun (chay tu nguon thi khong co). */
declare const __GBH_UI_MODEL_SELECTION_MODEL_SELECT_CSS__: string;

/** Bang ten lop da bam cua module CSS (nguyen van ban goc). */
const css = MODEL_SELECT_CLASS;

/** Bang phien ma row nay doc (ten pane cua menu hai tang). */
type Pane = "root" | "model" | "effort";

/** Y dinh tra tieu diem sau khi doi pane: "drill" = vao pane con, con lai = ve o cua pane goc. */
type PaneFocus = "drill" | Pane;

/** Mot lua chon model kem nhom/model goc (dung cho nhan va metadata reasoning). */
interface Choice {
  /** Nhom provider cua model. */
  readonly group: CatalogGroup;
  /** Model trong nhom. */
  readonly model: CatalogModel;
  /** Lua chon day du gui cho Host. */
  readonly selection: ModelSelection;
}

/** Mot muc effort trong pane effort. */
interface EffortChoice {
  /** Khoa on dinh cua muc. */
  readonly key: string;
  /** Id effort (undefined = mac dinh cua provider). */
  readonly effort: string | undefined;
  /** Nhan hien thi. */
  readonly label: string;
}

/** Thuoc tinh ma component ModelSelect nhan (owner share + nghiep vu tiem vao + locale). */
export type ModelSelectProps = ModelSelectInjected & { readonly locked: boolean } & { readonly t: Translator };

/** Phu thuoc runtime ma nha may component can (require trong factory cua loader). */
export interface ModelSelectDeps {
  /** Runtime JSX cua react/jsx-runtime. */
  readonly runtime: JsxRuntime;
  /** Hook React. */
  readonly react: ReactLike;
  /** react-dom (createPortal). */
  readonly reactDom: ReactDomLike;
  /** Bo primitive dung chung cua DSH. */
  readonly primitives: Primitives;
}

/** Unplaced portal card: hidden but laid out at a fixed origin so offsetWidth/offsetHeight are real (Menu primitive's measure pass). */
const MEASURE_STYLE = {
  visibility: "hidden",
  left: 0,
  top: 0,
};

/**
 * Chen the style cua module CSS neu chua co — tagId va dataset.plugin deu la id CUA TA.
 * Nhận: khong co.
 * Trả: khong co.
 */
function injectModelSelectStyle(): void {
  if (typeof document === "undefined") return;
  const cssText = typeof __GBH_UI_MODEL_SELECTION_MODEL_SELECT_CSS__ === "string" ? __GBH_UI_MODEL_SELECTION_MODEL_SELECT_CSS__ : "";
  if (cssText === "") return;
  const tagId = PACKAGE_NAME + "/" + STYLE_MODEL_SELECT;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * Dung component ghe model cua composer.
 *
 * ModelSelect: the composer's named model seat (`conversation.input.model`).
 * Two-level selection per figma 496:26454's MenuDropdown: the root menu is the
 * Model / Effort row pair (label + current value + a right chevron), each
 * drilling into its own list — the provider-grouped model list over the shared
 * directory, and the effort levels.
 * Nhận: deps — runtime JSX, React, react-dom va bo primitive.
 * Trả: component ModelSelect (props: owner share + nghiep vu tiem vao + locale).
 */
export function createModelSelect(deps: ModelSelectDeps): (props: ModelSelectProps) => unknown {
  const { runtime, react, reactDom, primitives } = deps;
  const jsx: JsxFn = runtime.jsx;
  const jsxs: JsxFn = runtime.jsxs;
  const Fragment = runtime.Fragment;
  injectModelSelectStyle();

  /**
   * Render the composer model seat.
   * @param props - owner share (locked) + injected face (shared directory
   * store/verbs) + the standard locale seat.
   * @returns the trigger and, while open, the two-level menu.
   */
  return function ModelSelect({ locked, available, directory, load, select, t }: ModelSelectProps): unknown {
    const state = react.useSyncExternalStore(
      (listener) => directory.subscribe(listener),
      () => directory.getSnapshot(),
    );
    const [open, setOpen] = react.useState(false);
    const [pane, setPane] = react.useState<Pane>("root");
    const [query, setQuery] = react.useState("");
    const [highlightedIndex, setHighlightedIndex] = react.useState<number | null>(null);
    const [selectionFocus, setSelectionFocus] = react.useState(false);
    const lastActionRef = react.useRef<"load" | "select">("load");
    const [toast, setToast] = react.useState<{ readonly seq: number; readonly text: string } | null>(null);
    const toastSeq = react.useRef(0);
    const rootRef = react.useRef<HTMLDivElement | null>(null);
    const triggerRef = react.useRef<HTMLButtonElement | null>(null);
    const searchRef = react.useRef<HTMLInputElement | null>(null);
    const menuRef = react.useRef<HTMLElement | null>(null);
    const groupsRef = react.useRef<HTMLDivElement | null>(null);
    const [menuPos, setMenuPos] = react.useState<{ readonly left: number; readonly top: number } | null>(null);
    const itemRefs = react.useRef<(HTMLButtonElement | null)[]>([]);
    const id = react.useId();
    const groups = react.useMemo(() => orderModelProviders(state.groups), [state.groups]);
    const choices = react.useMemo(
      () =>
        groups.flatMap((group) =>
          group.models.map((model) => ({
            group,
            model,
            selection: {
              provider: group.id,
              model: model.id,
              ...(model.reasoning?.defaultEffort === undefined ? {} : { reasoningEffort: model.reasoning.defaultEffort }),
            },
          })),
        ) as Choice[],
      [groups],
    );
    const showSearch = choices.length > 4;
    const filteredGroups = react.useMemo(
      () =>
        groups
          .map((group) => ({
            ...group,
            models: primitives.rankByName(group.models as CatalogModel[], showSearch ? query.trim() : ""),
          }))
          .filter((group) => group.models.length > 0),
      [groups, query, showSearch],
    );
    const visibleModels = react.useMemo(
      () =>
        filteredGroups.flatMap((group) =>
          group.models.map((model) => ({
            provider: group.id,
            model: model.id,
          })),
        ),
      [filteredGroups],
    );
    const current = state.current;
    const currentVisibleIndex = visibleModels.findIndex(
      (model) => current !== null && model.provider === current.provider && model.model === current.model,
    );
    const activeModelIndex = Math.min(
      highlightedIndex ?? Math.max(0, currentVisibleIndex),
      visibleModels.length - 1,
    );
    const currentChoice =
      choices[
        current === null
          ? -1
          : choices.findIndex((c) => c.selection.provider === current.provider && c.selection.model === current.model)
      ];
    const reasoning = currentChoice?.model.reasoning;
    const effectiveEffort = current?.reasoningEffort ?? reasoning?.defaultEffort;
    const effortLabel =
      currentChoice === undefined
        ? undefined
        : reasoning === undefined
          ? state.retainedEffort
          : effectiveEffort === undefined
            ? t("effort.providerDefault")
            : (reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort);
    const effortChoices = react.useMemo<EffortChoice[]>(
      () =>
        reasoning === undefined
          ? []
          : [
              ...(reasoning.defaultEffort === undefined
                ? [
                    {
                      key: "provider-default",
                      effort: undefined,
                      label: t("effort.providerDefault"),
                    },
                  ]
                : []),
              ...reasoning.efforts.map((effort) => ({
                key: `effort:${effort.id}`,
                effort: effort.id,
                label: effort.name,
              })),
            ],
      [reasoning, t],
    );
    const { pending } = state;
    const busy = pending !== null;
    const reload = (): void => {
      lastActionRef.current = "load";
      load();
    };
    react.useEffect(() => {
      if (!open) return;
      const closeOutside = (event: MouseEventLike): void => {
        if (rootRef.current?.contains(event.target as Node) === true) return;
        if (menuRef.current?.contains(event.target as Node) === true) return;
        setOpen(false);
      };
      document.addEventListener("mousedown", closeOutside);
      return () => {
        document.removeEventListener("mousedown", closeOutside);
      };
    }, [open]);
    react.useLayoutEffect(() => {
      if (!showSearch) {
        setQuery("");
        setHighlightedIndex(null);
      }
    }, [showSearch]);
    const paneFocus = react.useRef<PaneFocus | null>(null);
    const previousShowSearch = react.useRef(showSearch);
    react.useEffect(() => {
      const changedSearchMode = previousShowSearch.current !== showSearch;
      previousShowSearch.current = showSearch;
      const intent = paneFocus.current ?? (changedSearchMode && pane === "model" ? "drill" : null);
      paneFocus.current = null;
      if (!open || intent === null) return;
      if (intent === "drill") {
        if (pane === "model" && showSearch) {
          searchRef.current?.focus();
          return;
        }
        (
          menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]:not([disabled])') ??
          itemRefs.current.find((item) => item !== null && !item.disabled) ??
          triggerRef.current
        )?.focus();
        return;
      }
      const cell = itemRefs.current[intent === "effort" ? 1 : 0];
      (cell !== null && cell !== undefined && !cell.disabled ? cell : triggerRef.current)?.focus();
    }, [open, pane, showSearch]);
    react.useEffect(() => {
      const viewport = groupsRef.current;
      if (viewport === null) return;
      return primitives.observeStickyMenuGroups(viewport);
    }, [available, open, pane, filteredGroups]);
    react.useLayoutEffect(() => {
      if (open && pane === "model" && activeModelIndex >= 0) {
        itemRefs.current[activeModelIndex]?.scrollIntoView({ block: "nearest" });
      }
    }, [open, pane, activeModelIndex, visibleModels]);
    react.useLayoutEffect(() => {
      if (!open) {
        setMenuPos(null);
        return;
      }
      const place = (): void => {
        /* v8 ignore next 2 -- the trigger ref is attached whenever the menu is open. */
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect === undefined) return;
        const MARGIN = 12;
        const lw = menuRef.current?.offsetWidth ?? 0;
        const lh = menuRef.current?.offsetHeight ?? 0;
        let x = rect.right - lw;
        let y = rect.top - 8 - lh;
        if (lw > 0) x = Math.min(Math.max(x, MARGIN), window.innerWidth - lw - MARGIN);
        if (lh > 0) y = Math.min(Math.max(y, MARGIN), window.innerHeight - lh - MARGIN);
        setMenuPos({
          left: x,
          top: y,
        });
      };
      place();
      window.addEventListener("scroll", place, true);
      window.addEventListener("resize", place);
      return () => {
        window.removeEventListener("scroll", place, true);
        window.removeEventListener("resize", place);
      };
    }, [open, pane, state, query]);
    if (!available) return null;
    const show = (): void => {
      setSelectionFocus(false);
      triggerRef.current?.focus();
      setQuery("");
      setHighlightedIndex(null);
      if (currentChoice === undefined) paneFocus.current = "drill";
      setPane(currentChoice === undefined ? "model" : "root");
      setOpen(true);
      reload();
    };
    const changeQuery = (next: string): void => {
      setQuery(next);
      setHighlightedIndex(0);
    };
    const close = (restoreFocus = false): void => {
      setOpen(false);
      setPane("root");
      if (restoreFocus) {
        queueMicrotask(() => {
          triggerRef.current?.focus();
        });
      }
    };
    const closeAfterSelection = (): void => {
      setSelectionFocus(true);
      close(true);
    };
    const drill = (next: Pane): void => {
      setQuery("");
      setHighlightedIndex(null);
      paneFocus.current = "drill";
      setPane(next);
    };
    /**
     * Leave a drilled pane for the root one, handing the keyboard back to its cell.
     * Nhận: from — pane dang roi (o cua pane goc se nhan lai tieu diem).
     * Trả: khong co.
     */
    const back = (from: Pane): void => {
      paneFocus.current = from;
      setPane("root");
    };
    const moveFocus = (offset: number): void => {
      const items = itemRefs.current.filter((item) => item !== null);
      if (items.length === 0) return;
      const active = items.findIndex((item) => item === document.activeElement);
      items[active === -1 ? (offset > 0 ? 0 : items.length - 1) : (active + offset + items.length) % items.length]?.focus();
    };
    /** Tham chieu "pane dang mo dung lai lan chon" — dung cho effect tra tieu diem. */
    const onRootKeyDown = (event: KeyboardEventLike): void => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Escape" && open) {
        event.preventDefault();
        if (pane !== "root" && currentChoice !== undefined) back(pane);
        else close(true);
        return;
      }
      if (!open) return;
      if (pane === "model" && showSearch && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        if (!busy && visibleModels.length > 0) {
          setHighlightedIndex(
            (activeModelIndex + (event.key === "ArrowDown" ? 1 : -1) + visibleModels.length) % visibleModels.length,
          );
          searchRef.current?.focus();
        }
        return;
      }
      if (
        pane === "model" &&
        showSearch &&
        event.target instanceof HTMLInputElement &&
        (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey))
      ) {
        if (event.key === "Tab" && visibleModels.length === 0) return;
        event.preventDefault();
        const highlighted = visibleModels[activeModelIndex];
        if (!busy && highlighted !== undefined) choose(highlighted);
        return;
      }
      if (event.key === "Tab") {
        if (event.shiftKey) {
          event.preventDefault();
          if (pane !== "root" && currentChoice !== undefined) back(pane);
          else close(true);
          return;
        }
        const focused = document.activeElement;
        const rows = itemRefs.current.filter((item) => item !== null);
        if (focused instanceof HTMLButtonElement && rows.includes(focused)) {
          event.preventDefault();
          focused.click();
          return;
        }
        if (focused !== triggerRef.current) return;
        event.preventDefault();
        if (pane === "model" && showSearch) {
          setHighlightedIndex(null);
          searchRef.current?.focus();
          return;
        }
        (
          menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]:not([disabled])') ??
          rows.find((item) => !item.disabled)
        )?.focus();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(event.key === "ArrowDown" ? 1 : -1);
      }
    };
    const onBlur = (event: FocusEventLike): void => {
      if (
        event.relatedTarget instanceof Node &&
        (rootRef.current?.contains(event.relatedTarget) === true ||
          menuRef.current?.contains(event.relatedTarget) === true)
      ) {
        return;
      }
      close();
    };
    const settleSelection = (result: { readonly ok: boolean; readonly error?: { code: string; message: string } } | undefined): void => {
      if (result === undefined) return;
      if (result.ok) {
        if (rootRef.current !== null) closeAfterSelection();
        return;
      }
      const error = result.error as { code: string; message: string };
      toastSeq.current += 1;
      setToast({
        seq: toastSeq.current,
        text:
          error.code === "session/writer-held"
            ? t("error.sessionInUse")
            : t("error.action", { message: `${error.code}: ${error.message}` }),
      });
    };
    const submit = (selection: ModelSelection): void => {
      lastActionRef.current = "select";
      setSelectionFocus(true);
      triggerRef.current?.focus();
      select(selection).then(settleSelection);
    };
    const choose = (selection: ModelSelection): void => {
      if (current?.provider === selection.provider && current.model === selection.model) {
        closeAfterSelection();
        return;
      }
      submit(selection);
    };
    const chooseEffort = (effort: string | undefined): void => {
      if (current === null) return;
      if (effectiveEffort === effort) {
        closeAfterSelection();
        return;
      }
      submit({
        provider: current.provider,
        model: current.model,
        ...(effort === undefined ? {} : { reasoningEffort: effort }),
      });
    };
    const waiting = currentChoice === undefined && state.status === "loading";
    const modelLabel = waiting ? t("trigger.loading") : (currentChoice?.model.name ?? t("trigger.fallback"));
    const triggerLabel = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`;
    const triggerAria = waiting
      ? t("trigger.loading")
      : currentChoice === undefined
        ? t("trigger.selectAria")
        : effortLabel === undefined
          ? t("trigger.aria", { model: modelLabel })
          : t("trigger.ariaEffort", {
              model: modelLabel,
              effort: effortLabel,
            });
    itemRefs.current = [];
    let itemIndex = 0;
    let modelIndex = 0;
    const itemRef = (): ((node: unknown) => void) => {
      const at = itemIndex++;
      return (node: unknown) => {
        itemRefs.current[at] = node as HTMLButtonElement | null;
      };
    };
    return jsxs("div", {
      ref: rootRef,
      className: css.root,
      onKeyDown: onRootKeyDown,
      onBlur,
      onMouseDown: (event: MouseEventLike) => {
        if (event.target instanceof Element && event.target.closest("button") !== null) event.preventDefault();
      },
      children: [
        jsxs("button", {
          ref: triggerRef,
          type: "button",
          className: css.trigger,
          "aria-label": triggerAria,
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": open ? `${id}-menu` : undefined,
          title: triggerLabel,
          "aria-busy": busy,
          "data-selection-focus": selectionFocus ? "" : undefined,
          onBlur: () => {
            setSelectionFocus(false);
          },
          disabled: locked,
          onClick: () => {
            if (open) close(true);
            else show();
          },
          children: [
            jsx(primitives.IconDataOutlineRegular, {
              className: css.triggerIcon,
              size: 16,
            }),
            jsx("span", {
              className: css.triggerLabel,
              children: modelLabel,
            }),
            effortLabel !== undefined &&
              jsx("span", {
                className: css.triggerEffort,
                children: effortLabel,
              }),
            busy
              ? jsx(primitives.StateDot, { state: "ongoing" })
              : jsx(primitives.IconChevronDownOutlineRegular, {
                  className: clsx(css.chevron, open && css.chevronOpen),
                }),
          ],
        }),
        open &&
          reactDom.createPortal(
            jsxs(
              primitives.MenuSurface,
              {
                ref: menuRef,
                id: `${id}-menu`,
                className: css.menu,
                style: menuPos ?? MEASURE_STYLE,
                role: pane === "model" ? "group" : "menu",
                "aria-label": t("menu.aria"),
                "aria-busy": state.status === "loading" || busy,
                children: [
                  pane === "root" &&
                    jsxs(Fragment as never, {
                      children: [
                        jsxs("button", {
                          ref: itemRef(),
                          type: "button",
                          role: "menuitem",
                          className: css.cell,
                          onClick: () => {
                            drill("model");
                          },
                          children: [
                            jsx("span", {
                              className: css.cellLabel,
                              children: t("menu.model"),
                            }),
                            jsx("span", {
                              className: css.cellValue,
                              children: modelLabel,
                            }),
                            jsx(primitives.IconChevronRightOutlineRegular, { className: css.cellChevron }),
                          ],
                        }),
                        reasoning !== undefined &&
                          jsxs("button", {
                            ref: itemRef(),
                            type: "button",
                            role: "menuitem",
                            className: css.cell,
                            onClick: () => {
                              drill("effort");
                            },
                            children: [
                              jsx("span", {
                                className: css.cellLabel,
                                children: t("menu.effort"),
                              }),
                              jsx("span", {
                                className: css.cellValue,
                                children: effortLabel,
                              }),
                              jsx(primitives.IconChevronRightOutlineRegular, { className: css.cellChevron }),
                            ],
                          }),
                      ],
                    }),
                  pane === "model" &&
                    jsxs(Fragment as never, {
                      children: [
                        showSearch &&
                          jsxs("div", {
                            className: css.searchRow,
                            children: [
                              jsx(primitives.Input, {
                                ref: searchRef,
                                className: clsx(css.search, query !== "" && css.searchWithQuery),
                                type: "text",
                                role: "searchbox",
                                "aria-label": t("search.placeholder"),
                                "aria-controls": `${id}-models`,
                                "aria-activedescendant":
                                  activeModelIndex < 0 ? undefined : `${id}-model-${activeModelIndex}`,
                                placeholder: t("search.placeholder"),
                                value: query,
                                readOnly: busy,
                                onChange: (event: { readonly target: { readonly value: string } }) => {
                                  changeQuery(event.target.value);
                                },
                              }),
                              query !== "" &&
                                jsx("button", {
                                  type: "button",
                                  className: css.searchClear,
                                  "aria-label": t("search.clear"),
                                  disabled: busy,
                                  onClick: () => {
                                    changeQuery("");
                                    searchRef.current?.focus();
                                  },
                                  children: jsx(primitives.IconCloseFillRegular, {}),
                                }),
                            ],
                          }),
                        state.status === "loading" &&
                          jsx("div", {
                            className: css.status,
                            children: t("status.loading"),
                          }),
                        state.error !== null &&
                          lastActionRef.current === "load" &&
                          jsxs("div", {
                            className: css.error,
                            children: [
                              jsx("span", { children: t("error.action", { message: state.error }) }),
                              jsx("button", {
                                type: "button",
                                className: css.retry,
                                onClick: reload,
                                children: t("retry"),
                              }),
                            ],
                          }),
                        state.failures.map((failure) =>
                          jsxs(
                            "div",
                            {
                              className: css.warning,
                              children: [
                                jsx("span", {
                                  children: t("warning.groupLoad", {
                                    name: failure.id === ACCOUNT_PROVIDER_ID ? t("provider.account") : failure.name,
                                    message: failure.message,
                                  }),
                                }),
                                jsx("button", {
                                  type: "button",
                                  className: css.retry,
                                  onClick: reload,
                                  children: t("retry"),
                                }),
                              ],
                            },
                            failure.id,
                          ),
                        ),
                        jsx("div", {
                          ref: groupsRef,
                          id: `${id}-models`,
                          className: clsx(css.groups, "scrollable"),
                          role: "menu",
                          "aria-label": t("menu.model"),
                          hidden: filteredGroups.length === 0,
                          children: filteredGroups.map((group) =>
                            jsx(
                              primitives.MenuGroup,
                              {
                                label: group.id === ACCOUNT_PROVIDER_ID ? t("provider.account") : group.name,
                                children: group.models.map((model) => {
                                  const index = modelIndex++;
                                  const selected =
                                    current?.provider === group.id && current.model === model.id;
                                  return jsxs(
                                    "button",
                                    {
                                      ref: itemRef(),
                                      type: "button",
                                      role: "menuitemradio",
                                      "aria-checked": selected,
                                      id: `${id}-model-${index}`,
                                      tabIndex: showSearch ? -1 : 0,
                                      onFocus: () => {
                                        setHighlightedIndex(index);
                                      },
                                      "data-highlighted": index === activeModelIndex ? "" : undefined,
                                      className: clsx(
                                        css.option,
                                        css.modelOption,
                                        selected && css.selected,
                                        index === activeModelIndex && css.optionActive,
                                      ),
                                      onMouseMove:
                                        busy || index === activeModelIndex
                                          ? undefined
                                          : () => {
                                              if (showSearch) setHighlightedIndex(index);
                                              else itemRefs.current[index]?.focus();
                                            },
                                      title: model.name,
                                      disabled: busy,
                                      onClick: () => {
                                        choose({
                                          provider: group.id,
                                          model: model.id,
                                        });
                                      },
                                      children: [
                                        jsx("span", {
                                          className: css.optionCopy,
                                          children: jsx("span", {
                                            className: css.modelName,
                                            children: model.name,
                                          }),
                                        }),
                                        jsx("span", {
                                          className: css.check,
                                          children:
                                            pending?.provider === group.id && pending.model === model.id ? (
                                              jsx(primitives.StateDot, { state: "ongoing" })
                                            ) : selected ? (
                                              jsx(primitives.IconCheckOutlineRegular, {})
                                            ) : null,
                                        }),
                                      ],
                                    },
                                    model.id,
                                  );
                                }),
                              },
                              group.id,
                            ),
                          ),
                        }),
                        state.status === "ready" &&
                          filteredGroups.length === 0 &&
                          jsx("div", {
                            className: css.empty,
                            role: "status",
                            children: t(choices.length === 0 ? "empty.models" : "search.empty"),
                          }),
                      ],
                    }),
                  pane === "effort" &&
                    jsxs(Fragment as never, {
                      children: [
                        state.error !== null &&
                          lastActionRef.current === "load" &&
                          jsxs("div", {
                            className: css.error,
                            children: [
                              jsx("span", { children: t("error.action", { message: state.error }) }),
                              jsx("button", {
                                type: "button",
                                className: css.retry,
                                onClick: reload,
                                children: t("action.reload"),
                              }),
                            ],
                          }),
                        effortChoices.length === 0
                          ? jsx("div", {
                              className: css.empty,
                              children: t("empty.efforts"),
                            })
                          : effortChoices.map((level) =>
                              jsxs(
                                "button",
                                {
                                  ref: itemRef(),
                                  type: "button",
                                  role: "menuitemradio",
                                  "aria-checked": effectiveEffort === level.effort,
                                  className: clsx(
                                    css.option,
                                    effectiveEffort === level.effort && css.selected,
                                  ),
                                  disabled: busy,
                                  onClick: () => {
                                    chooseEffort(level.effort);
                                  },
                                  children: [
                                    jsx("span", {
                                      className: css.optionCopy,
                                      children: jsx("span", {
                                        className: css.modelName,
                                        children: level.label,
                                      }),
                                    }),
                                    jsx("span", {
                                      className: css.check,
                                      children:
                                        pending !== null &&
                                        pending.provider === current?.provider &&
                                        pending.model === current.model &&
                                        pending.reasoningEffort === level.effort ? (
                                          jsx(primitives.StateDot, { state: "ongoing" })
                                        ) : effectiveEffort === level.effort ? (
                                          jsx(primitives.IconCheckOutlineRegular, {})
                                        ) : null,
                                    }),
                                  ],
                                },
                                level.key,
                              ),
                            ),
                      ],
                    }),
                ],
              },
              undefined,
            ),
            document.body,
          ),
        toast !== null &&
          jsx(
            primitives.Toast,
            {
              text: toast.text,
              icon: jsx(primitives.IconWarningOutlineRegular, {}),
              anchor: rootRef.current?.closest("[data-composer-card]") ?? null,
              onDone: () => {
                setToast(null);
              },
            },
            toast.seq,
          ),
      ],
    });
  };
}
