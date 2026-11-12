/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thẻ plugin, trang chi tiết và khung xương của tab Discover
 */

import { formatDate, installable, presentedVersion, displayDeclarations, sourceFacts } from "./presentation.ts";
import type { DisplayDeclaration, SourceFact } from "./presentation.ts";
import type { PluginMarketLocaleKey, PluginMarketTranslate } from "./locales.ts";
import type {
  DiscoverFaceLike,
  JsxRuntimeLike,
  MarketDeclarationLike,
  MarketEntryLike,
  MarketPrimitivesLike,
  MarketSearchResultLike,
  MarketVersionLike,
  ReactLike,
} from "./types.ts";

/** Phụ thuộc dùng chung của mọi component trong tab. */
export interface ViewDeps {
  /** Hàm dựng phần tử (react/jsx-runtime). */
  readonly runtime: JsxRuntimeLike;
  /** Module react (hook). */
  readonly react: ReactLike;
  /** Bộ nguyên thuỷ của trang. */
  readonly primitives: MarketPrimitivesLike;
  /** Bảng tên lớp CSS. */
  readonly css: Readonly<Record<string, string>>;
}

/** Kích thước ảnh biểu tượng trong khung 48px (như tab Đã cài). */
export const ICON = 36;

/** Khoá từ điển cho lý do lần đọc niêm yết thất bại. */
const FAILURE_KEYS: Record<"fetch" | "invalid" | "changed", PluginMarketLocaleKey> = {
  fetch: "readFailed",
  invalid: "readInvalid",
  changed: "readChanged",
};

/** Khoá từ điển cho nhãn của từng loại dữ kiện nguồn. */
const FACT_KEYS: Record<SourceFact["kind"], PluginMarketLocaleKey> = {
  package: "factPackage",
  registry: "factRegistry",
  repository: "factRepository",
  commit: "factCommit",
  directory: "factDirectory",
};

/** Props của một thẻ plugin trong danh sách. */
export interface EntryCardProps {
  /** Plugin của chỉ mục. */
  readonly entry: MarketEntryLike;
  /** Hàm dịch. */
  readonly t: PluginMarketTranslate;
  /** Mặt inject của tab. */
  readonly face: DiscoverFaceLike;
  /** Ngôn ngữ đang dùng. */
  readonly language: string;
  /** Nhãn đã bản địa hoá của chỉ mục. */
  readonly labels: readonly DisplayDeclaration<MarketDeclarationLike>[];
  /** Mở trang chi tiết. */
  readonly onOpen: () => void;
  /** Mở hộp thoại xác nhận cài một phiên bản. */
  readonly onInstall: (version: MarketVersionLike) => void;
  /** Chuyển sang tab Đã cài và mở bundle này. */
  readonly onOpenInstalled: () => void;
}

/** Props của trang chi tiết một plugin. */
export interface EntryDetailProps {
  /** Plugin của chỉ mục. */
  readonly entry: MarketEntryLike;
  /** Trang kết quả đang hiện (nguồn metadata). */
  readonly listing: MarketSearchResultLike;
  /** Hàm dịch. */
  readonly t: PluginMarketTranslate;
  /** Mặt inject của tab. */
  readonly face: DiscoverFaceLike;
  /** Ngôn ngữ đang dùng. */
  readonly language: string;
  /** Quay lại danh sách. */
  readonly onBack: () => void;
  /** Mở hộp thoại xác nhận cài một phiên bản. */
  readonly onInstall: (version: MarketVersionLike) => void;
  /** Chuyển sang tab Đã cài và mở bundle này. */
  readonly onOpenInstalled: () => void;
}

