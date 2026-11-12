/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tab Discover của trang Plugins: thanh công cụ, danh sách, trang chi tiết, hộp thoại nguồn và xác nhận
 */

import { failureKey, type CardsApi, type ViewDeps } from "./discover-cards.ts";
import { ICON } from "./discover-cards.ts";
import {
  displayDeclarations,
  indexLabel,
  sortMenuId,
  sourceFacts,
  unfiltered,
  withText,
  type DisplayDeclaration,
} from "./presentation.ts";
import type { PluginMarketTranslate } from "./locales.ts";
import type {
  DiscoverFaceLike,
  DiscoverSectionPropsLike,
  MarketDeclarationLike,
  MarketDiscoverStateLike,
  MarketEntryLike,
  MarketListingStateLike,
  MarketSearchResultLike,
  MarketSortLike,
  MarketVersionLike,
  SourceFailure,
} from "./types.ts";

/** Độ trễ gõ phím trước khi gửi văn bản truy vấn (ms). */
export const TEXT_DELAY_MS = 250;

/** Một lựa chọn trên menu sắp xếp. */
interface SortOption {
  /** Id trên menu. */
  readonly id: string;
  /** Nhãn đã dịch. */
  readonly label: string;
}

/** Một lựa chọn cài đang chờ người dùng xác nhận. */
interface InstallChoice {
  /** Plugin định cài. */
  readonly entry: MarketEntryLike;
  /** Phiên bản định cài. */
  readonly version: MarketVersionLike;
}

/** Phụ thuộc của tab: runtime + bộ nguyên thuỷ + bảng lớp + bộ thẻ. */
export interface SectionDeps extends ViewDeps {
  /** Bộ component thẻ và trang chi tiết. */
  readonly cards: CardsApi;
}

/**
 * Dịch lý do ghi nguồn thất bại.
 * Nhận: failure — lý do đã phân loại; t — hàm dịch.
 * Trả: chữ hiển thị.
 */
function sourceFailureText(failure: SourceFailure, t: PluginMarketTranslate): string {
  switch (failure.kind) {
    case "invalid":
      return t("sourceInvalid");
    case "duplicate":
      return t("sourceDuplicate");
    case "unavailable":
      return t("sourceUnavailable");
    case "other":
      return t("sourceFailed");
  }
}

/**
 * Dựng component tab Discover.
 * Nhận: deps — runtime jsx, module react, bộ nguyên thuỷ, bảng tên lớp và bộ thẻ.
 * Trả: component nhận props của slot plugins.tab.
 */
