/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Khung trang Plugins (header · tab · danh sách · card · menu thêm plugin) — port 1:1 vùng PluginManagerPage của client.js (2100-2282 · 2506-2684 · 3829-4265)
 */
import { PAGE_CLASS } from "./class-names.ts";
import type { PluginManagerModules } from "./runtime.ts";
import type { ConfigLedger } from "./slot-contract.ts";
import type { PluginTab } from "./tab-ledger.ts";
import type { NavigationState, NavigationView } from "./navigation-store.ts";
import { createPageDetail } from "./page-detail.ts";
import type {
  ConfigFormView,
  ConfigPageForm,
  InstallStateView,
  ManagerNoticeView,
  PageJsx,
  PageNode,
  PackageRowView,
  PackageView,
  PageTranslate,
  PluginManagerPageDeps,
  RegistryChoiceView,
  RenderSlotsSeam,
  ResolveText,
  SettingsMirrorSnapshotView,
} from "./page-detail.ts";
import { createInstallDialog, type PrimitivesSeam } from "./page-install-dialog.ts";

/** Bảng lớp CSS của trang — bản gốc gọi là PluginManagerPage_module_css_default. */
const css = PAGE_CLASS;

/* ------------------------------------------------------------------------------------------------------------
 * Props của trang: ghép từ props runtime của slot main, ghế dịch, store điều hướng và face của controller.
 * ---------------------------------------------------------------------------------------------------------- */

/** Một lượt cài do tab khác yêu cầu (PluginTabInstall của slot-contract). */
export interface PluginTabInstallInput {
  readonly spec: string;
  readonly registry?: string;
  readonly title: string;
  readonly version: string;
}

/** Ảnh chụp trạng thái trang (PluginManagerState của manager-store). */
export interface PluginManagerStateView {
  readonly status: "idle" | "loading" | "ready" | "error" | "unavailable";
  readonly refreshStatus: "idle" | "refreshing" | "failed";
  readonly packages: readonly PackageView[]; readonly busy: readonly string[];
  readonly notice: ManagerNoticeView | null; readonly install: InstallStateView;
  readonly confirm: { readonly action: "uninstall"; readonly packageName: string } | null;
  readonly highlight: string | null;
}

/** Props Y BẢN GỐC của PluginManagerPage: props runtime của slot main + t + renderSlot + face controller + store điều hướng. */
export interface PluginManagerPageProps {
  /** Ghế dịch của namespace pluginManager. */ readonly t: PageTranslate;
  /** Vẽ một slot con đã khai. */ readonly renderSlot: RenderSlotsSeam;
  /** Giải văn bản gói theo ngôn ngữ hiện tại. */ readonly resolveText: ResolveText;
  /** Form cấu hình theo id entry của Host. */ readonly configForm: (id: string) => ConfigFormView;
  /** Hook chọn trên gương cấu hình (inject face: hooks.configurations). */
  readonly useConfigurations: <S>(selector: (snapshot: SettingsMirrorSnapshotView) => S) => S;
  /** Hook chọn trên trạng thái trang (inject face: hooks.pluginManager). */
  readonly usePluginManager: <S>(selector: (snapshot: PluginManagerStateView) => S) => S;
  /** Hook chọn trên sổ cấu hình (inject face: hooks.configLedger). */ readonly useConfigLedger: <S>(selector: (snapshot: ConfigLedger) => S) => S;
  /** Hook chọn trên sổ tab (inject face: hooks.pluginTabs). */ readonly usePluginTabs: <S>(selector: (snapshot: readonly PluginTab[]) => S) => S;
  /** Hook chọn trên store điều hướng của trang. */ readonly useStore: <S>(selector: (state: NavigationState) => S) => S;
  /** Action của store điều hướng. */ readonly actions: { setView(view: NavigationView): void; setTab(tab: string): void };
  /** Đọc Host lần đầu khi tab vẽ. */ ensure(): void;
  /** Đọc Host lại. */ refresh(): void;
  /** Bỏ dấu highlight trong danh sách. */ clearHighlight(): void;
  /** Bỏ thông báo đang hiện. */ dismissNotice(): void;
  /** Mở dialog cài đặt. */ openInstall(): void;
  /** Mở dialog với phiên bản đã xác nhận ở nơi khác. */ installFrom(target: PluginTabInstallInput): void;
  /** Ẩn dialog, huỷ lượt kiểm tra, hoặc xin huỷ lượt cài. */ closeInstall(): void;
  /** Sửa spec trong dialog. */ editInstallSpec(text: string): void;
  /** Kiểm tra spec rồi cài; từ màn hình lỗi là chạy lại. */ runInstall(): void;
  /** Rời màn hình kiểm tra/lỗi, hoặc xin Host dừng lượt chạy. */ cancelInstall(): void;
  /** Hỏi Host kết quả của lượt cài đã mất phản hồi. */ reconcileInstall(): void;
  /** Mở/đóng phần chi tiết lệnh và đầu ra. */ toggleInstallDetails(): void;
  /** Bật gói vừa cài rồi đóng dialog và đánh dấu trong danh sách. */ enableInstalled(): void;
  /** Cho phép script cài mà lượt chạy để chờ, rồi chạy lại. */ approveBuildsAndRetry(): void;
  /** Mở/đóng các lựa chọn registry. */ toggleRegistryOptions(): void;
  /** Chọn registry hỏi trước, hoặc gõ một registry. */ chooseRegistry(choice: RegistryChoiceView): void;
  /** Từ màn hình lỗi: về ô spec với các lựa chọn registry đang mở. */ changeRegistry(): void;
  /** Từ lỗi GitHub: về ô spec trống hỏi mirror đề nghị. */ useGithubMirror(): void;
  /** Đưa gói vào/ra khỏi danh sách layer của profile. */ setEnabled(packageName: string, enabled: boolean): void;
  /** Gỡ gói đã cài rồi cài phiên bản danh mục của Host. */ update(packageName: string): void;
  /** Hỏi trước khi gỡ gói khỏi profile. */ uninstall(packageName: string): void;
  /** Xác nhận thao tác phá huỷ đang chờ. */ confirm(): void;
  /** Bỏ thao tác phá huỷ đang chờ. */ cancelConfirm(): void;
  /** Bật/tắt một row của gói trong layer người dùng. */ setRowEnabled(entryId: string, enabled: boolean): void;
}