/** Bộ component của tab Discover. */
export interface CardsApi {
  /** Ảnh biểu tượng, có ảnh mặc định khi thiếu hoặc lỗi. */
  readonly MarketIcon: (props: { readonly src?: string | undefined; readonly size: number }) => unknown;
  /** Một thẻ plugin trong danh sách. */
  readonly EntryCard: (props: EntryCardProps) => unknown;
  /** Trang chi tiết một plugin. */
  readonly EntryDetail: (props: EntryDetailProps) => unknown;
  /** Khung xương của danh sách đang đọc. */
  readonly ListSkeleton: (props: { readonly label: string }) => unknown;
}

/**
 * Dựng bộ component của tab từ runtime và bộ nguyên thuỷ của bảng module.
 * Nhận: deps — runtime jsx, module react, bộ nguyên thuỷ và bảng tên lớp.
 * Trả: bộ component dùng cho cả danh sách lẫn trang chi tiết.
 */
export function createCards(deps: ViewDeps): CardsApi {
  const { runtime, react, primitives, css } = deps;
  const h = runtime.jsx;
  const hs = runtime.jsxs;
  const Fragment = runtime.Fragment;

  /**
   * Ảnh biểu tượng của plugin: ảnh mặc định khi thiếu ảnh hoặc khi ảnh lỗi.
   * Nhận: props.src — URL ảnh (có thể vắng); props.size — cạnh ảnh.
   * Trả: element ảnh hoặc ảnh mặc định.
   */
  function MarketIcon(props: { readonly src?: string | undefined; readonly size: number }): unknown {
    const [failed, setFailed] = react.useState<string | undefined>(undefined);
    if (props.src === undefined || props.src === failed) return h(primitives.PluginArtworkDefault, { size: props.size });
    return h("img", {
      className: css["image"],
      src: props.src,
      width: props.size,
      height: props.size,
      alt: "",
      loading: "lazy",
      referrerPolicy: "no-referrer",
      onError: () => {
        setFailed(props.src);
      },
    });
  }

  /**
   * Tên hiển thị của một plugin: tiêu đề đã bản địa hoá, ngược lại là tên package.
   * Nhận: entry — plugin; face — mặt inject (để dịch).
   * Trả: tên hiển thị.
   */
  function entryTitle(entry: MarketEntryLike, face: DiscoverFaceLike): string {
    return entry.title === undefined ? entry.name : face.resolveText(entry.title);
  }

  /**
   * Hành động duy nhất mà một plugin đưa ra ở trạng thái hiện tại.
   * Nhận: props.entry — plugin; props.title — tên hiển thị; props.t — hàm dịch; props.onInstall — mở xác nhận cài;
   *   props.onOpenInstalled — mở tab Đã cài.
   * Trả: element nút bấm (kèm chú thích khi bản trình bày không tương thích).
   */
  function EntryAction(props: {
    readonly entry: MarketEntryLike;
    readonly title: string;
    readonly t: PluginMarketTranslate;
    readonly onInstall: (version: MarketVersionLike) => void;
    readonly onOpenInstalled: () => void;
  }): unknown {
    const { status } = props.entry.installation;
    if (status !== "not-installed") {
      return h(primitives.Button, {
        variant: "ghost",
        size: "sm",
        "aria-label": props.t("openInstalled", { name: props.title }),
        onClick: props.onOpenInstalled,
        children: props.t(status === "update-available" ? "statusUpdate" : status === "provided" ? "statusProvided" : "statusInstalled"),
      });
    }
    const version = presentedVersion(props.entry);
    if (!installable(version.compatibility)) {
      return h(primitives.Tooltip, {
        label: props.t("noCompatibleVersion", { runtime: version.compatibility.runtimeVersion ?? "" }),
        side: "bottom",
        portal: true,
        delayMs: 300,
        children: h(primitives.Button, {
          variant: "outline",
          size: "sm",
          className: css["blocked"],
          "aria-disabled": "true",
          "aria-label": props.t("installTitle", { name: props.title }),
          children: props.t("install"),
        }),
      });
    }
    return h(primitives.Button, {
      variant: "outline",
      size: "sm",
      "aria-label": props.t("installTitle", { name: props.title }),
      onClick: () => {
        props.onInstall(version);
      },
      children: props.t("install"),
    });
  }

  /**
   * Một thẻ plugin trong danh sách kết quả.
   * Nhận: props — plugin, hàm dịch, mặt inject, ngôn ngữ, nhãn của chỉ mục và ba hành động.
   * Trả: element thẻ li.
   */
  function EntryCard(props: EntryCardProps): unknown {
    const title = entryTitle(props.entry, props.face);
    const version = presentedVersion(props.entry);
    const date = formatDate(version.publishTimestamp, props.language, "medium");
    const entry = props.entry;
    return hs(
      "li",
      {
        className: css["card"],
        "data-market-entry": entry.name,
        children: [
          h("span", {
            className: css["icon"],
            "aria-hidden": "true",
            children: h(MarketIcon, { src: entry.icon, size: ICON }),
          }),
          hs("div", {
            className: css["main"],
            children: [
              hs("div", {
                className: css["titleRow"],
                children: [
                  h("button", {
                    type: "button",
                    className: css["cardOpen"],
                    "aria-label": props.t("openEntry", { name: title }),
                    onClick: props.onOpen,
                    children: title,
                  }),
                  ...props.labels
                    .filter((label) => entry.metadata.labels.includes(label.id))
                    .map((label) => h(primitives.Tag, { children: label.title }, label.id)),
                ],
              }),
              entry.description === undefined
                ? null
                : h("span", { className: css["description"], children: props.face.resolveText(entry.description) }),
              h("span", {
                className: css["meta"],
                children:
                  entry.author === undefined
                    ? props.t("entryMeta", { version: version.version, date })
                    : props.t("entryMetaAuthor", { version: version.version, author: entry.author, date }),
              }),
            ],
          }),
          h("div", {
            className: css["cardEnd"],
            children: h(EntryAction, {
              entry,
              title,
              t: props.t,
              onInstall: props.onInstall,
              onOpenInstalled: props.onOpenInstalled,
            }),
          }),
        ],
      },
    );
  }

  /**
   * Một dòng trong danh sách phiên bản: nhãn trạng thái và nút cài khi phiên bản cài được.
   * Nhận: props.entry — plugin; props.version — phiên bản; props.title — tên hiển thị; props.t — hàm dịch;
   *   props.language — ngôn ngữ; props.onInstall — mở xác nhận cài.
   * Trả: element dòng phiên bản.
   */
  function VersionRow(props: {
    readonly entry: MarketEntryLike;
    readonly version: MarketVersionLike;
    readonly title: string;
    readonly t: PluginMarketTranslate;
    readonly language: string;
    readonly onInstall: (version: MarketVersionLike) => void;
  }): unknown {
    const { entry, version, t } = props;
    const current = entry.installation.installedVersion === version.version;
    const offered = !current && entry.installation.status !== "provided" && installable(version.compatibility);
    const { compatibility } = version;
    const prerelease = (version.version.split("+")[0] ?? "").includes("-");
    return hs(
      "li",
      {
        className: css["versionRow"],
        "data-market-version": version.version,
        children: [
          hs("div", {
            className: css["main"],
            children: [
              hs("div", {
                className: css["titleRow"],
                children: [
                  h("span", { className: css["strong"], children: version.version }),
                  version.version === entry.defaultVersion ? h(primitives.Tag, { tone: "info", children: t("versionDefault") }) : null,
                  prerelease ? h(primitives.Tag, { tone: "neutral", children: t("versionPrerelease") }) : null,
                  current ? h(primitives.Tag, { tone: "success", children: t("versionInstalled") }) : null,
                  compatibility.compatible
                    ? null
                    : h(primitives.Tag, {
                        tone: "warning",
                        children: t(compatibility.exempted === true ? "versionExempted" : "versionIncompatible"),
                      }),
                ],
              }),
              h("span", {
                className: css["meta"],
                children: compatibility.compatible
                  ? formatDate(version.publishTimestamp, props.language, "medium")
                  : compatibility.exempted === true
                    ? t("exempted")
                    : t("incompatible", {
                        runtime: compatibility.runtimeVersion ?? "",
                        range: Object.values(compatibility.requirements ?? {}).join(" "),
                      }),
              }),
            ],
          }),
          offered
            ? h(primitives.Button, {
                variant: "ghost",
                size: "sm",
                "aria-label": t("installVersionTitle", { name: props.title, version: version.version }),
                onClick: () => {
                  props.onInstall(version);
                },
                children: t("install"),
              })
            : null,
        ],
      },
    );
  }

  /**
   * Một dòng dữ kiện trong bảng nguồn.
   * Nhận: label — nhãn đã dịch; value — giá trị hiển thị (chuỗi, hoặc node khi cần thẻ code).
   * Trả: element div chứa dt/dd.
   */
  function FactRow(props: { readonly label: string; readonly value: unknown; readonly className?: string }): unknown {
    const ddProps = { ...(props.className === undefined ? {} : { className: props.className }), children: props.value };
    // Mảng con phải đi qua jsxs (react/jsx-runtime phân biệt jsx một-con với jsxs mảng-con).
    return hs("div", { children: [h("dt", { children: props.label }), Array.isArray(props.value) ? hs("dd", ddProps) : h("dd", ddProps)] });
  }

  /**
   * Trang chi tiết một plugin: nguồn cài, dữ kiện và danh sách phiên bản.
   * Nhận: props — plugin, trang kết quả, hàm dịch, mặt inject, ngôn ngữ, quay lại và hai hành động.
   * Trả: element trang chi tiết.
   */
  function EntryDetail(props: EntryDetailProps): unknown {
    const entry = props.entry;
    const t = props.t;
    const title = entryTitle(entry, props.face);
    const version = presentedVersion(entry);
    const date = formatDate(version.publishTimestamp, props.language, "long");
    const categoryId = entry.metadata.category;
    const category = categoryId === undefined ? undefined : props.listing.metadata.categories[categoryId];
    const labels = displayDeclarations(props.listing.metadata.labels, props.face.resolveText, props.language).filter((label) =>
      entry.metadata.labels.includes(label.id),
    );
    const { compatibility } = version;
    const incompatibleText =
      compatibility.exempted === true
        ? t("exempted")
        : t("incompatible", {
            runtime: compatibility.runtimeVersion ?? "",
            range: Object.values(compatibility.requirements ?? {}).join(" "),
          });
    return hs("div", {
      className: css["detail"],
      "data-market-detail": entry.name,
      children: [
        hs("button", {
          type: "button",
          className: css["crumb"],
          onClick: props.onBack,
          children: [
            h(primitives.IconChevronDownOutlineRegular, { className: css["crumbIcon"], "aria-hidden": "true" }),
            h("span", { children: t("backToList") }),
          ],
        }),
        hs("div", {
          className: css["detailHead"],
          children: [
            h("span", {
              className: css["icon"],
              "aria-hidden": "true",
              children: h(MarketIcon, { src: entry.icon, size: ICON }),
            }),
            hs("div", {
              className: css["main"],
              children: [
                hs("div", {
                  className: css["titleRow"],
                  children: [
                    h("h3", { className: css["detailTitle"], children: title }),
                    h(primitives.Tag, { tone: "neutral", children: version.version }),
                  ],
                }),
                title === entry.name ? null : h("span", { className: css["meta"], children: entry.name }),
              ],
            }),
            h(EntryAction, { entry, title, t, onInstall: props.onInstall, onOpenInstalled: props.onOpenInstalled }),
          ],
        }),
        entry.description === undefined
          ? null
          : h("p", { className: css["detailDescription"], children: props.face.resolveText(entry.description) }),
        compatibility.compatible
          ? null
          : hs("p", {
              className: css["notice"],
              role: "note",
              children: [h(primitives.IconWarningOutlineRegular, { size: 14, "aria-hidden": "true" }), h("span", { children: incompatibleText })],
            }),
        hs("section", {
          className: css["detailSection"],
          children: [
            h("h4", { className: css["sectionTitle"], children: t("factSource") }),
            hs("dl", {
              className: css["facts"],
              children: [
                entry.author === undefined ? null : h(FactRow, { label: t("factAuthor"), value: entry.author }),
                entry.homepage === undefined
                  ? null
                  : h(FactRow, {
                      label: t("factHomepage"),
                      value: h("a", {
                        className: css["link"],
                        href: entry.homepage,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        children: entry.homepage,
                      }),
                    }),
                entry.repository === undefined
                  ? null
                  : h(FactRow, {
                      label: t("factSourceCode"),
                      value: hs(Fragment, {
                        children: [
                          h("a", {
                            className: css["link"],
                            href: entry.repository.url,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            children: entry.repository.url,
                          }),
                          entry.repository.directory === undefined
                            ? null
                            : hs(Fragment, { children: [" ", h("code", { children: entry.repository.directory })] }),
                        ],
                      }),
                    }),
                ...sourceFacts(entry.name, version).map((fact) =>
                  h(FactRow, { label: t(FACT_KEYS[fact.kind]), value: h("code", { children: fact.value }) }, fact.kind),
                ),
                h(FactRow, { label: t("factPublished"), value: date }),
                category === undefined ? null : h(FactRow, { label: t("factCategory"), value: props.face.resolveText(category.title) }),
                labels.length === 0
                  ? null
                  : h(FactRow, {
                      label: t("factLabels"),
                      className: css["tags"],
                      value: labels.map((label) => h(primitives.Tag, { children: label.title }, label.id)),
                    }),
                h(FactRow, { label: t("factMarket"), value: props.face.resolveText(props.listing.title) }),
              ],
            }),
          ],
        }),
        hs("section", {
          className: css["detailSection"],
          children: [
            h("h4", { className: css["sectionTitle"], children: t("versionsTitle") }),
            h(
              "ul",
              {
                className: css["versions"],
                "aria-label": t("versionsLabel", { name: title }),
                children: entry.versions.map((item) =>
                  h(VersionRow, { entry, version: item, title, t, language: props.language, onInstall: props.onInstall }, item.version),
                ),
              },
            ),
          ],
        }),
      ],
    });
  }

  /**
   * Khung xương của danh sách trong lúc đọc chỉ mục.
   * Nhận: props.label — nhãn trạng thái đã dịch.
   * Trả: element ul bốn thẻ giả.
   */
  function ListSkeleton(props: { readonly label: string }): unknown {
    return h("ul", {
      className: css["cards"],
      role: "status",
      "aria-label": props.label,
      "aria-busy": "true",
      children: [0, 1, 2, 3].map((index) =>
        hs(
          "li",
          {
            className: css["card"],
            "aria-hidden": "true",
            children: [
              h("span", { className: css["icon"] + " " + css["skeletonFill"] }),
              hs("div", {
                className: css["main"],
                children: [
                  h("span", { className: css["skeletonBar"] + " " + css["skeletonTitle"] + " " + css["skeletonFill"] }),
                  h("span", { className: css["skeletonBar"] + " " + css["skeletonDescription"] + " " + css["skeletonFill"] }),
                ],
              }),
            ],
          },
          index,
        ),
      ),
    });
  }

  return { MarketIcon, EntryCard, EntryDetail, ListSkeleton };
}

/**
 * Khoá từ điển cho lý do lần đọc niêm yết thất bại.
 * Nhận: failure — lý do đã phân loại.
 * Trả: khoá từ điển tương ứng.
 */
export function failureKey(failure: "fetch" | "invalid" | "changed"): PluginMarketLocaleKey {
  return FAILURE_KEYS[failure];
}
