/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mặt plugin nửa browser của row ui-plugin-manager: 8 seam inject + apply port 1:1 vùng index.js của
 *      bundle gốc (dòng 4351-4493) — 2 effect từ điển/controller, effect invalidations, 3 slot
 *      (shell.overlay · main · sidebar.panellist), reflect.provide("pluginNavigation") và theo dõi panelInfo.
 */

import { configLedgerSource, rowConfigKey } from "./config-ledger.ts";
import {
  asksMirror,
  githubRecoveryRegistry,
  isInstallPending,
  offeredRegistries,
  rowKey,
  type InstallState,
  type PluginManagerContext,
} from "./manager-actions.ts";
import { PluginManagerController } from "./manager-store.ts";
import { createNavigationStore, type DefineStore } from "./navigation-store.ts";
import { createPluginManagerPage } from "./page.ts";
import type { PluginManagerPageDeps } from "./page-detail.ts";
import { createPluginsPanelIcon } from "./panel-icon.ts";
import { managementText, noticeText, packageText, registryText, restartText, rowText, type Translate } from "./presentation.ts";
import { createPluginRefreshToast } from "./refresh-toast.ts";
import type { PluginManagerModules } from "./runtime.ts";
import { tabLedgerSource, type ResolveSlotLabel } from "./tab-ledger.ts";
import { EFFECT, NS, PANEL_ID, PANEL_ORDER, PACKAGE_NAME, TOAST_OCCUPANT_ID } from "./ids.ts";
import { en, zh } from "./locales.ts";

/**
 * 8 service mà nửa browser cần, ĐÚNG THỨ TỰ bản gốc (index.js dòng 4357-4366):
 * "slots · locale · remote · remote.pluginManager · remote.pluginInventory · remote.pluginRegistryProbe ·
 * configForms · layout".
 *
 * ⚠️ Đây là seam theo TÊN SERVICE của ctx, KHÁC "dsh.client.inject" trong package.json (4 ID PACKAGE mà
 * tầng nạp chờ trước khi gọi apply). Hai danh sách cùng tồn tại ở bản gốc — đừng gộp.
 */
export const CLIENT_INJECT: string[] = [
  "slots",
  "locale",
  "remote",
  "remote.pluginManager",
  "remote.pluginInventory",
  "remote.pluginRegistryProbe",
  "configForms",
  "layout",
];

/**
 * 9 slot con mà khung "main" của trang Plugins mở ra cho plugin khác — NGUYÊN VĂN "children" của bản gốc
 * (index.js dòng 4423-4460): 4 slot kiểu "list" + 5 slot kiểu "keyed", tất cả "scope: root".
 *
 * ⚠️ Thiếu một khoá ở đây là plugin khác đăng ký vào khoá đó sẽ KHÔNG BAO GIỜ được vẽ (màn Plugins trông
 * "đủ" nhưng tab/cấu hình biến mất) — giữ đúng 9 khoá, đúng thứ tự.
 */
export const PANEL_CHILDREN = {
  "plugins.add.actions": { kind: "list", scope: "root" },
  "plugins.tab": { kind: "list", scope: "root" },
  "plugins.item": { kind: "list", scope: "root" },
  "plugins.bundle.activation": { kind: "keyed", scope: "root" },
  "plugins.bundle.config": { kind: "keyed", scope: "root" },
  "plugins.row.config": { kind: "keyed", scope: "root" },
  "plugins.detail.actions": { kind: "list", scope: "root" },
  "plugins.detail.badge": { kind: "list", scope: "root" },
  "plugins.detail.section": { kind: "list", scope: "root" },
} as const;

/** Nhãn hiệu ứng vòng đời của controller — giữ nguyên chuỗi bản gốc (index.js dòng 4381). */
const EFFECT_CONTROLLER = "ui-plugin-manager: controller";

/** Nhãn hiệu ứng vòng đời của các lần làm mới theo sự kiện Host — nguyên văn bản gốc (dòng 4399). */
const EFFECT_INVALIDATIONS = "ui-plugin-manager: host invalidations";

/** Hàm dọn một lần đăng ký (slot · panelInfo · reflect · effect). */
export type Disposer = () => void;

/** Một mục trong sổ của một slot — phần seam này đọc (đúng ba trường hai sổ cấu hình dùng). */
export interface SlotEntry {
  /** Tuỳ chọn đăng ký của mục. */
  options: {
    /** Id occupant (slot kiểu danh sách/đơn). */
    id?: string;
    /** Khoá của slot kiểu "keyed". */
    key?: string;
    /** Nhãn: chuỗi, hàm, hoặc object đa ngôn ngữ. */
    label?: unknown;
  };
}