/* ------------------------------------------------------------------------------------------------------------
 * Hằng của khung trang.
 * ---------------------------------------------------------------------------------------------------------- */

/** Danh sách đánh dấu gói mà một lượt cài vừa bật trong bao lâu. */
const HIGHLIGHT_MS = 2400;

/** Gói profile cấp sẵn không lên trang này kể cả khi profile khai chúng là phụ thuộc. */
const BUILTIN_PROFILE_BUNDLES = new Set<string>([
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "@deepseek-ai/dsh-headless",
  "@deepseek-ai/dsh-sdk-app",
  "@deepseek-ai/dsh-acp-app",
  "@deepseek-ai/dsh-sdk-minimal",
]);

/** Các gói tuỳ chọn mà danh sách chính luôn giữ, theo thứ tự này; gói mới vào danh sách chính. */
const EXTENSION_BUNDLES = [
  "@galaxy-blackhole/gbh-agent-team-profile",
  "@galaxy-blackhole/gbh-voice-input-bundle",
  "@galaxy-blackhole/gbh-auto-review",
  "@galaxy-blackhole/gbh-inspector-profile",
];

/** Các gói tuỳ chọn mà danh sách chính giữ lại tới khi profile chọn; danh sách More hiện chúng từ đầu. */
const MORE_BUNDLES = [
  "@galaxy-blackhole/gbh-tool-worktree",
  "@galaxy-blackhole/gbh-cot-translation-bundle",
  "@galaxy-blackhole/gbh-terminal-bundle",
  "@galaxy-blackhole/gbh-session-search",
  "@galaxy-blackhole/gbh-session-titles-bundle",
  "@galaxy-blackhole/gbh-badge-skill-bundle",
  "@galaxy-blackhole/gbh-ralph-bundle",
  "@galaxy-blackhole/gbh-plugin-market-bundle",
  "@galaxy-blackhole/gbh-subagent-codex",
  "@galaxy-blackhole/gbh-subagent-claude-code",
];

/** Giá trị điều hướng của tab riêng của trang; tab đóng góp dùng id đăng ký. */
const INSTALLED_TAB = "installed";

/**
 * Danh sách chính có hiện một gói tuỳ chọn chính thức không: các gói luôn giữ, và gói bị giữ lại mà profile đã bật.
 * Nhận: pkg — gói chính thức như Host báo.
 * Trả: true khi danh sách chính hiện nó.
 */
function pinnedToMainList(pkg: PackageView): boolean {
  return !MORE_BUNDLES.includes(pkg.name) || pkg.enabled;
}

/**
 * Chỗ của một gói tuỳ chọn trên cả hai danh sách: gói luôn giữ theo thứ tự của chúng, rồi gói không danh sách nào
 * xếp, rồi gói bị giữ lại theo thứ tự của chúng — để Codex và Claude Code đứng cuối danh sách More.
 * Nhận: name — tên gói.
 * Trả: hạng; gói cùng hạng giữ thứ tự Host báo.
 */
