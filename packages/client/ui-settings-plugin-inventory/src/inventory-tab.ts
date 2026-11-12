/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tab kiểm kê plugin (chỉ đọc): danh sách preset phiên trước, mặt phẳng global sau, thẻ mở rộng được
 */

import { CSS, INVENTORY_TAB_CSS } from "./inventory-tab.css.ts";
import {
  PHASE_DOT_STATES,
  TAG_TONES,
  cardLabel,
  entrySubtitle,
  fallbackPreset,
  idAddsToTitle,
  matches,
  phaseLabel,
  pluginText,
  presetLabel,
  showsPhaseDot,
} from "./inventory-model.ts";
import { type InventoryTranslate } from "./locales.ts";
import { type PluginRowLike, type PresetRowLike } from "./preset-display.ts";

/** Hàm dựng phần tử của jsx runtime. */
export interface JsxRuntimeLike {
  /** Một phần tử con. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Nhiều phần tử con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Mảnh rời. */
  Fragment: unknown;
}

/** Module react mà tab này dùng. */
export interface ReactLike {
  /** Id ổn định cho aria-controls. */
  useId(): string;
  /** Trạng thái cục bộ. */
  useState<T>(initial: T): [T, (value: T | ((previous: T) => T)) => void];
  /** Hiệu ứng sau khi vẽ. */
  useEffect(effect: () => undefined | (() => void), deps: unknown[]): void;
  /** Giá trị nhớ theo phụ thuộc. */
  useMemo<T>(factory: () => T, deps: unknown[]): T;
}

/** Primitive của ui-primitives mà tab này dùng. */
export interface TabPrimitivesLike {
  /** Icon mũi xuống. */
  IconChevronDownOutlineRegular: unknown;
  /** Icon kính lúp. */
  IconSearchOutlineRegular: unknown;
  /** Chấm trạng thái. */
  StateDot: unknown;
  /** Nhãn trạng thái. */
  Tag: unknown;
  /** Menu có neo. */
  Menu: unknown;
}

/** Một lần lỗi đồng bộ phía trang. */
export interface ClientSyncFailure {
  /** Id entry lỗi. */
  id: string;
  /** Thông báo lỗi. */
  message: string;
}

/** Ảnh chụp trạng thái đồng bộ phía trang. */
export interface ClientSyncState {
  /** Đang đồng bộ. */
  syncing: boolean;
  /** Các lần lỗi. */
  failures: ClientSyncFailure[];
}

/** Ảnh chụp kiểm kê do Host trả về. */
export interface InventorySnapshot {
  /** Các preset của phiên. */
  agentPresets?: PresetRowLike[];
  /** Các entry ở mặt phẳng global. */
  entries?: PluginRowLike[];
}

/** Props mà renderer của khe cắm bơm cho tab này. */
export interface InventoryTabProps {
  /** Đọc ảnh chụp kiểm kê mới từ Host. */
  list: () => Promise<InventorySnapshot>;
  /** Tên hiển thị của một preset. */
  presetName: (preset: PresetRowLike) => string;
  /** Dịch văn bản cục bộ của gói theo ngôn ngữ đang dùng. */
  resolveText: (text: unknown) => string;
  /** Hàm đọc từ điển đã bind namespace. */
  t: InventoryTranslate;
  /** Hook đọc trạng thái đồng bộ phía trang. */
  useClientSync: <T>(selector: (snapshot: ClientSyncState) => T) => T;
  /** Thử lại đồ thị module phía trang. */
  retryClient: () => void;
}

/**
 * Chèn CSS của tab một lần vào document (không làm gì khi không có document, ví dụ lúc test).
 * Nhận: không.
 * Trả: không.
 */
export function ensureInventoryTabCss(): void {
  if (typeof document === "undefined") return;
  const tagId = "@galaxy-blackhole/gbh-client-ui-settings-plugin-inventory/PluginInventorySettingsTab.module.css";
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-settings-plugin-inventory";
  tag.dataset.pluginCss = tagId;
  tag.textContent = INVENTORY_TAB_CSS;
  document.head.appendChild(tag);
}

/**
 * Dựng hàm render của tab kiểm kê plugin từ các module do bảng module cấp.
 * Nhận: jsx runtime, module react và các primitive của ui-primitives.
 * Trả: hàm render nhận props của renderer.
 */
