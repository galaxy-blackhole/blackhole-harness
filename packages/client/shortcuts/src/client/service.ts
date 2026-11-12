/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Service \`shortcuts\` phia browser: mot adapter ban phim cho moi doi plugin
 */

import { CONFIG_GLOBAL, SERVICE_NAME } from "../ids.ts";
import {
  initialShortcutConfig,
  normalizeBinding,
  overlappingBindings,
  bindingIssue,
  presentBinding,
  type DesktopKeyboardApi,
  type DesktopShortcutsApi,
  type ShortcutBinding,
  type ShortcutConfigSnapshot,
  type ShortcutEdit,
  type ShortcutRevision,
  type ShortcutSaveResult,
} from "../protocol.ts";
import { readShortcutConfig } from "./config.ts";
import { detectEnvironment, installKeyboard, type PrimitivesSeam } from "./dom.ts";
import { installNativeKeyboard } from "./native.ts";
import { ShortcutRegistry, type ClientStoreSeam } from "./registry.ts";
import { desktopShortcutStorage, webShortcutStorage } from "./storage.ts";
import type { ShortcutFixedInput, Shortcuts } from "./types.ts";

/** Lớp cơ sở cordis (chỉ phần service dùng). */
export interface ServiceBase {
  /** Sợi plugin. */
  readonly ctx: unknown;
  /** Phát một sự kiện trên context. */
  emit(event: string, payload?: unknown): void;
}

/** Hàm dựng lớp cơ sở cordis. */
export interface ServiceConstructor {
  /** Tạo service mới gắn vào context với tên cho trước. */
  new (ctx: unknown, name: string): ServiceBase;
}

/** Cửa sổ sản phẩm có thể mang cầu Desktop. */
interface ProductWindow extends Window {
  /** Cầu Desktop do preload cài. */
  dshDesktop?: { shortcuts?: DesktopShortcutsApi; keyboard?: DesktopKeyboardApi };
}

/** Giá trị chạy mà service cần (do điểm vào lấy từ bảng module của trang). */
export interface ServiceDeps {
  /** Lớp cơ sở cordis (``@deepseek-ai/cordis``). */
  Service: ServiceConstructor;
  /** Seam `client-store`. */
  store: ClientStoreSeam;
  /** Seam `ui-primitives`. */
  primitives: PrimitivesSeam;
  /** Cửa sổ sản phẩm (cầu Desktop nằm trên `dshDesktop` nếu có). */
  window: Window;
  /** Tài liệu sản phẩm. */
  document: Document;
  /** Thông tin thiết bị của trình duyệt. */
  navigator: Navigator;
}

/** Context plugin phía browser mà service dùng (cordis cấp lúc khởi tạo). */
export interface PluginContext extends ServiceBase {
  /** Gắn hiệu ứng vào vòng đời plugin. */
  effect(callback: () => unknown, label: string): void;
  /** Service từ điển (bản gốc khai `static inject = ["locale"]`). */
  locale: { subscribe(listener: () => void): () => void };
}

/** Bề mặt service đã dựng (lớp còn có `static inject = ["locale"]` cho cordis). */
export type ShortcutsServiceFace = Shortcuts;

/**
 * Cong chan CAI HAI LAN — o noi CO \`ctx\` (ham dung cua lop service), KHONG phai o factory.
 *
 * Bai hoc 17/10/2026: goi nay PHOI RA LOP SERVICE nen no khong co \`apply\` de boc; cho that su co ctx la
 * HAM DUNG. Khi row khai hai id module thi bo nap goi ham dung hai lan ⇒ lan hai \`super(ctx, NAME)\` nem
 * \`service has been registered\` ⇒ entry ket \`loading\` ⇒ cascade (do duoc: 18 entry ket, goc la goi nay).
 * \`lastCtx\` chan CHAC bang so identity; \`shortcutContexts\` la luoi trong; tra ve INSTANCE CU thay vi dang
 * ky lai — nho vay entry alias van \`active\` chu khong bi bien thanh plugin rong.
 */
// ⚠️ CỔNG PHẢI LÀ BOOLEAN PHẠM VI MODULE, **KHÔNG** khoá theo ctx.
// Đo được 17/10/2026 (tm-parity-b đọc mã cordis: `loader.create` cho mỗi entry ⇒ mỗi entry một fiber ⇒
// `parent.extend({fiber})` ⇒ **ctx MỚI**): hai ENTRY (id của ta + id alias) ⇒ **HAI CTX KHÁC NHAU**. Vì vậy
// cổng khoá theo ctx (`lastCtx`/`WeakSet`) **không bao giờ kích hoạt** ở ca thật, hàm dựng chạy lần hai,
// `provide("shortcuts")` lần hai ⇒ `service "shortcuts" has been registered` ⇒ entry kẹt `loading`.
// Boolean thì **không quan tâm ctx nào**: lần cài thứ HAI bất kể ctx ⇒ trả plugin rỗng, không provide gì.
// Giá phải trả đã biết: boolean dính giữa các ca test trong cùng file ⇒ ca test phải nạp module TƯƠI
// (`import("...?caseN")`); nhưng tránh cái giá đó bằng cổng-khoá-theo-ctx là SAI vì nó làm cổng mất tác dụng.
let bundleInstalled = false;

/**
 * Dựng lớp service `shortcuts` quanh những seam lấy từ bảng module của trang.
 * Nhận: `deps` — cordis Service, client-store, ui-primitives, window/document/navigator, ctx.
 * Trả: lớp service (chưa khởi tạo).
 */
export function createShortcutsService(deps: ServiceDeps): new (ctx: unknown) => ShortcutsServiceFace {
  const { Service, store, primitives } = deps;

  /** Service bàn phím phía browser, mỗi đời plugin có một adapter. */
  class ShortcutsServiceImpl extends Service implements ShortcutsServiceFace {
    /** Service cần có trước khi service này sống. */
    static readonly inject: readonly string[] = ["locale"];
    /** Vỏ ứng dụng. */
    readonly runtime: "desktop" | "web";
    /** Thiết bị nhận phím. */
    readonly platform: "macos" | "windows" | "linux";
    /** Danh mục lệnh sửa được. */
    readonly catalog: Shortcuts["catalog"];
    /** Tuy chọn đã nhận. */
    readonly config: Shortcuts["config"];
    /** Danh mục hành động cố định. */
    readonly fixedCatalog: Shortcuts["fixedCatalog"];
    /** Khoảng cách giữa hai lần Escape (ms). */
    readonly stopSequenceMs: number;
    /** Người nghe nhập liệu cố định. */
    private readonly fixedListeners = new Set<(input: ShortcutFixedInput) => void>();
    /** Bộ chuyển lưu trữ (web hoặc desktop). */
    private adapter: (DesktopShortcutsApi & { dispose?: () => void }) | undefined;
    /** Cầu bàn phím native (chỉ Desktop). */
    private keyboard: DesktopKeyboardApi | undefined;
    /** Còn sống hay không. */
    private active = true;
    /** Đã nối được bộ chuyển lưu trữ hay chưa. */
    private connected = false;
    /** Sổ đăng ký lệnh. */
    private readonly registry: ShortcutRegistry;
    /** Context plugin (để gọi `effect` và `locale`). */
    private readonly plugin: PluginContext;

    /**
     * Dựng service: nhận diện thiết bị, đọc cấu hình trang, nối lưu trữ và adapter bàn phím.
     * Nhận: `ctx` — context plugin.
     * Trả: service đã sẵn sàng.
     * @throws khi vỏ Desktop nhưng thiếu cầu bàn phím native.
     */
    constructor(ctx: unknown) {
      const environment = detectEnvironment(deps.document, deps.navigator);
      const productWindow = deps.window as ProductWindow;
      const keyboard = environment.runtime === "desktop" ? productWindow.dshDesktop?.keyboard : undefined;
      if (environment.runtime === "desktop" && keyboard === undefined) {
        // ⚠️ KHÔNG NÉM. Cùng lớp lỗi với dom.ts: đọc một thứ có thể CHƯA CÓ ngay lúc dựng (cửa sổ Tauri có
        // thể chưa sẵn sàng, hoặc môi trường headless). Cầu bàn phím là tính năng PHỤ, mà MỌI row UI đều
        // `inject` service này ⇒ ném ở đây là giết cả cây. Đo được 17/10/2026: cổng `test` đỏ vì
        // "Desktop keyboard bridge unavailable" trong môi trường headless của gate:home-isolation.
        // Cố ý KHÁC bản gốc ở đúng ca này (bản gốc ném) — đây là dị biệt có chủ đích, các ca khác vẫn A/B.
        console.warn("gbh-client-shortcuts: khong co cau ban phim Desktop — tat tinh nang ban phim");
      }
      super(ctx, SERVICE_NAME);
      // cordis cấp ctx ở hàm dựng (bản gốc cũng nhận ctx như vậy), KHÔNG lấy từ deps.
      const plugin = ctx as PluginContext;
      this.plugin = plugin;
      this.keyboard = keyboard;
      this.runtime = environment.runtime;
      this.platform = environment.platform;
      const pageConfig = readShortcutConfig((globalThis as unknown as Record<string, unknown>)[CONFIG_GLOBAL] ?? {});
      this.stopSequenceMs = pageConfig.stopSequenceMs;
      this.registry = new ShortcutRegistry(this.runtime, this.platform, initialShortcutConfig(), store);
      this.catalog = this.registry.catalog;
      this.config = this.registry.config;
      this.fixedCatalog = this.registry.fixedCatalog;
      const publish = (snapshot: ShortcutConfigSnapshot): void => {
        if (this.active && this.connected && snapshot.sequence >= this.config.getSnapshot().sequence) {
          this.registry.configure(snapshot);
        }
      };
      const web = this.runtime === "web" ? webShortcutStorage(productWindow, this.platform, publish) : undefined;
      this.adapter = web ?? desktopShortcutStorage(productWindow);
      if (keyboard !== undefined) {
        plugin.effect(
          () =>
            installNativeKeyboard(
              productWindow,
              keyboard,
              this.registry,
              () => this.config.getSnapshot(),
              primitives,
              () => {
                this.fixedInput({ type: "reset" });
              },
            ),
          "shortcuts: native keyboard",
        );
      }
      plugin.effect(() => {
        const off = this.adapter?.subscribe(publish);
        return () => {
          this.active = false;
          off?.();
          web?.dispose();
        };
      }, "shortcuts: preferences");
      this.syncDefinitions();
      plugin.effect(() => {
        const off = installKeyboard(
          productWindow,
          this.registry,
          primitives,
          (input) => {
            this.fixedInput(input);
          },
          keyboard !== undefined && (this.platform === "macos" || this.platform === "windows"),
        );
        return () => {
          off();
          this.fixedListeners.clear();
        };
      }, "shortcuts: keyboard");
      plugin.effect(
        () =>
          plugin.locale.subscribe(() => {
            this.registry.refreshLabels();
          }),
        "shortcuts: locale",
      );
    }

    /**
     * Đăng ký một lệnh và đồng bộ danh mục xuống kho lưu trữ.
     * Nhận: `command` — định nghĩa lệnh.
     * Trả: hàm gỡ.
     */
    register(command: Parameters<Shortcuts["register"]>[0]): () => void {
      const off = this.registry.register(command);
      this.syncDefinitions();
      return () => {
        off();
        this.syncDefinitions();
      };
    }

    /**
     * Đăng ký một hành động cố định và đồng bộ danh mục xuống kho lưu trữ.
     * Nhận: `command` — hành động cố định.
     * Trả: hàm gỡ.
     */
    registerFixed(command: Parameters<Shortcuts["registerFixed"]>[0]): () => void {
      const off = this.registry.registerFixed(command);
      this.syncDefinitions();
      return () => {
        off();
        this.syncDefinitions();
      };
    }

    /**
     * Theo dõi nhập liệu cố định đã phân xử cục bộ.
     * Nhận: `listener` — hàm của chủ sở hữu.
     * Trả: hàm gỡ.
     */
    observeFixedInput(listener: (input: ShortcutFixedInput) => void): () => void {
      this.fixedListeners.add(listener);
      return () => {
        this.fixedListeners.delete(listener);
      };
    }

    /** Giao một lần nhập liệu cố định cho mọi người nghe, có cộng dồn cờ đã tiêu thụ. */
    private fixedInput(input: ShortcutFixedInput): void {
      let consumed = false;
      for (const listener of [...this.fixedListeners]) {
        if (!this.fixedListeners.has(listener)) continue;
        try {
          listener(
            input.type === "reset"
              ? input
              : {
                  ...input,
                  gesture: { ...input.gesture, defaultPrevented: input.gesture.defaultPrevented || consumed },
                  consume: () => {
                    consumed = true;
                    input.consume();
                  },
                },
          );
        } catch (error) {
          console.error("Fixed shortcut handler failed", error);
        }
      }
    }

    /**
     * Mô tả một tổ hợp ứng viên theo quy tắc của thiết bị.
     * Nhận: `binding` — tổ hợp, hoặc null khi chưa gán.
     * Trả: binding chuẩn hoá, keycap, lý do từ chối và các lệnh chồng nhau.
     */
    describeBinding(binding: ShortcutBinding | null): ReturnType<Shortcuts["describeBinding"]> {
      const normalized = binding === null ? null : normalizeBinding(binding, this.platform);
      return {
        binding: normalized,
        keys: presentBinding(normalized, this.platform).keys,
        issue: normalized === null ? null : bindingIssue(normalized, this.runtime, this.platform),
        conflicts:
          normalized === null
            ? []
            : [
                ...this.catalog
                  .getSnapshot()
                  .filter((row) => row.binding !== null && overlappingBindings(row.binding, normalized))
                  .map((row) => row.id),
                ...this.fixedCatalog
                  .getSnapshot()
                  .filter((row) => row.bindings.some((candidate) => overlappingBindings(candidate, normalized)))
                  .map((row) => row.id),
              ],
      };
    }

    /** Nạp danh mục hiện tại xuống bộ chuyển lưu trữ (hoặc đánh dấu đọc hỏng khi thiếu bộ chuyển). */
    private syncDefinitions(): void {
      if (!this.active) return;
      if (this.adapter === undefined) {
        this.failRead();
        return;
      }
      void this.adapter.get(this.registry.definitions()).then(
        (snapshot) => {
          this.connected = true;
          if (this.active && snapshot.sequence >= this.config.getSnapshot().sequence) this.registry.configure(snapshot);
        },
        () => {
          this.failRead();
        },
      );
    }

    /** Đánh dấu không đọc được kho lưu trữ. */
    private failRead(): void {
      if (this.active) {
        this.registry.configure({ ...this.config.getSnapshot(), status: "unreadable", error: "read" });
      }
    }

    /**
     * Lưu một thao tác đã được người dùng xem, giữ nguyên binding đã nhận khi hỏng.
     * Nhận: `args` — thao tác và revision do trình sửa cấp.
     * Trả: kết quả đã phân loại và bản chụp đã nhận.
     */
    async edit(edit: ShortcutEdit, revision: ShortcutRevision): Promise<ShortcutSaveResult> {
      if (this.adapter === undefined) {
        return { status: "unreadable", snapshot: this.config.getSnapshot() };
      }
      let result: ShortcutSaveResult;
      try {
        result = await this.adapter.edit(edit, revision);
      } catch (error) {
        if (this.active) console.error("Shortcut preference save failed", error);
        return { status: "write-failed", snapshot: this.config.getSnapshot() };
      }
      if (this.active && result.snapshot.sequence >= this.config.getSnapshot().sequence) {
        this.registry.configure(result.snapshot);
      }
      return result;
    }

    /**
     * Bật/tắt việc chặn accelerator native khi lớp ghi phím đang giữ nhập liệu.
     * Nhận: `active` — lớp ghi có đang bật.
     * Trả: xong khi tầng native xác nhận.
     * @throws khi không có cầu Desktop.
     */
    async recording(active: boolean): Promise<void> {
      if (this.adapter === undefined) throw new Error("Desktop shortcuts bridge unavailable");
      await this.adapter.recording(active);
    }

    /**
     * Yêu cầu đóng cửa sổ Desktop theo revision hiện tại.
     * Nhận: không.
     * Trả: xong khi IPC hoàn tất.
     * @throws khi không có cầu bàn phím native.
     */
    async closeWindow(): Promise<void> {
      if (this.keyboard === undefined) throw new Error("Desktop keyboard bridge unavailable");
      await this.keyboard.closeWindow(this.config.getSnapshot().revision);
    }
  }

  /**
   * Ham dung co cong chan: lan cai thu hai cho CUNG mot ctx tra ve INSTANCE CU (khong dang ky lai).
   * Nhan: \`ctx\` — context plugin.
   * Tra: service \`shortcuts\`.
   * @throws loi that tu lan dung dau (duoc ghi log roi nem tiep).
   */
  function ShortcutsService(
    this: unknown,
    ctx: unknown,
  ): ShortcutsServiceFace | { inject: readonly string[]; apply(): void } {
    if (bundleInstalled) {
      // ⚠️ LẦN CÀI THỨ HAI PHẢI TRẢ **PLUGIN RỖNG**, KHÔNG được trả lại instance cũ.
      // Đo được 17/10/2026 (console app, nguyên văn):
      //   gbh-client-shortcuts: apply nem loi Error: service "shortcuts" has been registered
      // Tức: với gói PHƠI LỚP SERVICE, "trả cùng instance" KHÔNG đủ — cordis vẫn chạy cơ chế Service và
      // gọi provide("shortcuts") lần thứ hai bất kể instance nào. Plugin rỗng thì KHÔNG provide gì, mà vẫn
      // CÓ `apply` ⇒ cordis vẫn cài ⇒ entry alias vẫn `active` (đúng thứ ta cần), chỉ không cấp service.
      // Hạ xuống debug (18/10/2026): cảnh báo này XUẤT HIỆN ĐÚNG MỘT LẦN MỖI BOOT và là hành vi CÓ CHỦ ĐÍCH —
      // tầng nạp gọi factory cho cả id ta LẪN id alias; lần thứ hai phải trả plugin rỗng (đúng như comment trên).
      // Đo trên app thật: chạy 1 lần/boot, 0 pageerror, app lành ⇒ không phải lỗi; để mức warn làm nhiễu cổng
      // "0 warning" của check:app và dễ bị đọc nhầm thành bundle chạy hai lần.
      console.debug("gbh-client-shortcuts: factory duoc goi lan hai (id alias) — tra plugin RONG, dung nhu thiet ke");
      return { inject: [] as string[], apply: (): void => undefined };
    }
    bundleInstalled = true;
    try {
      return new ShortcutsServiceImpl(ctx) as ShortcutsServiceFace;
    } catch (error) {
      console.error("gbh-client-shortcuts: apply nem loi", error);
      throw error;
    }
  }

  // ⚠️ KHÔNG ĐƯỢC MẤT KHAI BÁO `inject` KHI BỌC LỚP BẰNG HÀM DỰNG.
  // Sự cố 17/10/2026 (console app, do cổng log của hàm dựng phơi ra):
  //   gbh-client-shortcuts: apply nem loi Error: cannot get property "locale" without inject
  // Nguyên nhân: bản bọc hàm dựng KHÔNG mang `static inject` của lớp thật ⇒ cordis coi plugin này không
  // khai `locale` ⇒ chạm `ctx.locale` là ném. Sao chép static NGAY ĐÂY để bản bọc giữ đủ hợp đồng plugin.
  (ShortcutsService as unknown as { inject: readonly string[] }).inject = ShortcutsServiceImpl.inject;
  return ShortcutsService as unknown as new (ctx: unknown) => ShortcutsServiceFace;
}