/** Tuỳ chọn đăng ký một occupant — chỉ khai các trường ba lần đăng ký của bản gốc dùng. */
export interface SlotRegisterOptions {
  /** Tên slot. */
  name: string;
  /** Id occupant. */
  id?: string;
  /** Khoá (slot kiểu "keyed"). */
  key?: string;
  /** Thứ tự trong slot. */
  order?: number;
  /** Namespace từ điển mà renderer bind cho occupant. */
  locale?: string;
  /** Nhãn của occupant (sidebar gọi mỗi lần vẽ). */
  label?: () => string;
  /** Store mà occupant dùng (khung "main" đọc). */
  store?: unknown;
  /** Dựng mặt nghiệp vụ trao cho occupant. */
  inject?: () => unknown;
  /** Các slot con mà occupant này mở. */
  children?: Record<string, { readonly kind: string; readonly scope: string }>;
}

/**
 * Hàm đăng ký occupant mà "slots.inject" gọi.
 *
 * Bản gốc dùng HÀM GENERATOR cho "main" (mỗi "yield" là một hàm dọn) — giữ nguyên hình dạng đó, nên kiểu
 * này nhận cả hàm thường (trả hàm dọn hoặc không trả gì) lẫn generator.
 */
export type SlotInjection = () => void | Disposer | Generator<void | Disposer, void, unknown>;

/** Nguồn "panelInfo" của bố cục (layout) — chỉ phần trang này đọc. */
export interface PanelInfoSource {
  /**
   * Ảnh chụp thông tin panel.
   * Nhận: không.
   * Trả: activePanelId — panel đang mở (null khi không có panel nào).
   */
  getSnapshot(): { activePanelId: string | null };
  /**
   * Đăng ký nghe thay đổi của panel đang mở.
   * Nhận: listener — hàm nghe.
   * Trả: hàm gỡ.
   */
  subscribe(listener: () => void): Disposer;
}

/**
 * Seam ctx mà nửa browser cần — ĐÚNG các thành viên "apply" của bản gốc dùng, không hơn.
 *
 * Vì sao khai seam thay vì dùng Context của cordis: nửa client chạy trong bundle classic, chỉ có bảng
 * module của trang; seam này là HỢP ĐỒNG giữa wiring (file này) với "manager-store" và "page" — hai cụm
 * kia nhận cùng một hình dạng nên không phải nhập kiểu của nhau.
 *
 * Nền {@link PluginManagerContext}: đúng phần ctx mà PluginManagerController đọc (3 namespace Remote +
 * configForms + get("productAnalytics")) — KHÔNG chép lại kiểu của cụm store, chỉ mượn hợp đồng của nó.
 * Phần thêm bên dưới là những gì riêng "apply" của wiring dùng (vòng đời, từ điển, slot, bố cục, reflect).
 */