function optionalBundleRank(name: string): number {
  const alwaysHeld = EXTENSION_BUNDLES.indexOf(name);
  if (alwaysHeld >= 0) return alwaysHeld;
  const heldBack = MORE_BUNDLES.indexOf(name);
  return heldBack < 0 ? EXTENSION_BUNDLES.length : EXTENSION_BUNDLES.length + 1 + heldBack;
}

/**
 * Xếp các gói tuỳ chọn chính thức như cả hai danh sách hiện, để gói profile chọn từ More giữ chỗ cạnh các gói
 * danh sách chính đã giữ.
 * Nhận: packages — các gói chính thức Host chào.
 * Trả: các gói theo thứ tự hiển thị.
 */
function orderOptionalBundles(packages: readonly PackageView[]): PackageView[] {
  return [...packages].sort((a, b) => optionalBundleRank(a.name) - optionalBundleRank(b.name));
}

/**
 * Toast giữ bao lâu: đủ để đọc một lỗi có nêu chỗ hỏng.
 * Nhận: text — câu sẽ hiện.
 * Trả: số mili giây giữ, kẹp trong 3s..8s theo độ dài câu.
 */
function toastHoldMs(text: string): number {
  return Math.min(8000, Math.max(3000, text.length * 80));
}

/* ------------------------------------------------------------------------------------------------------------
 * Factory của trang.
 * ---------------------------------------------------------------------------------------------------------- */

/**
 * Dựng trang quản lý plugin (port 1:1 vùng PluginManagerPage của bundle gốc).
 *
 * Nhận: modules — bảng module của nửa browser; deps — các hàm thuộc cụm file khác.
 * Trả: component PluginManagerPage nhận props y bản gốc, đã ràng buộc vào modules.
 */
