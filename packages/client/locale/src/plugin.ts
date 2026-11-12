/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Nua browser cua row locale: phoi dich vu \`locale\` + tu dien nen + dong Language trong Settings
 */

// 10/11/2026 (Lead): từ điển VI của namespace "conversation" nay lấy từ file SINH
//   locales-vi-conversation.ts (tools/locale/gen-vi.ts + gbh-locale-vi-manual.json) thay cho khối thêm tay
//   trong locales-vi.ts — nhờ đó khoá "hero.headline" nằm ĐÚNG namespace và hiện được ở màn hình chào.
import { parseLocaleBootstrap, type LocaleBridge } from "./bootstrap.ts";
import { COMMON_NS, FALLBACK_LOCALE, LOCALE_SETTINGS_NAMESPACE, PACKAGE_NAME, SETTINGS_NS } from "./ids.ts";
import { STYLES, STYLE_TAG_SUFFIX } from "./styles.ts";
import { en as commonEn, zh as commonZh } from "./locales-common.ts";
import { en as settingsEn, zh as settingsZh } from "./locales-settings.ts";
import {
  createLanguageRow,
  createLanguageRowStore,
  type ClientStoreModule,
  type JsxRuntime,
  type LanguageRowRuntime,
  type PrimitivesModule,
  type ReactHooks,
} from "./language-row.ts";
import { LocaleRuntime, syncDocumentLanguage, type LocaleContext, type LocaleHostScope, type Translator } from "./locale-runtime.ts";
import { viConversation } from "./locales-vi-conversation.ts";
import {
  viAgentTeam,
  viCommon,
  viCordis,
  viModel,
  viQuestion,
  viSessionDelete,
  viSettingsAccount,
  viSessionLogDownload,
  viSettings,
  viShortcuts,
  viSlashMenu,
  viVoiceInput,
} from "./locales-vi.ts";
import { viChat, viJob, viPermissionAccess } from "./locales-vi-stock.ts";

/**
 * Các namespace CỦA GÓI GỐC DSH mà ta chưa viết lại, kèm bảng tiếng Việt đăng ký tập trung.
 *
 * Chỉ chứa namespace mà bản gốc đăng ký `{ zh, en }` (không có vi) và UI của nó đang hiện trên app:
 * ui-theme (Appearance · Font size), ui-shortcuts (Keyboard shortcuts), model, slash.menu, cordis,
 * question, agent-team, voice-input, session-log-download. Mọi namespace do gói CỦA TA sở hữu KHÔNG
 * nằm ở đây (gói đó tự đăng ký vi) — trùng sẽ làm `register` ném lỗi.
 */
const STOCK_DICTIONARIES: readonly (readonly [string, Readonly<Record<string, string>>])[] = [
  // ["settings.theme", ...] ĐÃ CHUYỂN QUYỀN SỞ HỮU (phase 2, 18/10/2026): gói ui-theme tự đăng ký { zh, en, vi }.
  ["shortcuts", viShortcuts],
  ["model", viModel],
  ["slash.menu", viSlashMenu],
  ["cordis", viCordis],
  ["question", viQuestion],
  ["agent-team", viAgentTeam],
  ["voice-input", viVoiceInput],
  ["session-log-download", viSessionLogDownload],
  // 08/11/2026 (dev-5, Lead duyệt hướng B cho i18n): row ui-conversation là DE-BUNDLE nên KHÔNG được sửa
  //   artefact (cổng parity so với bundle stock ở tests/client/ui-conversation.test.ts). Hai chuỗi
  //   "Send behavior while busy" + mô tả trong Cài đặt → Chung nằm trong artefact đó dưới dạng en ⇒ đăng ký
  //   vi từ NGUỒN LÚC CHẠY như đã làm cho "chat"/"job"/"settings.sessionLog" (07/11/2026). An toàn vì artefact
  //   của "conversation" chỉ đăng ký zh+en, không có vi (register sẽ ném nếu trùng vi).
  // 10/11/2026 (Lead): từ điển nay SINH TỰ ĐỘNG (locales-vi-conversation.ts, 385 khoá) từ
  //   gbh-locale-vi-manual.json["conversation"] ⇒ "hero.headline" có mặt trong namespace ĐÚNG. Bản thêm tay
  //   trước đó nằm ở namespace "common" nên KHÔNG BAO GIỜ hiện: `translate` tra namespace của lời gọi
  //   TRƯỚC (chuỗi vi→en của "conversation"), mà từ điển en của artefact đã có "hero.headline":
  //   "Into the Unknown" ⇒ lookup dừng ở en, không rơi tiếp xuống "common".
  ["conversation", viConversation],
  // 24/10/2026 — ADR 0016: menu "Xoá phiên" của row ui-session-delete.
  ["session-delete", viSessionDelete],
  // 26/10/2026 — menu tài khoản: nút "More" và các nhãn menu.
  ["settings.account", viSettingsAccount],
  // 07/11/2026 — "DỊCH TẤT CẢ" đợt 2 (đo bằng tools/dev/dom-text.ts trên app thật, xem
  // docs/GBH-P4-RA-CHUOI-ANH.md): bốn namespace mà UI vẫn hiện tiếng Anh.
  //   · chat — hàng cài đặt "Work details"/"When to Collapse Work Details" + nhãn tiến trình
  //     "Completed in …" của mỗi lượt (ui-chat CHỈ đăng ký zh+en, lib/client.js:13132);
  //   · job — hàng đợi tác vụ nền (ui-jobs đăng ký zh+en, lib/client.js:630);
  //   · settings.sessionLog — mục "Nhật ký phiên" trong Cài đặt (đăng ký en+zh, lib/client.js:150);
  //   · permission.access — nhãn chế độ quyền ngay cạnh ô nhập (PERMISSION_ACCESS_NS, chỉ zh+en).
  // KHÔNG thêm "trajectory" hay "schedule.catalog"/"schedule.manager": hai gói đó ĐÃ tự đăng ký vi
  //   trong artefact, đăng ký thêm sẽ ném "already has locale vi" (bài học workspace 24/10/2026).
  ["chat", viChat],
  ["job", viJob],
  // 08/11/2026 — BỎ "settings.sessionLog": gói ui-settings-session-log TỰ đăng ký vi, và `register` NÉM khi
  //   namespace đã có locale "vi" ⇒ apply của GÓI chết ("Failed to load plugins"). Đây là ca thứ hai của cùng
  //   lớp lỗi (bọc try/catch ở vòng lặp dưới chỉ cứu phía ta, không cứu phía gói).
  ["permission.access", viPermissionAccess],
];

/** `require` do bảng module cấp cho factory (lazy-CJS, hợp đồng C2). */
export type RequireFn = (specifier: string) => unknown;

/** Service phía browser mà nửa client cần — giữ ĐÚNG 3 tên của bản gốc. */
export const inject: string[] = ["slots", "remote", "configForms"];

/**
 * Bề mặt plugin mà Loader cần ở mỗi entry — kèm ĐÚNG những export mà nửa client của bản gốc có, để
 * module của ta là hàng thay thế được (row nào sau này `require` id này vẫn nhận đủ).
 */
export interface PluginFace {
  /** Điểm vào phía browser (bất đồng bộ: chờ khởi tạo native rồi mới đăng ký). */
  apply(ctx: ClientContext): Promise<void>;
  /** Seam service mà plugin cần. */
  inject: string[];
  /** Namespace dùng chung cho chữ ở tầng vỏ. */
  COMMON_NS: string;
  /** Ngôn ngữ dự phòng cuối cùng. */
  FALLBACK_LOCALE: string;
  /** Lớp dịch vụ (bản gốc phơi nó ra ngoài module). */
  LocaleRuntime: typeof LocaleRuntime;
  /** Namespace của mục cài đặt này. */
  SETTINGS_NS: string;
}

/** Phần `slots` mà row này dùng. */
export interface SlotsSeam {
  /** Gắn dịch vụ từ điển vào seam slot để mọi slot có `t`. */
  installLocale(locale: LocaleRuntime): void;
  /** Đăng ký vào một slot ngay khi slot đó sống. */
  inject(slot: string, register: () => unknown): void;
  /** Chiếm một chỗ trong slot; trả hàm gỡ. */
  register(definition: Record<string, unknown>, component: unknown): unknown;
}

/** Context phía browser (chỉ seam mà row này dùng). */
export interface ClientContext extends LocaleContext {
  /** Sợi plugin (dùng để biết plugin còn sống sau `await`). */
  fiber: { uid: string | null };
  /** Theo dõi một sự kiện của context. */
  on(event: string, listener: (payload: { active: string }) => void): void;
  /** Phạm vi mục cài đặt của host. */
  configForms: { get(namespace: string): LocaleHostScope | undefined };
  /** Seam slot. */
  slots: SlotsSeam;
}

/**
 * Chèn stylesheet của dòng Language vào `<head>` đúng một lần (idempotent theo `data-plugin-css`).
 * Nhận: không.
 * Trả: không.
 */
function injectStyles(): void {
  if (typeof document === "undefined") return;
  const tagId = PACKAGE_NAME + STYLE_TAG_SUFFIX;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/**
 * Cờ CHỐNG CÀI HAI LẦN — phải ở phạm vi MODULE (không phải trong `apply`, cũng không phải trong closure
 * của factory): khi row khai hai id module, loader gọi factory hai lần ⇒ hai plugin instance ⇒ `apply`
 * chạy lần thứ hai ⇒ đăng ký lại service `locale` ⇒ cordis ném lỗi ⇒ row kẹt `loading`.
 * Đo được 17/10/2026: row hai-id kẹt `loading` tương quan 100%.
 */
/* Cờ PHẠM VI MODULE (luật nhóm 18/10/2026): hai entry ⇒ hai ctx ⇒ cổng theo ctx không bao giờ kích. */
let bundleInstalled = false;

/**
 * Tạo plugin phía browser của row `locale`.
 * Nhận: `requireFn` — hàm require do bảng module cấp.
 * Trả: bề mặt plugin `{ apply, inject }`.
 */
export function createPlugin(requireFn: RequireFn): PluginFace {
  const runtime: LanguageRowRuntime = {
    hooks: requireFn("react") as ReactHooks,
    jsx: requireFn("react/jsx-runtime") as JsxRuntime,
    primitives: requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule,
    store: requireFn("@galaxy-blackhole/gbh-client-store") as ClientStoreModule,
  };
  injectStyles();
  const LanguageRow = createLanguageRow(runtime);
  const store = createLanguageRowStore(runtime);

  /**
   * Phơi dịch vụ `locale` với từ điển nền, và đăng ký dòng Language vào mục General của Settings.
   * Nhận: `ctx` — context plugin phía browser.
   * Trả: xong sau khi khởi tạo native và đăng ký xong.
   */
  async function apply(ctx: ClientContext): Promise<void> {
    // (1) chan lan cai thu hai (id thu hai chi la mot KHOA khac cua cung bundle);
    // (2) neu service da co (bundle bi thuc thi lai) thi cung khong cai lai.
    // `ctx.get` là API cordis thật nhưng không nằm trong seam tối thiểu của gói này — thu hẹp tường minh.
    const existing = (ctx as unknown as { get(name: string): unknown }).get("locale");
    /* `existing !== undefined` là điều kiện RIÊNG của gói này (service đã có) — giữ nguyên, chỉ thay cổng theo ctx. */
    if (bundleInstalled || existing !== undefined) {
      console.warn("gbh-client-locale: bundle da duoc cai, bo qua lan thu hai");
      return;
    }
    try {
      await applyInner(ctx);
      /* CHỈ bật sau khi đăng ký XONG (nếu applyInner ném giữa đường thì cờ KHÔNG được khoá). */
      bundleInstalled = true;
    } catch (error) {
      console.error("gbh-client-locale: apply nem loi", error);
      throw error;
    }
  }

  async function applyInner(ctx: ClientContext): Promise<void> {
    const bridge = (globalThis as unknown as { __GBH_LOCALE__?: LocaleBridge }).__GBH_LOCALE__;
    let bootstrap;
    if (bridge !== undefined) {
      let value: unknown;
      try {
        value = await bridge.read();
      } catch (error) {
        if (ctx.fiber.uid === null) return;
        throw error;
      }
      if (ctx.fiber.uid === null) return;
      bootstrap = parseLocaleBootstrap(value);
    }
    const locale = new LocaleRuntime(ctx, ctx.configForms.get(LOCALE_SETTINGS_NAMESPACE), bootstrap);
    locale.register(COMMON_NS, { vi: viCommon, zh: commonZh, en: commonEn });
    locale.register(SETTINGS_NS, { vi: viSettings, zh: settingsZh, en: settingsEn });
    // ⚠️ 18/10/2026 — "DỊCH TẤT CẢ" phải gồm cả các gói CÒN LÀ BẢN GỐC DSH (chưa viết lại): bản gốc chỉ
    //   đăng ký zh+en nên UI của chúng vẫn hiện tiếng Anh (đo được trên DOM thật: Appearance · Light ·
    //   Font size của ui-theme, Keyboard shortcuts · Edit shortcuts của ui-shortcuts). Gói locale là nơi
    //   DUY NHẤT biết mọi namespace, nên đăng ký tập trung bảng vi cho các namespace đó — mỗi namespace
    //   chỉ MỘT lần, và danh sách này KHÔNG giao với namespace do các gói của ta tự đăng ký (register
    //   ném lỗi nếu trùng locale trong cùng namespace).
    for (const [namespace, dictionary] of STOCK_DICTIONARIES) {
      // 07/11/2026 — BỌC try/catch: `register` NÉM khi namespace đã có locale "vi". Trước đây một ca
      //   trùng làm cả plugin locale chết ⇒ 48 row mất chuỗi. Nay trùng chỉ là cảnh báo: gói sở hữu
      //   namespace đó đã tự phục vụ bản dịch của nó, UI KHÔNG hỏng.
      ctx.effect(() => {
        try {
          return locale.register(namespace, { vi: dictionary });
        } catch (error) {
          console.warn("gbh-client-locale: khong dang ky duoc vi cho namespace " + namespace, error);
          return () => undefined;
        }
      }, "locale: vi dictionary " + namespace);
    }
    // 24/10/2026 — KHÔNG bù tiếng Việt cho namespace "workspace" ở đây: `ui-workspace` tự đăng ký
    // {vi, zh, en} (đo thật: nó ném "locale namespace workspace already has locale vi" nếu ta đăng ký
    // trước ⇒ sập cả UI). Bản mount cũ chỉ có zh+en vì artefact lúc đó cũ; sau khi mount lại bản mới,
    // menu phiên đã có tiếng Việt từ chính gói đó.
    ctx.provide("locale", locale);
    if (bridge !== undefined) {
      ctx.on("locale/change", (snapshot) => {
        bridge.onChange(snapshot.active);
      });
      bridge.onChange(locale.getSnapshot().active);
    }
    ctx.slots.installLocale(locale);
    let bound: { sync(active: string, options: { id: string; label: string }[], revision: number): void } | undefined;
    const sync = (): void => {
      const snapshot = locale.getSnapshot();
      syncDocumentLanguage(snapshot);
      bound?.sync(
        snapshot.active,
        snapshot.locales.map((language) => ({ id: language.id, label: language.label })),
        snapshot.revision,
      );
    };
    ctx.effect(() => locale.subscribe(sync), "locale: language row and document synchronization");
    sync();
    const injected = (actions: { sync(active: string, options: { id: string; label: string }[], revision: number): void }) => {
      bound = actions;
      sync();
      return {
        setLocale: (id: string): void => {
          locale.setLocale(id);
        },
      };
    };
    ctx.slots.inject("settings.general.item", () =>
      ctx.slots.register(
        {
          name: "settings.general.item",
          id: "language",
          order: 0,
          store,
          locale: SETTINGS_NS,
          inject: injected,
        },
        LanguageRow,
      ),
    );
  }

  return { apply, inject, COMMON_NS, FALLBACK_LOCALE, LocaleRuntime, SETTINGS_NS };
}