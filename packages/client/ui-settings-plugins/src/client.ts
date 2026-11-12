/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Nua client cua row ui-settings-plugins: dang ky MOT id module (id cua ta) + mot slot occupant "plugins"
 *      trong settings.section, va chrome tab quanh cac tab do tinh nang khac dong gop
 */

import { en, LOCALE_KEY, zh, type PluginsLocaleKey } from "./locales.ts";
import { vi } from "./locales-vi.ts";

/** Tên package của ta: id CHÍNH của module (khớp dòng manifest ⇒ HMR tra đúng rev) và là `data-plugin` của thẻ style. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-plugins";

// Slot điều hướng Settings mà mục Plugins đăng ký vào. Hai chỗ đăng ký dưới đây ghi THẲNG chuỗi
// "settings.section" (không qua hằng) đúng như bản gốc đã build — cổng chặn mount đọc slot từ mã nguồn
// bằng chuỗi literal, viết qua hằng sẽ bị coi là "thiếu đăng ký slot" và gói bị bỏ qua khi mount.

/** Slot chứa các tab do tính năng khác đóng góp; mục Plugins chỉ dựng chrome quanh chúng. */
const TAB_SLOT = "settings.plugins.tab";

/** Id của SLOT OCCUPANT (KHÔNG phải id module — xem bảng phân biệt id trong công thức mục 6). */
const SECTION_OCCUPANT_ID = "plugins";

/** Thứ tự của mục Plugins trong điều hướng Settings (giữ nguyên 15 như bản gốc). */
const SECTION_ORDER = 15;

/** Nhãn hiệu ứng của từ điển locale (giữ nguyên chuỗi của bản gốc để chẩn đoán không lệch). */
const LOCALE_EFFECT_LABEL = "ui-settings-plugins: section dictionaries";

/** Bảng module của trang: CHỈ id truyền vào `load()` mới vào bảng module. */
const loader = (globalThis as unknown as { __ModuleLoader__: ModuleLoaderFacade }).__ModuleLoader__;

/** `require` do bảng module cấp cho factory (lazy-CJS, hợp đồng C2). */
type RequireFn = (specifier: string) => unknown;

/** Facade `window.__ModuleLoader__` (hợp đồng C2) — nửa client chỉ cần `load`. */
interface ModuleLoaderFacade {
  /**
   * Xếp hàng một factory lười cho một id module.
   * Nhận: `id` là id mà BUNDLE tự khai, `factory` nhận `require` và trả export của module.
   * Trả: không.
   */
  load(registration: { id: string; factory: (require: RequireFn) => unknown }): void;
}

/** Bảng `ui-slots` (chỉ phần mục này dùng). */
interface SlotsModule {
  /**
   * Chuẩn hoá nhãn của một occupant thành chuỗi hiển thị.
   * Nhận: nhãn thô (chuỗi, hàm, hoặc giá trị khác).
   * Trả: chuỗi hiển thị, hoặc `undefined` khi occupant không có nhãn.
   */
  resolveSlotLabel(label: unknown): string | undefined;
}

/** Bảng hook React mà mục này dùng. */
interface ReactHooks {
  /** Trả về một id duy nhất, ổn định trong suốt vòng đời component. */
  useId(): string;
  /** Trả về hộp giữ giá trị bền qua các lần render. */
  useRef<T>(initial: T): { current: T };
  /** Trả về cặp [giá trị, hàm đặt giá trị]. */
  useState<S>(initial?: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void];
  /** Chạy hiệu ứng sau khi render, dọn dẹp giá trị trả về khi phụ thuộc đổi. */
  useEffect(effect: () => void | (() => void), deps: readonly unknown[]): void;
}