export function createInventoryTab(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  primitives: TabPrimitivesLike,
): (props: InventoryTabProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;
  /** Bốn thẻ xương lúc đang đọc dữ liệu. */
  const SKELETON_CARDS = [0, 1, 2, 3];

  /**
   * Một thẻ plugin mở rộng được; phần đuôi thẻ do nơi gọi quyết định.
   * Nhận: props của thẻ.
   * Trả: phần tử li.
   */
  const PluginCard = (props: {
    rowKey: string;
    moduleName: string;
    title: string;
    description?: string;
    metadataError?: string;
    entryId: string | null;
    trailing: unknown;
    ariaLabel: string;
    failed: boolean;
    expanded: string | null;
    onToggle: (key: string) => void;
    children: unknown;
  }): unknown => {
    const open = props.expanded === props.rowKey;
    const detailId = "plugin-details-" + encodeURIComponent(props.rowKey);
    const descriptionId = react.useId();
    return jsxs(
      "li",
      {
        className: CSS.card,
        "data-plugin-entry": props.entryId ?? undefined,
        "data-plugin-module": props.moduleName,
        "data-failed": props.failed ? "true" : undefined,
        "data-open": open ? "true" : undefined,
        children: [
          jsxs(
            "button",
            {
              className: CSS.cardContent,
              type: "button",
              "aria-expanded": open,
              "aria-controls": detailId,
              "aria-label": props.ariaLabel,
              "aria-describedby": props.description === undefined ? undefined : descriptionId,
              onClick: () => {
                props.onToggle(props.rowKey);
              },
              children: [
                jsxs("span", {
                  className: CSS.cardMainRow,
                  children: [
                    jsx("strong", { className: CSS.cardTitle, title: props.moduleName, children: props.title }),
                    jsxs("span", {
                      className: CSS.cardTrailing,
                      children: [
                        props.trailing,
                        jsx(primitives.IconChevronDownOutlineRegular, {
                          className: CSS.chevron,
                          size: 12,
                          "aria-hidden": "true",
                        }),
                      ],
                    }),
                  ],
                }),
                props.description === undefined
                  ? null
                  : jsx("span", { className: CSS.cardDescription, id: descriptionId, children: props.description }),
                idAddsToTitle(props.entryId, props.title)
                  ? jsx("span", {
                      className: CSS.cardMeta,
                      children: jsx("code", {
                        className: CSS.cardIdentity,
                        title: props.entryId,
                        children: entrySubtitle(props.entryId as string),
                      }),
                    })
                  : null,
              ],
            },
            "content",
          ),
          props.metadataError === undefined
            ? null
            : jsx("p", {
                className: CSS.brokenNote,
                role: "status",
                "data-package-meta-error": true,
                children: props.metadataError,
              }),
          open ? jsx("div", { className: CSS.cardDetails, id: detailId, children: props.children }) : null,
        ],
      },
    );
  };

  /**
   * Các dòng chi tiết dùng chung cho mọi thẻ: danh tính Loader rồi các cặp nhãn–giá trị.
   * Nhận: tên module, nhãn module, id entry và danh sách sự thật.
   * Trả: mảnh rời gồm code id entry và dl chi tiết.
   */
  const CardFacts = (props: {
    moduleName: string;
    moduleLabel: string;
    entryId: string | null;
    facts: [string, unknown][];
  }): unknown =>
    jsxs(Fragment, {
      children: [
        props.entryId === null
          ? null
          : jsx("code", { className: CSS.entryValue, "data-loader-entry": true, children: props.entryId }),
        jsxs("dl", {
          className: CSS.details,
          children: [
            jsxs("div", {
              children: [
                jsx("dt", { children: props.moduleLabel }),
                jsx("dd", { children: props.moduleName }),
              ],
            }),
            ...props.facts.map(([label, value]) =>
              jsxs(
                "div",
                {
                  children: [jsx("dt", { children: label }), jsx("dd", { children: value })],
                },
                label,
              ),
            ),
          ],
        }),
      ],
    });

  /**
   * Chấm trạng thái kèm tên pha root fiber; dòng không có pha thì không vẽ chấm.
   * Nhận: pha và hàm đọc từ điển.
   * Trả: phần tử span.
   */
  const PhaseDot = (props: { phase: string; t: InventoryTranslate }): unknown => {
    const status = phaseLabel(props.phase, props.t);
    return jsx("span", {
      className: CSS.phaseDot,
      role: "img",
      "aria-label": status,
      title: status,
      children: jsx(primitives.StateDot, { state: PHASE_DOT_STATES[props.phase] }),
    });
  };

  /**
   * Nhãn bật/tắt cho các trạng thái khác mặc định; dòng bật bình thường không có nhãn.
   * Nhận: loại nhãn và chữ.
   * Trả: phần tử Tag, hoặc null.
   */
  const StateTag = (props: { kind: string; label: string }): unknown =>
    props.kind === "enabled"
      ? null
      : jsx(primitives.Tag, { tone: TAG_TONES[props.kind], children: props.label });

  /**
   * Vẽ tab kiểm kê plugin: preset của phiên trước, mặt phẳng global sau.
   * Nhận: props của renderer (đã gồm hàm đọc dữ liệu, bộ chọn preset và từ điển).
   * Trả: phần tử div gốc của tab.
   */
  return (props: InventoryTabProps): unknown => {
    const { list, presetName, resolveText, t, useClientSync, retryClient } = props;
    const clientSync = useClientSync((snapshot) => snapshot);
    const sectionId = react.useId();
    const [request, setRequest] = react.useState(0);
    const [query, setQuery] = react.useState("");
    const [expanded, setExpanded] = react.useState<string | null>(null);
    const [chosenPreset, setChosenPreset] = react.useState<string | null>(null);
    const [switcherOpen, setSwitcherOpen] = react.useState(false);
    const [presetOpen, setPresetOpen] = react.useState<boolean | null>(null);
    const [globalOpen, setGlobalOpen] = react.useState<boolean | null>(null);
    const [state, setState] = react.useState<{ status: "loading" } | { status: "error" } | { status: "ready"; snapshot: InventorySnapshot }>(
      { status: "loading" },
    );
    react.useEffect(() => {
      let current = true;
      Promise.resolve()
        .then(() => list())
        .then(
          (snapshot) => {
            if (current) setState({ status: "ready", snapshot });
          },
          () => {
            if (current) setState({ status: "error" });
          },
        );
      return () => {
        current = false;
      };
    }, [list, request]);
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const searching = normalizedQuery.length > 0;
    const snapshot = state.status === "ready" ? state.snapshot : undefined;
    const presets = snapshot?.agentPresets ?? [];
    const selected = presets.find((preset) => preset.id === chosenPreset) ?? fallbackPreset(presets);
    /** Các preset thật sự bật một module, khoá theo tên module. */
    const enabledIn = react.useMemo(() => {
      const found = new Map<string, PresetRowLike[]>();
      for (const preset of presets) {
        for (const row of preset.rows) {
          if (row.enabled !== true) continue;
          const groups = found.get(row.moduleName);
          if (groups === undefined) found.set(row.moduleName, [preset]);
          else if (!groups.includes(preset)) groups.push(preset);
        }
      }
      return found;
    }, [presets]);
    const entries = snapshot?.entries ?? [];
    const failedEntries: PluginRowLike[] = [];
    const regularEntries: PluginRowLike[] = [];
    for (const entry of entries) {
      if (entry.fiberPhase === "failed") failedEntries.push(entry);
      else regularEntries.push(entry);
    }
    const entryMatch = (entry: PluginRowLike): boolean => matches(entry, normalizedQuery, resolveText);
    const rowMatch = (row: PluginRowLike): boolean => matches(row, normalizedQuery, resolveText);
    const filteredFailed = failedEntries.filter(entryMatch);
    const filteredRegular = regularEntries.filter(entryMatch);
    const globalCount = filteredFailed.length + filteredRegular.length;
    const selectedRows = selected === undefined ? [] : selected.rows.filter(rowMatch);
    const otherPresetMatches = searching
      ? presets.filter((preset) => preset !== selected && preset.rows.some(rowMatch))
      : [];
    const otherMatchCount = otherPresetMatches.reduce(
      (total, preset) => total + preset.rows.filter(rowMatch).length,
      0,
    );
    const presetEffectiveOpen = searching || (presetOpen ?? true);
    const globalEffectiveOpen = searching || (globalOpen ?? false);
    const nothingMatches =
      searching && globalCount === 0 && selectedRows.length === 0 && otherPresetMatches.length === 0;
    /** Đọc lại kiểm kê từ Host. */
    const retry = (): void => {
      setState({ status: "loading" });
      setRequest((value) => value + 1);
    };
    /** Mở/đóng một thẻ. */
    const toggleRow = (key: string): void => {
      setExpanded((current) => (current === key ? null : key));
    };
    /**
     * Đuôi thẻ và các dòng chi tiết cho một dòng của preset đang chọn.
     * Nhận: preset, dòng và chỉ số.
     * Trả: phần tử thẻ.
     */
    const presetRowCard = (preset: PresetRowLike, row: PluginRowLike, index: number): unknown => {
      const key = "preset:" + preset.id + ":" + String(index);
      const { title, description } = pluginText(row, resolveText);
      const failed = row.fiberPhase === "failed";
      const stateText = failed
        ? t("failedTag")
        : row.enabled === true
          ? t("enabledTag")
          : row.enabled === false
            ? t("disabledTag")
            : t("conditionalTag");
      const kind = failed ? "failed" : row.enabled === true ? "enabled" : row.enabled === false ? "disabled" : "conditional";
      return jsx(
        PluginCard,
        {
          rowKey: key,
          moduleName: row.moduleName,
          title,
          description,
          metadataError: row.meta?.error === undefined ? undefined : t("metadataError", { error: row.meta.error }),
          entryId: row.entryId,
          failed,
          expanded,
          onToggle: toggleRow,
          ariaLabel: cardLabel(title, row.entryId, stateText),
          trailing: jsxs(Fragment, {
            children: [
              row.enabled === true && showsPhaseDot(row.fiberPhase)
                ? jsx(PhaseDot, { phase: row.fiberPhase, t })
                : null,
              jsx(StateTag, { kind, label: stateText }),
            ],
          }),
          children: jsx(CardFacts, {
            moduleName: row.moduleName,
            moduleLabel: t("moduleLabel"),
            entryId: row.entryId,
            facts: [
              [t("fromPreset"), presetName(preset)],
              [t("configuration"), stateText],
              ...(row.fiberPhase === null ? [] : [[t("runtime"), phaseLabel(row.fiberPhase, t)]] as [string, unknown][]),
              ...(row.condition === undefined
                ? []
                : ([[t("condition"), jsx("code", { children: row.condition }, "condition")]] as [string, unknown][])),
            ],
          }),
        },
        key,
      );
    };
    /**
     * Một dòng ở mặt phẳng global; dòng do preset cấp thì kèm tên các preset bật nó.
     * Nhận: entry và (nếu có) danh sách preset bật nó.
     * Trả: phần tử thẻ.
     */
    const globalRowCard = (entry: PluginRowLike, providers?: PresetRowLike[]): unknown => {
      const key = "global:" + String(entry.entryId);
      const { title, description } = pluginText(entry, resolveText);
      const failed = entry.fiberPhase === "failed";
      const stateText = failed
        ? t("failedTag")
        : providers !== undefined
          ? t("presetEnabledTag")
          : t(entry.enabled === true ? "enabledTag" : "disabledTag");
      const kind = failed ? "failed" : providers !== undefined ? "preset" : entry.enabled === true ? "enabled" : "disabled";
      return jsx(
        PluginCard,
        {
          rowKey: key,
          moduleName: entry.moduleName,
          title,
          description,
          metadataError: entry.meta?.error === undefined ? undefined : t("metadataError", { error: entry.meta.error }),
          entryId: entry.entryId,
          failed,
          expanded,
          onToggle: toggleRow,
          ariaLabel: cardLabel(title, entry.entryId, stateText),
          trailing: jsxs(Fragment, {
            children: [
              entry.enabled === true && showsPhaseDot(entry.fiberPhase)
                ? jsx(PhaseDot, { phase: entry.fiberPhase, t })
                : null,
              jsx(StateTag, { kind, label: stateText }),
            ],
          }),
          children: jsx(CardFacts, {
            moduleName: entry.moduleName,
            moduleLabel: t("moduleLabel"),
            entryId: entry.entryId,
            facts:
              providers !== undefined
                ? [
                    [t("configuration"), t("presetProvidedDetail")],
                    [t("enabledIn"), providers.map((preset) => presetName(preset)).join(" · ")],
                  ]
                : [
                    [t("configuration"), t(entry.enabled === true ? "enabledTag" : "disabledTag")],
                    ...(entry.enabled === true
                      ? ([[t("runtime"), phaseLabel(entry.fiberPhase, t)]] as [string, unknown][])
                      : []),
                  ],
          }),
        },
        key,
      );
    };
    return jsxs("div", {
      className: CSS.section,
      "aria-busy": state.status === "loading",
      children: [
        clientSync.syncing
          ? jsxs("p", {
              className: CSS.status + " " + CSS.statusWithDot,
              role: "status",
              children: [jsx(primitives.StateDot, { state: "ongoing" }), t("clientSyncing")],
            })
          : null,
        clientSync.failures.length === 0
          ? null
          : jsxs("div", {
              className: CSS.failure,
              "data-client-sync-failure": true,
              children: [
                jsxs("p", {
                  className: CSS.statusWithDot,
                  role: "alert",
                  children: [jsx(primitives.StateDot, { state: "error" }), t("clientSyncFailed")],
                }),
                jsx("ul", {
                  children: clientSync.failures.map((failure) =>
                    jsxs("li", { children: [failure.id, ": ", failure.message] }, failure.id),
                  ),
                }),
                jsx("button", {
                  type: "button",
                  disabled: clientSync.syncing,
                  onClick: retryClient,
                  children: t("clientSyncRetry"),
                }),
              ],
            }),
        state.status === "loading"
          ? jsxs("div", {
              className: CSS.cards,
              role: "status",
              children: [
                jsx("span", { className: CSS.visuallyHidden, children: t("loading") }),
                ...SKELETON_CARDS.map((slot) =>
                  jsxs(
                    "div",
                    {
                      className: CSS.skeletonCard,
                      "aria-hidden": "true",
                      children: [
                        jsx("span", { className: CSS.skeletonBar }),
                        jsx("span", { className: CSS.skeletonBar }),
                      ],
                    },
                    slot,
                  ),
                ),
              ],
            })
          : null,
        state.status === "error"
          ? jsxs("div", {
              className: CSS.failure,
              children: [
                jsxs("p", {
                  className: CSS.statusWithDot,
                  role: "alert",
                  children: [jsx(primitives.StateDot, { state: "error" }), t("error")],
                }),
                jsx("button", { type: "button", onClick: retry, children: t("retry") }),
              ],
            })
          : null,
        snapshot !== undefined
          ? jsxs("div", {
              className: CSS.catalog,
              children: [
                jsxs("label", {
                  className: CSS.search,
                  children: [
                    jsx(primitives.IconSearchOutlineRegular, { "aria-hidden": "true" }),
                    jsx("span", { className: CSS.visuallyHidden, children: t("search") }),
                    jsx("input", {
                      type: "search",
                      value: query,
                      placeholder: t("search"),
                      "aria-label": t("search"),
                      onChange: (event: { currentTarget: { value: string } }) => {
                        setQuery(event.currentTarget.value);
                      },
                    }),
                  ],
                }),
                entries.length === 0 && presets.length === 0
                  ? jsx("p", { className: CSS.status, children: t("empty") })
                  : null,
                nothingMatches ? jsx("p", { className: CSS.status, children: t("emptySearch") }) : null,
                selected !== undefined
                  ? jsxs("section", {
                      className: CSS.group,
                      "data-plugin-scope": "preset",
                      "data-preset-id": selected.id,
                      children: [
                        jsxs("div", {
                          className: CSS.groupTitleRow,
                          children: [
                            jsxs("button", {
                              type: "button",
                              className: CSS.groupToggle,
                              "aria-expanded": presetEffectiveOpen,
                              "aria-controls": sectionId + "-preset",
                              onClick: () => {
                                setPresetOpen(!presetEffectiveOpen);
                              },
                              children: [
                                jsx(primitives.IconChevronDownOutlineRegular, {
                                  className: CSS.chevron,
                                  size: 12,
                                  "aria-hidden": "true",
                                }),
                                jsx("span", { className: CSS.groupTitle, children: t("presetTitle") }),
                              ],
                            }),
                            jsx("div", {
                              className: CSS.headerEnd,
                              children: jsx(primitives.Menu, {
                                open: switcherOpen,
                                onClose: () => {
                                  setSwitcherOpen(false);
                                },
                                items: presets.map((preset) => ({
                                  id: preset.id,
                                  label: presetLabel(preset, t, presetName),
                                })),
                                selectedId: selected.id,
                                onSelect: (id: string) => {
                                  setSwitcherOpen(false);
                                  setChosenPreset(id);
                                },
                                align: "end",
                                portal: true,
                                anchor: jsxs("button", {
                                  type: "button",
                                  className: CSS.switcher,
                                  "aria-haspopup": "menu",
                                  "aria-expanded": switcherOpen,
                                  "aria-label": t("switcherLabel"),
                                  onClick: () => {
                                    setSwitcherOpen((value) => !value);
                                  },
                                  children: [
                                    jsx("span", {
                                      className: CSS.switcherLabel,
                                      children: presetLabel(selected, t, presetName),
                                    }),
                                    jsx(primitives.IconChevronDownOutlineRegular, {
                                      className: CSS.chevron,
                                      "aria-hidden": "true",
                                    }),
                                  ],
                                }),
                              }),
                            }),
                          ],
                        }),
                        jsx("p", { className: CSS.groupSub, children: t("presetSubtitle") }),
                        presetEffectiveOpen
                          ? jsxs("div", {
                              id: sectionId + "-preset",
                              className: CSS.groupBody,
                              children: [
                                selected.broken === undefined
                                  ? null
                                  : jsx("p", { className: CSS.brokenNote, role: "alert", children: selected.broken }),
                                selectedRows.length > 0
                                  ? jsx("ul", {
                                      className: CSS.cards,
                                      children: selectedRows.map((row, index) => presetRowCard(selected, row, index)),
                                    })
                                  : null,
                                otherMatchCount > 0
                                  ? jsxs("p", {
                                      className: CSS.hint,
                                      children: [
                                        t("matchesInOtherPresets", { count: String(otherMatchCount) }),
                                        ...otherPresetMatches.map((preset) =>
                                          jsx(
                                            "button",
                                            {
                                              type: "button",
                                              className: CSS.jumpLink,
                                              onClick: () => {
                                                setChosenPreset(preset.id);
                                              },
                                              children: presetName(preset),
                                            },
                                            preset.id,
                                          ),
                                        ),
                                      ],
                                    })
                                  : null,
                              ],
                            })
                          : null,
                      ],
                    })
                  : null,
                entries.length > 0
                  ? jsxs("section", {
                      className: CSS.group,
                      "data-plugin-scope": "global",
                      children: [
                        jsx("div", {
                          className: CSS.groupTitleRow,
                          children: jsxs("button", {
                            type: "button",
                            className: CSS.groupToggle,
                            "aria-expanded": globalEffectiveOpen,
                            "aria-controls": sectionId + "-global",
                            onClick: () => {
                              setGlobalOpen(!globalEffectiveOpen);
                            },
                            children: [
                              jsx(primitives.IconChevronDownOutlineRegular, {
                                className: CSS.chevron,
                                size: 12,
                                "aria-hidden": "true",
                              }),
                              jsx("span", { className: CSS.groupTitle, children: t("globalTitle") }),
                            ],
                          }),
                        }),
                        jsx("p", { className: CSS.groupSub, children: t("globalSubtitle") }),
                        globalEffectiveOpen && globalCount > 0
                          ? jsxs("ul", {
                              className: CSS.cards,
                              id: sectionId + "-global",
                              children: [
                                ...filteredFailed.map((entry) => globalRowCard(entry)),
                                ...filteredRegular.map((entry) =>
                                  globalRowCard(entry, entry.enabled === true ? undefined : enabledIn.get(entry.moduleName)),
                                ),
                              ],
                            })
                          : null,
                      ],
                    })
                  : null,
              ],
            })
          : null,
      ],
    });
  };
}