export function createPluginManagerPage(
  modules: PluginManagerModules,
  deps: PluginManagerPageDeps,
): (props: PluginManagerPageProps) => PageNode {
  const react = modules.react;
  const jsx = modules.jsxRuntime.jsx as PageJsx;
  const jsxs = modules.jsxRuntime.jsxs as PageJsx;
  const Fragment = modules.jsxRuntime.Fragment as (props: { children?: PageNode }) => PageNode;
  const useId = modules.react.useId as () => string;
  const prim = modules.primitives as unknown as PrimitivesSeam;
  const { Button, Menu, MenuItemButton, Tooltip, Toast, StateDot, SegmentedTabs, Tag } = prim;
  const { IconPlusOutlineRegular, IconChevronDownOutlineRegular, IconDownloadOutlineRegular } = prim;
  const { IconChevronRightOutlineRegular, IconChevronLeftOutlineMedium } = prim;
  const { IconRefreshOutlineRegular, IconInfoOutlineRegular, IconWarningOutlineRegular } = prim;
  const { packageText, noticeText, rowKey, isInstallPending, rowConfigKey } = deps;
  const detail = createPageDetail(modules, deps);
  const { PackageArtwork, MetadataError, EnableSwitch, packageStatus, itemArtwork } = detail;
  const { ItemDetail, RowDetail, PackageDetail } = detail;
  const { InstallDialog, ConfirmDialog } = createInstallDialog(modules, deps);

  /** Primary action installs; the adjacent menu offers every add-plugin path. */
  function AddPluginMenu({
    t,
    disabled,
    openInstall,
    renderSlot,
  }: {
    readonly t: PageTranslate;
    readonly disabled: boolean;
    readonly openInstall: () => void;
    readonly renderSlot: RenderSlotsSeam;
  }): PageNode {
    const [open, setOpen] = react.useState<boolean>(false);
    const onDismiss = (): void => {
      setOpen(false);
    };
    return jsxs("span", {
      className: css.addGroup,
      role: "group",
      "aria-label": t("addPlugin"),
      children: [
        jsx(Button, {
          variant: "primary",
          size: "sm",
          className: css.addPrimary,
          icon: jsx(IconPlusOutlineRegular, { size: 13 }),
          disabled,
          onClick: () => {
            onDismiss();
            openInstall();
          },
          children: t("addPlugin"),
        }),
        jsxs(Menu, {
          open,
          onClose: onDismiss,
          align: "end",
          portal: true,
          autoFocus: true,
          listClassName: css.addMenu,
          anchor: jsx(Button, {
            variant: "primary",
            size: "sm",
            className: css.addMore,
            disabled,
            "aria-label": t("chooseAddMethod"),
            "aria-haspopup": "menu",
            "aria-expanded": open,
            onClick: () => {
              setOpen((value) => !value);
            },
            onKeyDown: (event) => {
              if (!open && event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
              }
            },
            children: jsx(IconChevronDownOutlineRegular, { size: 12, "aria-hidden": "true" }),
          }),
          children: [
            jsx(MenuItemButton, {
              icon: jsx(IconDownloadOutlineRegular, { size: 14 }),
              onSelect: () => {
                onDismiss();
                openInstall();
              },
              children: jsxs("span", {
                className: css.addMenuItem,
                children: [
                  jsx("span", { children: t("installExisting") }),
                  jsx("span", { className: css.addMenuDescription, children: t("installExistingDescription") }),
                ],
              }),
            }),
            renderSlot("plugins.add.actions", { onDismiss }),
          ],
        }),
      ],
    });
  }

  /** The head every card shares: the artwork, the name that opens the page beside its tags, its one-liner, and what sits at the end. */
  function CardHead({
    title,
    t,
    onOpen,
    icon,
    tags,
    description,
    end,
  }: {
    readonly title: string;
    readonly t: PageTranslate;
    readonly onOpen: () => void;
    readonly icon: PageNode;
    readonly tags?: PageNode;
    readonly description?: PageNode;
    readonly end?: PageNode;
  }): PageNode {
    const descriptionId = useId();
    return jsxs("div", {
      className: css.cardHead,
      children: [
        jsx("span", { className: css.cardIcon, "aria-hidden": "true", children: icon }),
        jsxs("div", {
          className: css.cardMain,
          children: [
            jsxs("div", {
              className: css.titleRow,
              children: [
                jsx("button", {
                  type: "button",
                  className: css.cardTitle + " " + css.cardOpen,
                  "aria-label": t("openDetail", { name: title }),
                  "aria-describedby": description === undefined ? undefined : descriptionId,
                  onClick: onOpen,
                  children: title,
                }),
                tags,
              ],
            }),
            description === undefined
              ? null
              : jsx("span", { className: css.cardDesc, id: descriptionId, children: description }),
          ],
        }),
        end === undefined ? null : jsx("div", { className: css.cardEnd, children: end }),
      ],
    });
  }

  /** First-read placeholders share the core configuration group's card and text-line layout. */
  function ListSkeleton({ label }: { readonly label: string }): PageNode {
    return jsxs("section", {
      className: css.group,
      role: "status",
      "aria-label": label,
      "data-plugin-loading": true,
      children: [
        jsx("div", {
          className: css.groupHead,
          "aria-hidden": "true",
          children: jsx("span", {
            className: css.groupTitle + " " + css.skeletonText + " " + css.skeletonHeading,
            children: jsx("span", { className: css.skeletonFill + " " + css.skeletonBar }),
          }),
        }),
        jsxs("ul", {
          className: css.cards,
          "aria-hidden": "true",
          children: [0, 1, 2, 3].map((index) =>
            jsx(
              "li",
              {
                className: css.card,
                children: jsxs("div", {
                  className: css.cardHead,
                  children: [
                    jsx("span", { className: css.cardIcon + " " + css.skeletonFill + " " + css.skeletonIcon }),
                    jsxs("div", {
                      className: css.cardMain,
                      children: [
                        jsx("div", {
                          className: css.titleRow,
                          children: jsx("span", {
                            className: css.cardTitle + " " + css.skeletonText + " " + css.skeletonTitle,
                            children: jsx("span", { className: css.skeletonFill + " " + css.skeletonBar }),
                          }),
                        }),
                        jsx("span", {
                          className: css.cardDesc + " " + css.skeletonText + " " + css.skeletonDescription,
                          children: jsx("span", { className: css.skeletonFill + " " + css.skeletonBar }),
                        }),
                      ],
                    }),
                    jsx("div", { className: css.cardEnd + " " + css.skeletonActions }),
                  ],
                }),
              },
              index,
            ),
          ),
        }),
      ],
    });
  }

  /** One package as a card that opens its page: its name, its one-liner, its tags, and its bundle switch. */
  function PackageCard({
    pkg,
    t,
    resolveText,
    busy,
    highlighted,
    onOpen,
    onSetEnabled,
  }: {
    readonly pkg: PackageView;
    readonly t: PageTranslate;
    readonly resolveText: ResolveText;
    readonly busy: boolean;
    readonly highlighted: boolean;
    readonly onOpen: () => void;
    readonly onSetEnabled: (enabled: boolean) => void;
  }): PageNode {
    const { title, description, beta } = packageText(pkg, resolveText);
    const status = packageStatus(pkg);
    return jsxs("li", {
      className: css.card + " " + css.cardLink,
      "data-plugin-package": pkg.name,
      "data-plugin-status": status,
      ...(highlighted ? { "data-plugin-highlight": "" } : {}),
      children: [
        jsx(CardHead, {
          title,
          t,
          onOpen,
          icon: jsx(PackageArtwork, { src: pkg.meta?.icon }, pkg.meta?.icon),
          tags: jsxs(Fragment, {
            children: [
              beta ? jsx(Tag, { className: css.statusTag, tone: "info", children: t("statusBeta") }) : null,
              status === "problem" ? jsx(Tag, { className: css.statusTag, tone: "danger", children: t("statusProblem") }) : null,
              pkg.availability === "missing"
                ? jsx(Tag, { className: css.statusTag, children: t(pkg.installed ? "statusMissingFiles" : "statusNotInstalled") })
                : null,
              detail.updateAvailable(pkg)
                ? jsx(Tag, { className: css.statusTag, tone: "info", children: t("statusUpdateAvailable") })
                : null,
            ],
          }),
          description,
          end: jsx(EnableSwitch, { pkg, title, t, busy, onSetEnabled }),
        }),
        jsx(MetadataError, { error: pkg.meta?.error, t }),
      ],
    });
  }

  /** One official plugin as a card that opens its page: its icon, its title from the registration, and the one-liner the entry renders in its summary view. */
  function ItemCard({
    item,
    t,
    onOpen,
    renderSlot,
  }: {
    readonly item: { readonly id: string; readonly label: string };
    readonly t: PageTranslate;
    readonly onOpen: () => void;
    readonly renderSlot: RenderSlotsSeam;
  }): PageNode {
    return jsx("li", {
      className: css.card + " " + css.cardLink,
      "data-plugin-item": item.id,
      children: jsx(CardHead, {
        title: item.label,
        t,
        onOpen,
        icon: itemArtwork(item.id),
        description: renderSlot("plugins.item", { view: "summary" }, { only: item.id }),
      }),
    });
  }

  /** Render the plugin manager: the official plugins and installed bundles, their pages, the install dialog, and the confirmation. */
  function PluginManagerPage(props: PluginManagerPageProps): PageNode {
    const { t, ensure, renderSlot, resolveText } = props;
    const configurations = props.useConfigurations((snapshot) => snapshot.view?.namespaces);
    const formFor = (id: string): ConfigPageForm | undefined => {
      if (!configurations?.some((view) => view.ns === id)) return undefined;
      const form = props.configForm(id);
      return { state: form.getSnapshot(), mutate: (ops, revision) => form.mutate(ops, revision) };
    };
    const state = props.usePluginManager((snapshot) => snapshot);
    const ledger = props.useConfigLedger((snapshot) => snapshot);
    const view = props.useStore((state) => state.view);
    const { setView, setTab } = props.actions;
    const tabs = props.usePluginTabs((snapshot) => snapshot);
    const selectedTab = props.useStore((state) => state.tab);
    const tab = tabs.some((item) => item.id === selectedTab) ? selectedTab : INSTALLED_TAB;
    react.useEffect(() => {
      if (tab !== selectedTab) setTab(tab);
    }, [tab, selectedTab, setTab]);
    react.useEffect(() => {
      if (state.highlight !== null) setTab(INSTALLED_TAB);
    }, [state.highlight, setTab]);
    const tabsId = useId();
    const [activation, setActivation] = react.useState<string | null>(null);
    react.useEffect(() => {
      ensure();
    }, [ensure]);
    const { highlight, clearHighlight } = { highlight: state.highlight, clearHighlight: props.clearHighlight };
    react.useEffect(() => {
      if (highlight === null) return;
      const card = document.querySelector('[data-plugin-package="' + highlight + '"]');
      if (card !== null && typeof card.scrollIntoView === "function")
        card.scrollIntoView({ block: "center", behavior: "smooth" });
      const timer = setTimeout(clearHighlight, HIGHLIGHT_MS);
      return () => {
        clearTimeout(timer);
      };
    }, [highlight, clearHighlight]);
    const noticeLine = state.notice === null || state.notice.kind === "refresh-failed" ? null : noticeText(state.notice, t);
    const listed = state.packages.filter((pkg) => !BUILTIN_PROFILE_BUNDLES.has(pkg.name) && (pkg.installed || pkg.official || pkg.error !== undefined));
    const mine = listed.filter((pkg) => !pkg.official);
    const official = listed.filter((pkg) => pkg.official);
    const ordered = orderOptionalBundles(official);
    const pinned = new Set(official.filter(pinnedToMainList).map((pkg) => pkg.name));
    const extensions = ordered.filter((pkg) => pinned.has(pkg.name));
    const more = ordered;
    const loaded = state.status === "ready" || state.status === "error";
    const refreshing = state.refreshStatus === "refreshing";
    const openPkg = view.kind === "package" || view.kind === "row" ? listed.find((pkg) => pkg.name === view.name) : undefined;
    const openItem = view.kind === "item" ? ledger.items.find((item) => item.id === view.id) : undefined;
    const openRow = view.kind === "row" && openPkg !== undefined ? openPkg.rows.find((row) => row.rowId === view.rowId) : undefined;
    const onInstalled = tab === INSTALLED_TAB;
    const showsCards = !onInstalled || (openPkg === undefined && openItem === undefined);
    const detailFromMore =
      (view.kind === "package" || view.kind === "row") &&
      (view.from === "more" || (MORE_BUNDLES.includes(view.name) && !pinned.has(view.name)));
    const showsMoreList = onInstalled && showsCards && (view.kind === "more" || detailFromMore);
    const showsMainList = showsCards && !showsMoreList;
    const installedCards = onInstalled && showsCards;
    const openPkgInMore = openPkg !== undefined && openPkg.official && detailFromMore;
    const installedPanel =
      tabs.length === 0 || showsMoreList
        ? {}
        : {
            role: "tabpanel",
            id: tabsId + "-" + INSTALLED_TAB + "-panel",
            "aria-labelledby": tabsId + "-" + INSTALLED_TAB,
          };
    const activated = listed.find((pkg) => pkg.name === activation && pkg.enabled && !state.busy.includes(pkg.name));
    const setRowEnabled = (row: PackageRowView, enabled: boolean): void => {
      if (row.entryId !== undefined) props.setRowEnabled(row.entryId, enabled);
    };
    const configure = (pkg: PackageView) => ({
      has: (row: PackageRowView): boolean => ledger.rows.has(rowConfigKey(pkg.name, row.rowId)),
      open: (row: PackageRowView): void => {
        setView({
          kind: "row",
          name: pkg.name,
          rowId: row.rowId,
          ...(openPkgInMore ? { from: "more" as const } : {}),
        });
      },
    });
    const packageBusy = (pkg: PackageView): boolean =>
      state.busy.includes(pkg.name) ||
      (state.install.subject?.name === pkg.name && (isInstallPending(state.install.phase) || state.install.phase === "checking"));
    const packageCard = (pkg: PackageView): PageNode =>
      jsx(
        PackageCard,
        {
          pkg,
          t,
          resolveText,
          busy: packageBusy(pkg),
          highlighted: state.highlight === pkg.name,
          onOpen: () => {
            setActivation(null);
            setView({
              kind: "package",
              name: pkg.name,
              ...(showsMoreList ? { from: "more" as const } : {}),
            });
          },
          onSetEnabled: (enabled) => {
            setActivation(enabled ? pkg.name : null);
            props.setEnabled(pkg.name, enabled);
          },
        },
        pkg.name,
      );
    const basicCards = ledger.items.map((item) =>
      jsx(
        ItemCard,
        {
          item,
          t,
          renderSlot,
          onOpen: () => {
            setView({ kind: "item", id: item.id });
          },
        },
        "item:" + item.id,
      ),
    );
    const renderGroup = (id: string, heading: string, cards: readonly PageNode[]): PageNode => {
      const offersMore = id === "extensions" && more.length > 0;
      if (cards.length === 0 && !offersMore) return null;
      return jsxs("section", {
        className: css.group,
        "data-plugin-scope": "global",
        "data-plugin-group": id,
        children: [
          jsxs("div", {
            className: css.groupHead,
            children: [
              jsx("h3", { className: css.groupTitle, children: heading }),
              offersMore
                ? jsxs(Button, {
                    size: "sm",
                    className: css.groupMore,
                    onClick: () => {
                      setView({ kind: "more" });
                    },
                    children: [t("moreAction"), jsx(IconChevronRightOutlineRegular, { size: 14, "aria-hidden": "true" })],
                  })
                : null,
            ],
          }),
          cards.length > 0 ? jsx("ul", { className: css.cards, children: cards }) : null,
        ],
      });
    };
    return jsxs("section", {
      className: css.page,
      "data-plugin-panel": true,
      "aria-busy": state.status === "loading" || refreshing,
      children: [
        showsMainList
          ? jsxs("header", {
              className: css.pageHead,
              "data-window-drag": true,
              children: [
                jsxs("div", {
                  className: css.pageHeading,
                  children: [
                    jsx("h1", { className: css.pageTitle, children: t("title") }),
                    jsxs("div", {
                      className: css.pageIntro,
                      children: [
                        jsx("span", { children: t("intro") }),
                        jsx(Tooltip, {
                          label: t("infoDescription"),
                          side: "bottom",
                          delayMs: 300,
                          maxWidth: 300,
                          portal: true,
                          openOnClick: true,
                          children: jsx(Button, {
                            variant: "ghost",
                            size: "sm",
                            className: css.infoButton,
                            "aria-label": t("infoLabel"),
                            children: jsx(IconInfoOutlineRegular, { size: 11, "aria-hidden": "true" }),
                          }),
                        }),
                      ],
                    }),
                  ],
                }),
                jsxs("div", {
                  className: css.toolbar,
                  hidden: !onInstalled,
                  children: [
                    jsx(Tooltip, {
                      label: t("refresh"),
                      delayMs: 500,
                      focusDelayMs: 500,
                      side: "bottom",
                      portal: true,
                      disabled: !loaded || refreshing,
                      children: jsx("button", {
                        type: "button",
                        className: css.iconButton,
                        "aria-label": t("refresh"),
                        "aria-busy": refreshing,
                        disabled: !loaded || refreshing,
                        onClick: props.refresh,
                        children: jsx("span", {
                          className: css.iconWrap,
                          "aria-hidden": "true",
                          children: refreshing
                            ? jsx(StateDot, { state: "ongoing", size: 18 })
                            : jsx(IconRefreshOutlineRegular, {}),
                        }),
                      }),
                    }),
                    state.install.requestId === undefined
                      ? jsx(AddPluginMenu, { t, disabled: !loaded, openInstall: props.openInstall, renderSlot })
                      : jsx(Button, {
                          variant: "primary",
                          size: "sm",
                          className: css.addButton,
                          icon: jsx(IconPlusOutlineRegular, { size: 13 }),
                          disabled: !loaded,
                          onClick: props.openInstall,
                          children: t("installViewTask"),
                        }),
                  ],
                }),
              ],
            })
          : null,
        showsMainList && tabs.length > 0
          ? jsx("div", {
              className: css.pageTabs,
              children: jsx(SegmentedTabs, {
                className: css.pageTabList,
                label: t("tabsLabel"),
                value: tab,
                onChange: (next: string) => {
                  setTab(next);
                },
                items: [
                  {
                    value: INSTALLED_TAB,
                    label: t("installedTab"),
                    id: tabsId + "-" + INSTALLED_TAB,
                    panelId: tabsId + "-" + INSTALLED_TAB + "-panel",
                  },
                  ...tabs.map((item) => ({
                    value: item.id,
                    label: item.label,
                    id: tabsId + "-" + item.id,
                    panelId: tabsId + "-" + item.id + "-panel",
                  })),
                ],
              }),
            })
          : null,
        !onInstalled
          ? jsx("div", {
              role: "tabpanel",
              id: tabsId + "-" + tab + "-panel",
              "aria-labelledby": tabsId + "-" + tab,
              className: css.tabPanel,
              children: renderSlot(
                "plugins.tab",
                {
                  install: props.installFrom,
                  openPackage: (name: string) => {
                    setTab(INSTALLED_TAB);
                    setView({ kind: "package", name });
                  },
                },
                { only: tab },
              ),
            })
          : null,
        showsMoreList
          ? jsxs("header", {
              className: css.moreHead,
              "data-window-drag": true,
              children: [
                jsx(Button, {
                  size: "sm",
                  className: css.moreBack,
                  "aria-label": t("backToList"),
                  onClick: () => {
                    setView({ kind: "list" });
                  },
                  children: jsx(IconChevronLeftOutlineMedium, { size: 20, "aria-hidden": "true" }),
                }),
                jsx("h1", { className: css.pageTitle, children: t("moreTitle") }),
              ],
            })
          : null,
        installedCards && !loaded
          ? jsxs("div", {
              className: css.installedPanel,
              ...installedPanel,
              children: [
                state.status === "loading" ? jsx(ListSkeleton, { label: t("loading") }) : null,
                state.status === "unavailable"
                  ? jsxs("p", {
                      className: css.status + " " + css.statusWithDot,
                      role: "status",
                      children: [jsx(StateDot, { state: "idle" }), t("unavailable")],
                    })
                  : null,
              ],
            })
          : null,
        state.notice === null || noticeLine === null
          ? null
          : jsx(
              Toast,
              {
                text: noticeLine,
                icon: jsx(IconWarningOutlineRegular, {}),
                holdMs: toastHoldMs(noticeLine),
                onDone: props.dismissNotice,
              },
              state.notice.seq,
            ),
        !showsCards && state.status === "error" && !refreshing
          ? jsxs("div", {
              className: css.failure,
              children: [
                jsxs("p", {
                  className: css.statusWithDot,
                  role: "alert",
                  children: [
                    jsx(StateDot, { state: "error" }),
                    t(state.refreshStatus === "failed" ? "refreshError" : "error"),
                  ],
                }),
                jsx(Button, {
                  variant: "outline",
                  size: "sm",
                  onClick: props.refresh,
                  children: t("retry"),
                }),
              ],
            })
          : null,
        onInstalled && loaded && openPkg !== undefined && openRow !== undefined
          ? jsx(RowDetail, {
              pkg: openPkg,
              row: openRow,
              form: formFor(openRow.rowId),
              t,
              resolveText,
              renderSlot,
              onBack: () => {
                setView({
                  kind: "package",
                  name: openPkg.name,
                  ...(openPkgInMore ? { from: "more" as const } : {}),
                });
              },
            })
          : null,
        onInstalled && loaded && openPkg !== undefined && openRow === undefined
          ? jsx(PackageDetail, {
              pkg: openPkg,
              t,
              resolveText,
              busy: packageBusy(openPkg),
              rowBusy: (row) => row.entryId !== undefined && state.busy.includes(rowKey(row.entryId)),
              configured: ledger.bundles.has(openPkg.name),
              configure: configure(openPkg),
              renderSlot,
              inMore: openPkgInMore,
              onBack: () => {
                setView({ kind: openPkgInMore ? "more" : "list" });
              },
              onSetEnabled: (enabled) => {
                props.setEnabled(openPkg.name, enabled);
              },
              onUninstall: () => {
                props.uninstall(openPkg.name);
              },
              onUpdate: () => {
                props.update(openPkg.name);
              },
              onSetRowEnabled: setRowEnabled,
            })
          : null,
        onInstalled && loaded && openItem !== undefined
          ? jsx(ItemDetail, {
              form: formFor(openItem.id),
              item: openItem,
              t,
              renderSlot,
              onBack: () => {
                setView({ kind: "list" });
              },
            })
          : null,
        loaded && installedCards
          ? basicCards.length === 0 && official.length === 0 && mine.length === 0 && state.status !== "error"
            ? jsx("div", {
                className: css.installedPanel,
                ...installedPanel,
                children: jsx("p", { className: css.empty, children: t("empty") }),
              })
            : jsxs("div", {
                className: css.installedPanel,
                ...installedPanel,
                children: [
                  showsMoreList
                    ? jsx("section", {
                        className: css.group,
                        "data-plugin-scope": "global",
                        "data-plugin-group": "more",
                        children: jsx("ul", { className: css.cards, children: more.map(packageCard) }),
                      })
                    : jsxs(Fragment, {
                        children: [
                          renderGroup("basic", t("basicTitle"), basicCards),
                          renderGroup("extensions", t("extensionsTitle"), extensions.map(packageCard)),
                          renderGroup("bundles", t("bundlesTitle"), mine.map(packageCard)),
                        ],
                      }),
                  state.status === "error" && !refreshing
                    ? jsxs("div", {
                        className: css.failure,
                        children: [
                          jsxs("p", {
                            className: css.statusWithDot,
                            role: "alert",
                            children: [
                              jsx(StateDot, { state: "error" }),
                              t(state.refreshStatus === "failed" ? "refreshError" : "error"),
                            ],
                          }),
                          jsx(Button, {
                            variant: "outline",
                            size: "sm",
                            onClick: props.refresh,
                            children: t("retry"),
                          }),
                        ],
                      })
                    : null,
                ],
              })
          : null,
        showsCards && activated !== undefined && !state.install.open
          ? renderSlot(
              "plugins.bundle.activation",
              {
                packageName: activated.name,
                onDismiss: () => {
                  setActivation(null);
                },
                onOpenDetails: () => {
                  setActivation(null);
                  setView({
                    kind: "package",
                    name: activated.name,
                    ...(showsMoreList ? { from: "more" as const } : {}),
                  });
                },
              },
              { entryKey: activated.name },
            )
          : null,
        jsx(InstallDialog, {
          install: state.install,
          t,
          onClose: props.closeInstall,
          onEditSpec: props.editInstallSpec,
          onRun: props.runInstall,
          onCancel: props.cancelInstall,
          onReconcile: props.reconcileInstall,
          onToggleDetails: props.toggleInstallDetails,
          onEnableNow: () => {
            setActivation(state.install.installed);
            props.enableInstalled();
          },
          onApproveBuilds: props.approveBuildsAndRetry,
          onToggleRegistry: props.toggleRegistryOptions,
          onChooseRegistry: props.chooseRegistry,
          onChangeRegistry: props.changeRegistry,
          onUseGithubMirror: props.useGithubMirror,
        }),
        state.confirm === null
          ? null
          : jsx(ConfirmDialog, {
              name: packageText(
                state.packages.find((pkg) => pkg.name === state.confirm?.packageName) ?? { name: state.confirm.packageName },
                resolveText,
              ).title,
              t,
              onConfirm: props.confirm,
              onCancel: props.cancelConfirm,
            }),
      ],
    });
  }

  return PluginManagerPage;
}