export interface PluginManagerClientCtx extends PluginManagerContext {
  /**
   * Đăng ký một hiệu ứng vòng đời.
   * Nhận: callback (trả hàm dọn hoặc không) và nhãn hiệu ứng.
   * Trả: không.
   */
  effect(callback: () => void | Disposer, label: string): void;
  /**
   * Đăng ký nghe một sự kiện của ctx.
   * Nhận: tên sự kiện và hàm nghe.
   * Trả: hàm gỡ.
   */
  on(event: string, listener: () => void): Disposer;
  /** Từ điển của giao diện. */
  locale: {
    /**
     * Đăng ký một namespace từ điển.
     * Nhận: namespace và hai bộ chuỗi zh/en (bản gốc chỉ có hai ngôn ngữ này).
     * Trả: hàm gỡ.
     */
    register(ns: string, dictionaries: { readonly zh: unknown; readonly en: unknown }): Disposer;
    /**
     * Buộc một namespace thành hàm dịch.
     * Nhận: namespace.
     * Trả: hàm t(key) của namespace đó.
     */
    bind(ns: string): (key: string) => string;
    /**
     * Giải một giá trị văn bản đa ngôn ngữ (object {zh, en}) theo ngôn ngữ đang chọn.
     * Nhận: giá trị thô.
     * Trả: chuỗi đã giải.
     */
    resolveText(text: unknown): string;
    /**
     * Ảnh chụp từ điển (hai sổ cái cần "revision" để biết nhãn đã đổi).
     * Nhận: không.
     * Trả: ảnh chụp, chỉ cần revision.
     */
    getSnapshot(): { revision: number };
    /**
     * Đăng ký nghe đổi từ điển (đổi ngôn ngữ).
     * Nhận: listener — hàm nghe.
     * Trả: hàm gỡ.
     */
    subscribe(listener: () => void): Disposer;
  };
  /** Kênh Remote của Host — 3 namespace của controller, cộng phép nghe sự kiện mà wiring cần. */
  remote: PluginManagerContext["remote"] & {
    /**
     * Đăng ký nghe một sự kiện do Host phát.
     * Nhận: tên sự kiện ("plugin-manager/changed" …) và hàm nghe payload.
     * Trả: hàm gỡ.
     */
    $on(event: string, handler: (payload: any) => void): Disposer;
  };
  /** Sổ slot của client. */
  slots: {
    /**
     * Đăng ký một occupant vào slot (chờ slot tồn tại rồi mới gọi).
     * Nhận: tên slot và hàm đăng ký (hàm thường hoặc generator).
     * Trả: không.
     */
    inject(name: string, register: SlotInjection): void;
    /**
     * Đăng ký occupant ngay (đã nằm trong "inject" của slot cha).
     * Nhận: tuỳ chọn đăng ký và component của occupant.
     * Trả: không.
     */
    register(options: SlotRegisterOptions, component: unknown): void;
    /**
     * Số phiên bản đăng ký của một slot — đổi mỗi khi có người đăng ký/gỡ.
     * Nhận: tên slot.
     * Trả: số phiên bản.
     */
    getVersion(name: string): number;
    /**
     * Ảnh chụp các mục của một slot.
     * Nhận: tên slot.
     * Trả: mảng mục đăng ký.
     */
    entries(name: string): SlotEntry[];
    /**
     * Đăng ký nghe thay đổi của một slot.
     * Nhận: tên slot và listener.
     * Trả: hàm gỡ.
     */
    subscribe(name: string, listener: () => void): Disposer;
  };
  /** Bố cục của vỏ ứng dụng. */
  layout: {
    /** Nguồn thông tin panel đang mở. */
    panelInfo: PanelInfoSource;
    /**
     * Chọn panel chính đang mở.
     * Nhận: id panel (null = bỏ chọn).
     * Trả: không.
     */
    selectPanel(panelId: string | null): void;
  };
  /** Kho service chia sẻ giữa các plugin. */
  reflect: {
    /**
     * Phơi một service cho plugin khác đọc.
     * Nhận: tên service và giá trị.
     * Trả: hàm gỡ.
     */
    provide(name: string, value: unknown): Disposer;
  };
}

/** Mặt plugin mà loader nhận từ createPluginManagerClient — "apply" CHƯA có cổng (cổng ở "client.ts"). */
export interface PluginManagerClientModule {
  /** Seam service cần có (8 service, đúng thứ tự bản gốc). */
  inject: string[];
  /**
   * Thân plugin — port 1:1 "apply" của bản gốc.
   * Nhận: ctx — seam context phía browser.
   * Trả: không.
   */
  apply(ctx: PluginManagerClientCtx): void;
}

/**
 * Lấy defineStore của "@galaxy-blackhole/gbh-client-store" từ bảng module.
 * Nhận: modules — bảng module của loader.
 * Trả: hàm defineStore.
 * @throws khi bảng module thiếu defineStore — lỗi cấu hình, phải lộ ra chứ không im lặng.
 */
function resolveDefineStore(modules: PluginManagerModules): DefineStore {
  const defineStore = (modules.store as { defineStore?: unknown }).defineStore;
  if (typeof defineStore !== "function") {
    throw new Error(PACKAGE_NAME + ': bang module thieu "@galaxy-blackhole/gbh-client-store".defineStore');
  }
  return defineStore as DefineStore;
}

/**
 * Các hàm nhãn mà vùng trang dùng nhưng thuộc cụm file khác — bơm vào "page" theo đúng hợp đồng
 * {@link PluginManagerPageDeps} của "page-detail.ts".
 *
 * Bản gốc gọi thẳng hàm module-scope (presentation · config-ledger · manager-store); bản ta truyền qua
 * tham số để "page" không import tĩnh ba cụm kia. KHÔNG chép lại một hàm nào ở đây — chỉ chuyển tiếp.
 * Nhận: không.
 * Trả: bộ 12 hàm nhãn/tiện ích cho vùng trang.
 */