/** Bảng `react/jsx-runtime` (chỉ phần mục này dùng). */
interface JsxRuntime {
  /** Fragment của React, dùng để trả nhiều phần tử mà không thêm node bọc. */
  Fragment: unknown;
  /** Dựng phần tử có một con. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Dựng phần tử có nhiều con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
}

/** Một tab do tính năng khác đóng góp vào `settings.plugins.tab`. */
interface PluginsTabEntry {
  /** Id occupant, dùng làm khoá React và địa chỉ panel. */
  id: string;
  /** Thứ tự hiển thị (nhỏ trước). */
  order: number;
  /** Nhãn đã bản địa hoá. */
  label: string;
}

/** Props mà renderer bind cho mục Plugins (giữ đúng hình dạng của bản gốc). */
interface PluginsSectionProps {
  /**
   * Dịch một khoá của từ điển `settings.plugins`.
   * Nhận: khoá.
   * Trả: chuỗi đã dịch theo locale đang chọn.
   */
  t(key: PluginsLocaleKey): string;
  /**
   * Render nội dung một slot.
   * Nhận: tên slot, props thêm, và tuỳ chọn `only` giới hạn theo occupant.
   * Trả: cây element của occupant.
   */
  renderSlot(slot: string, props: Record<string, unknown>, options: { only: string }): unknown;
  /**
   * Theo dõi sổ occupant của slot tab.
   * Nhận: hàm chọn phần state cần dùng.
   * Trả: giá trị đã chọn, render lại khi sổ đổi.
   */
  useTabs<T>(selector: (value: readonly PluginsTabEntry[]) => T): T;
}

/** Sự kiện bàn phím mà tablist cần (chỉ phần dùng). */
interface TabKeyEvent {
  /** Tên khoá vừa bấm, ví dụ `ArrowRight`. */
  key: string;
  /** Chặn hành vi mặc định của phím khi tablist đã xử lý. */
  preventDefault(): void;
}

/** Phần tử tab có thể nhận focus. */
interface FocusableTab {
  /** Đưa focus vào tab. */
  focus(): void;
}

/** Một occupant trong sổ của một slot. */
interface SlotLedgerEntry {
  /** Tuỳ chọn đăng ký của occupant. */
  options: {
    /** Id occupant; thiếu thì tính là chuỗi rỗng. */
    id?: string;
    /** Thứ tự; thiếu thì tính là 0. */
    order?: number;
    /** Nhãn thô của occupant. */
    label?: unknown;
  };
}

/** Context plugin phía browser (chỉ seam mà mục này dùng). */
interface ClientContext {
  /**
   * Gắn một hiệu ứng vào vòng đời plugin.
   * Nhận: hàm hiệu ứng (trả hàm dọn dẹp) và nhãn chẩn đoán.
   * Trả: không.
   */
  effect(callback: () => void | (() => void), label: string): void;
  /** Seam từ điển của client. */
  locale: {
    /** Buộc một namespace thành hàm dịch. */
    bind(namespace: string): (key: PluginsLocaleKey) => string;
    /** Đăng ký từ điển cho một namespace; trả hàm gỡ đăng ký. */
    register(namespace: string, copy: Record<string, Record<string, string>>): () => void;
    /** Đọc bản chụp hiện tại của kho từ điển (có `revision` tăng mỗi lần đổi). */
    getSnapshot(): { revision: number };
    /** Theo dõi thay đổi từ điển; trả hàm gỡ. */
    subscribe(listener: () => void): () => void;
  };
  /** Seam sổ occupant của các slot. */
  slots: {
    /** Đọc số phiên bản của một slot (tăng mỗi lần sổ đổi). */
    getVersion(slot: string): number;
    /** Đọc danh sách occupant của một slot. */
    entries(slot: string): SlotLedgerEntry[];
    /** Theo dõi thay đổi sổ của một slot; trả hàm gỡ. */
    subscribe(slot: string, listener: () => void): () => void;
    /** Đăng ký vào một slot ngay khi slot đó sống. */
    inject(slot: string, register: () => unknown): void;
    /** Chiếm một chỗ trong slot; trả hàm gỡ. */
    register(definition: Record<string, unknown>, component: unknown): () => void;
  };
}

/** Business face mà section bơm cho renderer. */
interface PluginsSectionInjected {
  /** Hook cho chrome tab. */
  hooks: {
    /** Ledger tab đã sắp theo `order` và bản địa hoá. */
    tabs: {
      /** Đọc ledger hiện tại (memoize theo phiên bản sổ + revision từ điển). */
      getSnapshot(): readonly PluginsTabEntry[];
      /** Theo dõi cả sổ tab lẫn từ điển; trả hàm gỡ cả hai. */
      subscribe(listener: () => void): () => void;
    };
  };
}

/** Tên lớp CSS của mục Plugins — GIỮ NGUYÊN tên lớp của bản gốc để bề mặt DOM không lệch. */
const CLASS = {
  section: "pbvGtq_section",
  heading: "pbvGtq_heading",
  intro: "pbvGtq_intro",
  tabs: "pbvGtq_tabs",
  tab: "pbvGtq_tab",
  panel: "pbvGtq_panel",
  cards: "pbvGtq_cards",
  empty: "pbvGtq_empty",
  configurable: "pbvGtq_configurable",
  presetSettings: "pbvGtq_presetSettings",
  presetSettingsTitle: "pbvGtq_presetSettingsTitle",
} as const;

/**
 * CSS của mục Plugins, viết lại theo token `--dsw-*` của DSH (cùng khai báo, cùng tên lớp như bản gốc).
 * Nhúng thẳng vào bundle vì `bh host` chỉ mount `package.json` + `lib/*.js` vào profile.
 */
const STYLES = [
  "." + CLASS.section + " { max-width: 760px; display: flex; flex-direction: column; gap: 12px; color: var(--dsw-alias-label-primary); }",
  "." + CLASS.heading + " { margin: 0; font-size: 18px; font-weight: 600; }",
  "." + CLASS.intro + " { margin: 0; font-size: 13px; color: var(--dsw-alias-label-tertiary); }",
  "." + CLASS.tabs + " { display: flex; align-items: flex-end; gap: 22px; margin-top: 2px; border-bottom: .5px solid var(--dsw-alias-border-l2); }",
  "." + CLASS.tab + " { position: relative; padding: 7px 1px 9px; border: 0; background: none; font: inherit; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary); cursor: pointer; }",
  "." + CLASS.tab + ":hover, ." + CLASS.tab + "[data-active=true] { color: var(--dsw-alias-label-primary); }",
  "." + CLASS.tab + "[data-active=true]::after, ." + CLASS.tab + ":focus-visible::after { content: \"\"; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; border-radius: 2px 2px 0 0; background: var(--dsw-alias-label-primary); }",
  "." + CLASS.tab + ":focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; border-radius: 2px; color: var(--dsw-alias-label-primary); }",
  "." + CLASS.panel + " { min-width: 0; padding-top: 2px; }",
  "." + CLASS.cards + " { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }",
  "." + CLASS.empty + " { margin: 0; font-size: 13px; color: var(--dsw-alias-label-tertiary); }",
  "." + CLASS.configurable + " { display: flex; flex-direction: column; gap: 10px; }",
  "." + CLASS.presetSettings + " { display: flex; flex-direction: column; gap: 8px; }",
  "." + CLASS.presetSettingsTitle + " { margin: 0; font-size: 15px; font-weight: 600; line-height: 22px; }",
].join("");

/**
 * Chèn stylesheet của mục Plugins vào `<head>` đúng một lần (idempotent theo `data-plugin-css`).
 * Nhận: không.
 * Trả: không.
 */
function injectStyles(): void {
  if (typeof document === "undefined") return;
  const tagId = PACKAGE_NAME + "/PluginsSettingsSection.module.css";
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/**
 * Cờ chặn cài hai lần ở PHẠM VI MODULE (hai entry ⇒ hai ctx nên khoá theo ctx không chặn được).
 * Bật SAU khi phần đăng ký chạy xong; bật sớm mà đăng ký ném giữa đường ⇒ slot không được đăng ký lại.
 */
let installed = false;

/**
 * Tạo plugin phía browser của row `ui-settings-plugins`.
 * Nhận: `requireFn` — hàm require do bảng module cấp.
 * Trả: bề mặt plugin `{ apply, inject }` mà bảng module phát cho Loader.
 */
function createPlugin(requireFn: RequireFn): { apply(ctx: ClientContext): void; inject: string[] } {
  const hooks = requireFn("react") as ReactHooks;
  const { Fragment, jsx, jsxs } = requireFn("react/jsx-runtime") as JsxRuntime;
  const { resolveSlotLabel } = requireFn("@galaxy-blackhole/gbh-client-ui-slots") as SlotsModule;

  injectStyles();

  /**
   * Trang Plugins: tiêu đề + phần mở đầu + chrome tab quanh nội dung do tính năng sở hữu.
   * Một tab duy nhất thì render thẳng panel (không dựng tablist); tab đã xem được giữ mounted.
   * Nhận: props do renderer bind (`t`, `renderSlot`, `useTabs`).
   * Trả: cây element React của trang.
   */
  function PluginsSettingsSection(props: PluginsSectionProps): unknown {
    const tabsId = hooks.useId();
    const tabRefs = hooks.useRef<unknown[]>([]);
    const rows = props.useTabs((value) => value);
    const [activeId, setActiveId] = hooks.useState<string | undefined>();
    const [visitedIds, setVisitedIds] = hooks.useState<Set<string>>(() => new Set<string>());
    const active = rows.find((row) => row.id === activeId)?.id ?? rows[0]?.id;
    const single = rows.length === 1 ? rows[0] : undefined;
    hooks.useEffect(() => {
      if (active === undefined) return;
      setVisitedIds((previous) => {
        if (previous.has(active)) return previous;
        return new Set([...previous, active]);
      });
    }, [active]);
    const children: unknown[] = [
      jsx("h2", { className: CLASS.heading, children: props.t("title") }),
      jsx("p", { className: CLASS.intro, children: props.t("intro") }),
    ];
    if (rows.length === 0) {
      children.push(jsx("p", { className: CLASS.empty, children: props.t("empty") }));
    } else if (single !== undefined) {
      children.push(
        jsx("div", {
          className: CLASS.panel,
          children: props.renderSlot(TAB_SLOT, {}, { only: single.id }),
        }),
      );
    } else {
      children.push(
        jsxs(Fragment, {
          children: [
            jsx("div", {
              className: CLASS.tabs,
              role: "tablist",
              "aria-label": props.t("tabs"),
              children: rows.map((row, index) => {
                const selected = row.id === active;
                return jsx(
                  "button",
                  {
                    ref: (element: unknown) => {
                      tabRefs.current[index] = element;
                    },
                    id: tabsId + "-tab-" + row.id,
                    type: "button",
                    role: "tab",
                    className: CLASS.tab,
                    "aria-selected": selected,
                    "aria-controls": tabsId + "-panel-" + row.id,
                    "data-active": selected ? "true" : undefined,
                    tabIndex: selected ? 0 : -1,
                    onClick: () => {
                      setActiveId(row.id);
                    },
                    onKeyDown: (event: TabKeyEvent) => {
                      let nextIndex: number;
                      switch (event.key) {
                        case "ArrowRight":
                          nextIndex = (index + 1) % rows.length;
                          break;
                        case "ArrowLeft":
                          nextIndex = (index - 1 + rows.length) % rows.length;
                          break;
                        case "Home":
                          nextIndex = 0;
                          break;
                        case "End":
                          nextIndex = rows.length - 1;
                          break;
                        default:
                          return;
                      }
                      event.preventDefault();
                      const nextRow = rows[nextIndex];
                      const nextTab = tabRefs.current[nextIndex];
                      if (nextRow === undefined) return;
                      setActiveId(nextRow.id);
                      (nextTab as FocusableTab | undefined)?.focus();
                    },
                    children: row.label,
                  },
                  row.id,
                );
              }),
            }),
            rows
              .filter((row) => row.id === active || visitedIds.has(row.id))
              .map((row) =>
                jsx(
                  "div",
                  {
                    id: tabsId + "-panel-" + row.id,
                    className: CLASS.panel,
                    role: "tabpanel",
                    "aria-labelledby": tabsId + "-tab-" + row.id,
                    hidden: row.id !== active,
                    children: props.renderSlot(TAB_SLOT, {}, { only: row.id }),
                  },
                  row.id,
                ),
              ),
          ],
        }),
      );
    }
    return jsxs("div", { className: CLASS.section, children });
  }

  /**
   * Gắn mục Plugins vào Settings: từ điển locale + slot occupant `plugins` + ledger tab cho chrome.
   * Nhận: `ctx` — context plugin phía browser.
   * Trả: không.
   */
  function applyInner(ctx: ClientContext): void {
    const t = ctx.locale.bind(LOCALE_KEY);
    ctx.effect(() => ctx.locale.register(LOCALE_KEY, { vi, zh, en }), LOCALE_EFFECT_LABEL);
    let tabsVersion = -1;
    let tabsRevision = -1;
    let tabs: PluginsTabEntry[] = [];
    const sectionInjected = (): PluginsSectionInjected => ({
      hooks: {
        tabs: {
          getSnapshot: () => {
            const version = ctx.slots.getVersion(TAB_SLOT);
            const revision = ctx.locale.getSnapshot().revision;
            if (version !== tabsVersion || revision !== tabsRevision) {
              tabsVersion = version;
              tabsRevision = revision;
              tabs = ctx.slots
                .entries(TAB_SLOT)
                .map((entry) => ({
                  id: entry.options.id ?? "",
                  order: entry.options.order ?? 0,
                  label: resolveSlotLabel(entry.options.label) ?? "",
                }))
                .sort((left, right) => left.order - right.order);
            }
            return tabs;
          },
          subscribe: (listener: () => void) => {
            const offLedger = ctx.slots.subscribe(TAB_SLOT, listener);
            const offLocale = ctx.locale.subscribe(listener);
            return () => {
              offLedger();
              offLocale();
            };
          },
        },
      },
    });
    ctx.slots.inject("settings.section", () =>
      ctx.slots.register(
        {
          name: "settings.section",
          id: SECTION_OCCUPANT_ID,
          order: SECTION_ORDER,
          label: () => t("nav"),
          locale: LOCALE_KEY,
          inject: sectionInjected,
          children: { [TAB_SLOT]: { kind: "list", scope: "root" } },
        },
        PluginsSettingsSection,
      ),
    );
  }

  /**
   * Cài wiring của row, chặn cài lần hai bằng cờ PHẠM VI MODULE.
   * Nhận: `ctx` — context plugin phía browser.
   * Trả: không.
   */
  function apply(ctx: ClientContext): void {
    if (installed) return;
    try {
      applyInner(ctx);
      installed = true;
    } catch (error) {
      console.error("gbh-client-ui-settings-plugins: apply ném lỗi", error);
      throw error;
    }
  }

  return { apply, inject: ["slots", "locale"] };
}

// id CHÍNH = package của ta (khớp dòng manifest ⇒ HMR tra đúng rev cho dòng này).
// KHÔNG đăng ký id stock: đã đo 0 bundle nào `require("@galaxy-blackhole/gbh-client-ui-settings-plugins")`
// (xem README mục 3) nên alias chỉ tạo thêm rủi ro trùng factory lúc HMR.
loader.load({ id: PACKAGE_NAME, factory: createPlugin });

/** Đánh dấu file này là MODULE (tránh chế độ script toàn cục làm đụng tên với package client khác). */
export {};