export function createDiscoverSection(deps: SectionDeps): (props: DiscoverSectionPropsLike) => unknown {
  const { runtime, react, primitives, css, cards } = deps;
  const h = runtime.jsx;
  const hs = runtime.jsxs;
  const Fragment = runtime.Fragment;
  const { MarketIcon, EntryCard, EntryDetail, ListSkeleton } = cards;

  /**
   * Tên hiển thị của một plugin.
   * Nhận: entry — plugin; face — mặt inject để dịch tiêu đề.
   * Trả: tiêu đề đã dịch, hoặc tên package.
   */
  function entryTitle(entry: MarketEntryLike, face: DiscoverFaceLike): string {
    return entry.title === undefined ? entry.name : face.resolveText(entry.title);
  }

  /**
   * Hộp thoại quản lý nguồn chỉ mục.
   * Nhận: props.state — trạng thái Discover; props.t — hàm dịch; props.face — mặt inject.
   * Trả: element hộp thoại (Modal tự ẩn khi state.editing = false).
   */
  function SourcesDialog(props: {
    readonly state: MarketDiscoverStateLike;
    readonly t: PluginMarketTranslate;
    readonly face: DiscoverFaceLike;
  }): unknown {
    const { state, t, face } = props;
    return h(primitives.Modal, {
      open: state.editing,
      onClose: face.toggleSources,
      title: t("sourcesTitle"),
      closeLabel: t("close"),
      description: t("sourcesDescription"),
      className: css["dialog"],
      children: hs("div", {
        className: css["dialogBody"],
        children: [
          state.indexes.length === 0
            ? null
            : h("ul", {
                className: css["sourceList"],
                "aria-label": t("sourcesLabel"),
                children: state.indexes.map((index) =>
                  hs(
                    "li",
                    {
                      className: css["sourceRow"],
                      children: [
                        hs("div", {
                          className: css["main"],
                          children: [
                            h("span", { className: css["strong"], children: indexLabel(index, face.resolveText) }),
                            h("span", { className: css["meta"], children: index.url }),
                            index.error === undefined ? null : h("span", { className: css["sourceError"], children: index.error }),
                          ],
                        }),
                        h(primitives.Tooltip, {
                          label: t("removeSource"),
                          side: "bottom",
                          portal: true,
                          delayMs: 300,
                          children: h(primitives.Button, {
                            variant: "ghost",
                            size: "sm",
                            icon: h(primitives.IconTrashOutlineRegular, { size: 13 }),
                            "aria-label": t("removeSourceNamed", { url: index.url }),
                            disabled: state.saving,
                            onClick: () => {
                              face.removeSource(index.url);
                            },
                          }),
                        }),
                      ],
                    },
                    index.url,
                  ),
                ),
              }),
          hs("form", {
            className: css["sourceForm"],
            onSubmit: (event: { preventDefault: () => void }) => {
              event.preventDefault();
              face.addSource();
            },
            children: [
              h(primitives.Input, {
                className: css["grow"],
                value: state.draft,
                placeholder: t("sourcePlaceholder"),
                "aria-label": t("sourceUrl"),
                "aria-invalid": state.sourceFailure !== null,
                "data-modal-autofocus": true,
                onChange: (event: { target: { value: string } }) => {
                  face.editDraft(event.target.value);
                },
              }),
              h(primitives.Button, {
                type: "submit",
                variant: "primary",
                size: "sm",
                icon: h(primitives.IconPlusOutlineRegular, { size: 13 }),
                disabled: state.saving || state.draft.trim() === "",
                children: t("addSource"),
              }),
            ],
          }),
          state.sourceFailure === null
            ? null
            : h("p", {
                className: css["error"],
                role: "alert",
                children: sourceFailureText(state.sourceFailure, t),
              }),
          hs("p", {
            className: css["notice"],
            role: "note",
            children: [
              h(primitives.IconWarningOutlineRegular, { size: 14, "aria-hidden": "true" }),
              h("span", { children: t("sourcesTrust") }),
            ],
          }),
        ],
      }),
    });
  }

  /**
   * Hộp thoại xác nhận cài một phiên bản chính xác.
   * Nhận: props.choice — lựa chọn đang chờ (null thì không vẽ gì); props.t — hàm dịch; props.face — mặt inject;
   *   props.onCancel — huỷ; props.onConfirm — xác nhận và mở hộp thoại cài của trang.
   * Trả: element hộp thoại hoặc null.
   */
  function ConfirmDialog(props: {
    readonly choice: InstallChoice | null;
    readonly t: PluginMarketTranslate;
    readonly face: DiscoverFaceLike;
    readonly onCancel: () => void;
    readonly onConfirm: (choice: InstallChoice) => void;
  }): unknown {
    const choice = props.choice;
    if (choice === null) return null;
    const { entry, version } = choice;
    const t = props.t;
    const title = entryTitle(entry, props.face);
    return h(primitives.Modal, {
      open: true,
      onClose: props.onCancel,
      title: t("confirmTitle", { name: title }),
      closeLabel: t("close"),
      className: css["dialog"],
      footer: hs(Fragment, {
        children: [
          h(primitives.Button, { variant: "outline", onClick: props.onCancel, children: t("cancel") }),
          h(primitives.Button, {
            variant: "primary",
            autoFocus: true,
            onClick: () => {
              props.onConfirm(choice);
            },
            children: t("install"),
          }),
        ],
      }),
      children: hs("div", {
        className: css["dialogBody"],
        children: [
          hs("div", {
            className: css["confirmHead"],
            children: [
              h("span", {
                className: css["icon"],
                "aria-hidden": "true",
                children: h(MarketIcon, { src: entry.icon, size: ICON }),
              }),
              hs("div", {
                className: css["main"],
                children: [
                  h("span", { className: css["strong"], children: title }),
                  h("span", { className: css["meta"], children: version.version }),
                ],
              }),
            ],
          }),
          hs("dl", {
            className: css["facts"],
            children: [
              entry.author === undefined
                ? null
                : hs("div", { children: [h("dt", { children: t("factAuthor") }), h("dd", { children: entry.author })] }),
              ...sourceFacts(entry.name, version).map((fact) =>
                hs(
                  "div",
                  { children: [h("dt", { children: t(factKey(fact.kind)) }), h("dd", { children: h("code", { children: fact.value }) })] },
                  fact.kind,
                ),
              ),
            ],
          }),
          version.compatibility.compatible
            ? null
            : hs("p", {
                className: css["notice"],
                role: "note",
                children: [
                  h(primitives.IconWarningOutlineRegular, { size: 14, "aria-hidden": "true" }),
                  h("span", { children: t("exempted") }),
                ],
              }),
          hs("p", {
            className: css["notice"],
            role: "note",
            children: [
              h(primitives.IconWarningOutlineRegular, { size: 14, "aria-hidden": "true" }),
              h("span", { children: t("installTrust") }),
            ],
          }),
        ],
      }),
    });
  }

  /**
   * Trình duyệt một chỉ mục: thanh công cụ, bộ lọc, danh sách kết quả và trang chi tiết.
   * Nhận: props.state — trạng thái Discover; props.listing — niêm yết đang hiện; props.t — hàm dịch;
   *   props.face — mặt inject; props.language — ngôn ngữ; props.onInstall — mở xác nhận cài;
   *   props.openPackage — mở tab Đã cài.
   * Trả: element vùng nội dung của tab.
   */
  function Browser(props: {
    readonly state: MarketDiscoverStateLike;
    readonly listing: MarketListingStateLike;
    readonly t: PluginMarketTranslate;
    readonly face: DiscoverFaceLike;
    readonly language: string;
    readonly onInstall: (choice: InstallChoice) => void;
    readonly openPackage: (packageName: string) => void;
  }): unknown {
    const { state, listing, t, face, language } = props;
    const query = listing.query;
    const value = listing.value;
    const [text, setText] = react.useState<string>(query.text);
    const [menu, setMenu] = react.useState<string | null>(null);
    const [opened, setOpened] = react.useState<MarketEntryLike | null>(null);
    react.useEffect(() => {
      if (text === query.text) return undefined;
      const timer = setTimeout(() => {
        face.search(withText(query, text));
      }, TEXT_DELAY_MS);
      return () => {
        clearTimeout(timer);
      };
    }, [text, query, face]);
    const declarations: {
      categories: DisplayDeclaration<MarketDeclarationLike>[];
      labels: DisplayDeclaration<MarketDeclarationLike>[];
      sortKeys: DisplayDeclaration<{ readonly title: Record<string, string>; readonly order: "asc" | "desc" }>[];
    } = react.useMemo(
      () => ({
        categories: value === null ? [] : displayDeclarations(value.metadata.categories, face.resolveText, language),
        labels: value === null ? [] : displayDeclarations(value.metadata.labels, face.resolveText, language),
        sortKeys: value === null ? [] : displayDeclarations(value.metadata.sortKeys, face.resolveText, language),
      }),
      [value, face, language],
    );
    const openEntry = opened === null ? undefined : (value?.entries.find((entry) => entry.name === opened.name) ?? opened);
    if (openEntry !== undefined && value !== null) {
      return h(EntryDetail, {
        entry: openEntry,
        listing: value,
        t,
        face,
        language,
        onBack: () => {
          setOpened(null);
        },
        onInstall: (version: MarketVersionLike) => {
          props.onInstall({ entry: openEntry, version });
        },
        onOpenInstalled: () => {
          props.openPackage(openEntry.name);
        },
      });
    }
    const market = indexLabel(
      state.indexes.find((index) => index.url === listing.url) ?? { url: listing.url },
      face.resolveText,
    );
    const sort = query.sort;
    const sortOptions: SortOption[] = [
      ...(query.text.trim() === "" ? [] : [{ id: "relevance", label: t("sortRelevance") }]),
      { id: "index", label: t("sortDefault") },
      { id: "published", label: t("sortPublished") },
      ...declarations.sortKeys.map((item) => ({ id: "key:" + item.id, label: item.title })),
    ];
    const sortName = sortOptions.find((option) => option.id === sortMenuId(sort))?.label ?? t("sortDefault");
    const directed = sort.kind === "published" || sort.kind === "key";
    const chooseSort = (id: string): void => {
      setMenu(null);
      if (id === "direction" && directed) {
        face.search({ ...query, sort: { ...sort, direction: sort.direction === "asc" ? "desc" : "asc" } as MarketSortLike });
        return;
      }
      if (id === "index" || id === "relevance") {
        face.search({ ...query, sort: { kind: id } });
        return;
      }
      if (id === "published") {
        face.search({ ...query, sort: { kind: "published", direction: "desc" } });
        return;
      }
      const key = declarations.sortKeys.find((item) => "key:" + item.id === id);
      if (key !== undefined) face.search({ ...query, sort: { kind: "key", id: key.id, direction: key.declaration.order } });
    };
    const toggleMenu = (name: string): void => {
      setMenu(menu === name ? null : name);
    };
    const busy = listing.status === "loading" && value !== null;
    return hs(Fragment, {
      children: [
        hs("div", {
          className: css["toolbar"],
          children: [
            h(primitives.Menu, {
              open: menu === "market",
              onClose: () => {
                setMenu(null);
              },
              portal: true,
              autoFocus: true,
              selectedId: listing.url,
              items: state.indexes.map((index) => ({ id: index.url, label: indexLabel(index, face.resolveText) })),
              footer: [{ id: "manage", label: t("manageSources"), icon: h(primitives.IconSlidersTwoOutlineRegular, { size: 14 }) }],
              onSelect: (id: string) => {
                setMenu(null);
                if (id === "manage") face.toggleSources();
                else face.select(id);
              },
              anchor: hs(primitives.Button, {
                variant: "ghost",
                size: "sm",
                className: css["marketButton"],
                "aria-haspopup": "menu",
                "aria-expanded": menu === "market",
                "aria-label": t("marketMenu", { market }),
                onClick: () => {
                  toggleMenu("market");
                },
                children: [
                  h("span", { className: css["marketName"], children: market }),
                  h(primitives.IconChevronDownOutlineRegular, { size: 12, "aria-hidden": "true" }),
                ],
              }),
            }),
            h(primitives.Input, {
              className: css["search"],
              type: "search",
              icon: h(primitives.IconSearchOutlineRegular, { size: 14 }),
              value: text,
              placeholder: t("search"),
              "aria-label": t("search"),
              onChange: (event: { target: { value: string } }) => {
                setText(event.target.value);
              },
            }),
            declarations.labels.length === 0
              ? null
              : h(primitives.Menu, {
                  open: menu === "filter",
                  onClose: () => {
                    setMenu(null);
                  },
                  portal: true,
                  autoFocus: true,
                  align: "end",
                  selectedIds: query.labels,
                  items: declarations.labels.map((item) => ({ id: item.id, label: item.title })),
                  onSelect: (id: string) => {
                    const labels = query.labels.includes(id)
                      ? query.labels.filter((label) => label !== id)
                      : [...query.labels, id];
                    face.search({ ...query, labels });
                  },
                  anchor: h(primitives.Button, {
                    variant: "ghost",
                    size: "sm",
                    "aria-haspopup": "menu",
                    "aria-expanded": menu === "filter",
                    icon: h(primitives.IconSlidersTwoOutlineRegular, { size: 13 }),
                    onClick: () => {
                      toggleMenu("filter");
                    },
                    children: query.labels.length === 0 ? t("filter") : t("filterCount", { count: String(query.labels.length) }),
                  }),
                }),
            h(primitives.Menu, {
              open: menu === "sort",
              onClose: () => {
                setMenu(null);
              },
              portal: true,
              autoFocus: true,
              align: "end",
              selectedId: sortMenuId(sort),
              items: sortOptions,
              ...(directed
                ? { footer: [{ id: "direction", label: t(sort.direction === "asc" ? "switchToDescending" : "switchToAscending") }] }
                : {}),
              onSelect: chooseSort,
              anchor: hs(primitives.Button, {
                variant: "ghost",
                size: "sm",
                "aria-haspopup": "menu",
                "aria-expanded": menu === "sort",
                onClick: () => {
                  toggleMenu("sort");
                },
                children: [t("sortBy", { sort: sortName }), h(primitives.IconChevronDownOutlineRegular, { size: 12, "aria-hidden": "true" })],
              }),
            }),
            h(primitives.Tooltip, {
              label: t("refresh"),
              side: "bottom",
              portal: true,
              delayMs: 500,
              focusDelayMs: 500,
              children: h(primitives.Button, {
                variant: "ghost",
                size: "sm",
                "aria-label": t("refresh"),
                disabled: listing.status === "loading",
                onClick: face.refresh,
                icon: busy
                  ? h(primitives.StateDot, { state: "ongoing" })
                  : h(primitives.IconRefreshOutlineRegular, { size: 14 }),
              }),
            }),
          ],
        }),
        declarations.categories.length === 0
          ? null
          : hs("div", {
              className: css["categories"],
              role: "group",
              "aria-label": t("categoriesLabel"),
              children: [
                h(primitives.Pill, {
                  active: query.category === null,
                  "aria-pressed": query.category === null,
                  onClick: () => {
                    face.search({ ...query, category: null });
                  },
                  children: t("allCategories"),
                }),
                ...declarations.categories.map((item) =>
                  h(
                    primitives.Pill,
                    {
                      active: query.category === item.id,
                      "aria-pressed": query.category === item.id,
                      onClick: () => {
                        face.search({ ...query, category: item.id });
                      },
                      children: item.title,
                    },
                    item.id,
                  ),
                ),
              ],
            }),
        listing.failure === null
          ? null
          : hs("div", {
              className: css["failure"],
              children: [
                hs("p", {
                  className: css["error"],
                  role: "alert",
                  children: [h(primitives.StateDot, { state: "error" }), t(failureKey(listing.failure))],
                }),
                h(primitives.Button, { variant: "outline", size: "sm", onClick: face.retry, children: t("retry") }),
              ],
            }),
        value === null
          ? listing.status === "loading"
            ? h(ListSkeleton, { label: t("loading") })
            : null
          : value.total === 0
            ? h("p", { className: css["muted"], children: t(unfiltered(listing.answered) ? "emptyIndex" : "noMatches") })
            : hs(Fragment, {
                children: [
                  h("ul", {
                    className: css["cards"],
                    "aria-busy": busy,
                    children: value.entries.map((entry) =>
                      h(
                        EntryCard,
                        {
                          entry,
                          t,
                          face,
                          language,
                          labels: declarations.labels,
                          onOpen: () => {
                            setOpened(entry);
                          },
                          onInstall: (version: MarketVersionLike) => {
                            props.onInstall({ entry, version });
                          },
                          onOpenInstalled: () => {
                            props.openPackage(entry.name);
                          },
                        },
                        entry.name,
                      ),
                    ),
                  }),
                  value.nextOffset === null
                    ? null
                    : h(primitives.Button, {
                        variant: "outline",
                        size: "sm",
                        className: css["more"],
                        disabled: listing.status !== "ready",
                        onClick: face.more,
                        children: t("showMore"),
                      }),
                ],
              }),
      ],
    });
  }

  /**
   * Tab Discover của trang Plugins.
   * Nhận: props — props của slot plugins.tab (owner install/openPackage, hook, mặt inject, hàm dịch).
   * Trả: element gốc của tab.
   */
  return function DiscoverSection(props: DiscoverSectionPropsLike): unknown {
    const t = props.t;
    const face: DiscoverFaceLike = props;
    const state = props.useDiscover((snapshot) => snapshot);
    const language = props.useLocale((snapshot) => snapshot.active);
    const [confirming, setConfirming] = react.useState<InstallChoice | null>(null);
    react.useEffect(() => {
      props.ensure();
    }, [props.ensure]);
    let body: unknown = null;
    if (state.status === "idle" || state.status === "loading") {
      body = h(ListSkeleton, { label: t("loading") });
    } else if (state.status === "error") {
      body = hs("div", {
        className: css["failure"],
        children: [
          hs("p", {
            className: css["error"],
            role: "alert",
            children: [h(primitives.StateDot, { state: "error" }), t("sourcesFailed")],
          }),
          h(primitives.Button, { variant: "outline", size: "sm", onClick: props.reload, children: t("retry") }),
        ],
      });
    } else if (state.listing === null) {
      body = hs("div", {
        className: css["empty"],
        children: [
          h(primitives.PluginArtworkDefault, { size: 48 }),
          h("p", { className: css["emptyTitle"], children: t("emptyTitle") }),
          h("p", { className: css["muted"], children: t("emptyDescription") }),
          h(primitives.Button, {
            variant: "primary",
            size: "sm",
            icon: h(primitives.IconPlusOutlineRegular, { size: 13 }),
            onClick: props.toggleSources,
            children: t("addFirstSource"),
          }),
        ],
      });
    } else {
      body = h(
        Browser,
        {
          state,
          listing: state.listing,
          t,
          face,
          language,
          onInstall: (choice: InstallChoice) => {
            setConfirming(choice);
          },
          openPackage: props.openPackage,
        },
        state.listing.url,
      );
    }
    return hs("div", {
      className: css["section"],
      "data-plugin-tab": "discover",
      children: [
        body,
        h(SourcesDialog, { state, t, face }),
        h(ConfirmDialog, {
          choice: confirming,
          t,
          face,
          onCancel: () => {
            setConfirming(null);
          },
          onConfirm: (choice: InstallChoice) => {
            setConfirming(null);
            props.install({
              ...choice.version.install,
              title: entryTitle(choice.entry, face),
              version: choice.version.version,
            });
          },
        }),
      ],
    });
  };
}

/**
 * Khoá từ điển cho nhãn của một dữ kiện nguồn.
 * Nhận: kind — loại dữ kiện (package, registry, repository, commit, directory).
 * Trả: khoá từ điển tương ứng.
 */
function factKey(kind: "package" | "registry" | "repository" | "commit" | "directory"): Parameters<PluginMarketTranslate>[0] {
  switch (kind) {
    case "package":
      return "factPackage";
    case "registry":
      return "factRegistry";
    case "repository":
      return "factRepository";
    case "commit":
      return "factCommit";
    case "directory":
      return "factDirectory";
  }
}