function pageDeps(): PluginManagerPageDeps {
  return {
    // 4 hàm nhãn của presentation: "page" khai PageTranslate chỉ nhận params chuỗi, còn Translate của
    // presentation nhận cả số ⇒ hẹp hơn ở đúng ranh giới này. Runtime an toàn: 4 hàm đó chỉ truyền chuỗi
    // (đã đọc presentation.ts — mọi params đều là string).
    registryText: (registry, t, resolved) => registryText(registry, t as unknown as Translate, resolved),
    managementText: (error, t) => managementText(error, t as unknown as Translate),
    packageText,
    rowText,
    restartText: (key, reason, t) => restartText(key, reason, t as unknown as Translate),
    noticeText: (notice, t) => noticeText(notice, t as unknown as Translate),
    rowConfigKey,
    rowKey,
    isInstallPending,
    // 2 hàm của manager-actions nhận InstallState ĐẦY ĐỦ, còn "page" truyền InstallStateView (thiếu
    // subject.status). Runtime an toàn: cả hai chỉ đọc confirmed · phase · failure · subject.host ·
    // registries · registry — đều có trong View (đã đọc manager-actions.ts).
    githubRecoveryRegistry: (install) => githubRecoveryRegistry(install as unknown as InstallState),
    asksMirror: (install) => asksMirror(install as unknown as InstallState),
    offeredRegistries,
  };
}


/**
 * Dựng mặt plugin nửa browser: 8 seam "inject" + "apply" port 1:1 "index.js" của bundle gốc.
 *
 * Trình tự giữ NGUYÊN như bản gốc (dòng 4372-4483): từ điển → controller + hiệu ứng dọn → hiệu ứng
 * invalidations → hai sổ cái → controller.inject → 3 lần slots.inject (toast · trang + panelInfo +
 * pluginNavigation · mục sidebar). Đổi thứ tự là đổi thời điểm "face" ra đời so với lần vẽ đầu.
 *
 * Nhận: modules — bảng module do loader cấp; resolveSlotLabel — hàm chuẩn hoá nhãn của ui-slots (hai sổ
 * cái cần để giải nhãn tab/mục; bản gốc lấy trực tiếp từ bảng module của nó).
 * Trả: { inject, apply } — đúng hình dạng module nửa browser của bản gốc.
 */
export function createPluginManagerClient(modules: PluginManagerModules, resolveSlotLabel: ResolveSlotLabel): PluginManagerClientModule {
  /** Trang Plugins (component) — cụm "page" dựng từ cùng bảng module + bộ hàm nhãn của các cụm khác. */
  const PluginManagerPage = createPluginManagerPage(modules, pageDeps());
  /** Toast lỗi làm mới, sống ở "shell.overlay" nên hiện được cả khi đã rời bảng Plugins. */
  const PluginRefreshToast = createPluginRefreshToast(modules);
  /** Icon mục "Plugins" ở sidebar. */
  const PluginsPanelIcon = createPluginsPanelIcon(modules);

  return {
    inject: CLIENT_INJECT,
    /**
     * Thân plugin: đăng ký từ điển, controller, invalidations, 3 slot và service pluginNavigation.
     * Nhận: ctx — seam context phía browser.
     * Trả: không.
     */
    apply(ctx: PluginManagerClientCtx): void {
      // (1) Từ điển của màn Plugins — effect đầu tiên, y bản gốc (dòng 4373-4376).
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), EFFECT.dictionaries);

      // (2) Hàm dịch của namespace, dùng cho nhãn mục sidebar.
      const t = ctx.locale.bind(NS);

      // (3) Controller + hiệu ứng dọn — bản gốc tạo controller TRƯỚC face, dọn khi plugin unload.
      // "modules" là dị biệt có chủ đích: bản gốc lấy createSnapshotStore ở phạm vi module; bản ta truyền
      // bảng module vào (thiếu thì controller tự rơi về sổ trong bộ nhớ + một cảnh báo, KHÔNG ném).
      const controller = new PluginManagerController(ctx, modules);
      ctx.effect(
        () => () => {
          controller.dispose();
        },
        EFFECT_CONTROLLER,
      );

      // (4) Invalidations của Host: đổi plugin · log cài · tiến độ cài · kết nối lại đều làm mới (dòng 4382-4399).
      ctx.effect(() => {
        /** Làm mới danh sách khi controller đã có dữ liệu (status "idle" = chưa nạp lần nào). */
        const refresh = (): void => {
          if (controller.getSnapshot().status !== "idle") controller.load();
        };
        const disposers = [
          ctx.remote.$on("plugin-manager/changed", refresh),
          ctx.remote.$on("plugin-manager/install-log", (chunk) => {
            controller.appendLog(chunk);
          }),
          ctx.remote.$on("plugin-manager/install-state", (progress) => {
            controller.installProgress(progress);
          }),
          ctx.on("connection/reset", refresh),
        ];
        return () => {
          for (const dispose of disposers) dispose();
        };
      }, EFFECT_INVALIDATIONS);

      // (5) Hai sổ cái mà trang bind. Bản gốc: configLedgerSource(ctx) / tabLedgerSource(ctx); bản ta nhận
      //     seam + hàm giải nhãn qua tham số (hai file sổ cái không import tĩnh bảng module của trang).
      //     Dùng bản port 1:1 ở "config-ledger.ts" (có subscribe — trang phải phản ứng theo version của slot).
      //
      //     ⚠️ LỆCH HỢP ĐỒNG ĐANG CHỜ CỤM STORE CHỐT: "manager-store.ts" import kiểu ConfigLedger từ
      //     "./slot-contract.ts" (bản cũ, KHÔNG có subscribe) trong khi nguồn 1:1 ở "./config-ledger.ts";
      //     hai kiểu chỉ khác readonly/mutable — CÙNG một giá trị ở runtime. Ép kiểu đúng MỘT chỗ tại ranh
      //     giới này để không phải sửa file của cụm khác; khi cụm store đổi import sang "./config-ledger.ts"
      //     thì phép ép này thành no-op (giữ nguyên, không sai).
      const configLedger = configLedgerSource(ctx, resolveSlotLabel) as Parameters<PluginManagerController["inject"]>[0];
      const face = controller.inject(configLedger, tabLedgerSource(ctx, resolveSlotLabel), (text: unknown) => ctx.locale.resolveText(text));

      // (6) Toast làm mới ở shell.overlay — đăng ký TRƯỚC trang để lỗi làm mới vẫn hiện khi trang chưa mở.
      //     Tên slot ghi bằng CHUỖI (không dùng hằng của ids.ts): "check:rows" quét VĂN BẢN src để đối chiếu
      //     danh sách slot với bản gốc, hằng số sẽ làm cổng báo "thieu dang ky slot".
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          {
            name: "shell.overlay",
            id: TOAST_OCCUPANT_ID,
            locale: NS,
            inject: () => ({
              hooks: { pluginManager: face.hooks.pluginManager },
              dismissNotice: face.dismissNotice,
              // 19/10/2026 (Lead chốt): KHÔNG thêm prop so với bản gốc — A chỉ inject {hooks, dismissNotice}.
              // Toast đọc noticeText trực tiếp ở phạm vi module (xem refresh-toast.ts).
            }),
          },
          PluginRefreshToast,
        ),
      );

      // (7) Khung "main": trang Plugins + 9 slot con + đặt lại màn khi rời panel + phơi pluginNavigation.
      //     Bản gốc dùng HÀM GENERATOR: mỗi "yield" là một hàm dọn, gom cả ba thứ vào một vòng đời.
      ctx.slots.inject("main", function* () {
        const handle = createNavigationStore(resolveDefineStore(modules));
        const instance = handle.create();
        // "create" bị ghi đè để MỌI lần trang xin store đều nhận ĐÚNG một instance (bản gốc làm vậy).
        const store = { ...handle, create: () => instance };
        yield ctx.slots.register(
          {
            name: "main",
            key: PANEL_ID,
            locale: NS,
            store,
            inject: () => face,
            children: PANEL_CHILDREN,
          },
          PluginManagerPage,
        );
        // Rời panel Plugins (sang panel khác) ⇒ quay về danh sách; giữ nguyên màn khi panel còn mở.
        yield ctx.layout.panelInfo.subscribe(() => {
          if (ctx.layout.panelInfo.getSnapshot().activePanelId !== PANEL_ID) instance.actions.setView({ kind: "list" });
        });
        const disposeNavigation = ctx.reflect.provide("pluginNavigation", {
          /**
           * Mở chi tiết một bundle mà KHÔNG đổi Session đang xem.
           * Nhận: packageName — tên gói npm của bundle.
           * Trả: không.
           */
          openBundle: (packageName: string): void => {
            ctx.layout.selectPanel(PANEL_ID);
            instance.actions.setTab("installed");
            instance.actions.setView({ kind: "package", name: packageName });
          },
        });
        yield () => {
          disposeNavigation();
        };
      });

      // (8) Mục "Plugins" ở sidebar — id "plugins", order 0, nhãn t("panel") (dòng 4477-4483).
      ctx.slots.inject("sidebar.panellist", () =>
        ctx.slots.register(
          {
            name: "sidebar.panellist",
            id: PANEL_ID,
            order: PANEL_ORDER,
            label: () => t("panel"),
            locale: NS,
          },
          PluginsPanelIcon,
        ),
      );
    },
  };
}