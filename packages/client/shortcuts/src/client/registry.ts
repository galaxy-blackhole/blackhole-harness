/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc So lenh cua ung dung: dang ky · chuan hoa mac dinh · phan xử dong bo (adapter lo listener)
 */

import {
  bindingIssue,
  bindingKey,
  effectiveShortcuts,
  initialShortcutConfig,
  isWebBindingAllowed,
  normalizeBinding,
  overlappingBindings,
  presentBinding,
  resolveShortcutDefault,
  type ShortcutConfigSnapshot,
  type ShortcutDefinition,
} from "../protocol.ts";
import type {
  ShortcutCatalogEntry,
  ShortcutCommand,
  ShortcutContext,
  ShortcutFixedCatalogEntry,
  ShortcutFixedCommand,
  ShortcutGesture,
  SnapshotStore,
} from "./types.ts";
import type { ShortcutCommandId, ShortcutPlatform, ShortcutRuntime } from "../protocol.ts";

/** Kết quả phân xử: đã xử lý, bị chặn (kèm id + lý do), hoặc bỏ qua cho tầng cục bộ/hệ thống. */
export type ShortcutDispatch =
  | { readonly status: "handled"; readonly commandId: ShortcutCommandId }
  | { readonly status: "blocked"; readonly commandId: ShortcutCommandId; readonly reason: string }
  | { readonly status: "pass" };

/** Bảng `client-store` đã cài cho module này (do điểm vào nửa browser cài TRƯỚC khi dựng sổ). */
let installedStore: ClientStoreSeam | undefined;

/**
 * Cài bảng `client-store` cho module này.
 * Nhận: `seam` — bảng lấy từ bảng module của trang.
 * Trả: không.
 */
export function installClientStore(seam: ClientStoreSeam): void {
  installedStore = seam;
}

/** Bảng `client-store` (chỉ phần sổ đăng ký dùng). */
export interface ClientStoreSeam {
  /**
   * Tạo kho có thể đặt giá trị.
   * Nhận: `initial` — giá trị đầu.
   * Trả: kho.
   */
  createSnapshotStore<T>(initial: T): SnapshotStore<T>;
}

/** Sổ đăng ký lệnh của ứng dụng; adapter giữ listener, plugin tính năng giữ hành động. */
export class ShortcutRegistry {
  /** Vỏ ứng dụng. */
  readonly runtime: ShortcutRuntime;
  /** Thiết bị nhận phím. */
  readonly platform: ShortcutPlatform;
  /** Lệnh sửa được theo id. */
  private readonly commands = new Map<string, ShortcutCommand>();
  /** Hành động cố định theo id. */
  private readonly fixedCommands = new Map<string, ShortcutFixedCommand>();
  /** Lệnh ĐANG xung đột (không chạy được nhưng vẫn hiện). */
  private readonly conflicts = new Map<string, ShortcutCommand>();
  /** Lệnh chạy được theo khoá binding. */
  private readonly bindings = new Map<string, ShortcutCommand>();
  /** Kho trạng thái nội bộ (danh mục + tuy chọn) để hai bản chụp cùng một nguồn. */
  private readonly state: SnapshotStore<{ catalog: readonly ShortcutCatalogEntry[]; config: ShortcutConfigSnapshot }>;
  /** Dòng danh mục sửa được đã bản địa hoá. */
  readonly catalog: { getSnapshot: () => readonly ShortcutCatalogEntry[]; subscribe: (listener: () => void) => () => void };
  /** Tuy chọn đã nhận + chẩn đoán đọc. */
  readonly config: { getSnapshot: () => ShortcutConfigSnapshot; subscribe: (listener: () => void) => () => void };
  /** Hành động cố định của những plugin đang mount. */
  readonly fixedCatalog: SnapshotStore<readonly ShortcutFixedCatalogEntry[]>;

  /**
   * Dựng sổ đăng ký cho một vỏ + thiết bị.
   * Nhận: `runtime`, `platform`, `config` — tuy chọn ban đầu (mặc định: đã sẵn sàng, chưa có gì).
   * Trả: sổ đăng ký.
   */
  constructor(runtime: ShortcutRuntime, platform: ShortcutPlatform, config?: ShortcutConfigSnapshot, store?: ClientStoreSeam) {
    this.runtime = runtime;
    this.platform = platform;
    const seam = store ?? installedStore;
    if (seam === undefined) throw new Error("shortcuts: client-store chua duoc cai");
    const initial = config ?? { ...initialShortcutConfig(), status: "ready" as const };
    this.state = seam.createSnapshotStore({ catalog: [] as readonly ShortcutCatalogEntry[], config: initial });
    this.catalog = {
      getSnapshot: () => this.state.getSnapshot().catalog,
      subscribe: (listener) => this.state.subscribe(listener),
    };
    this.config = {
      getSnapshot: () => this.state.getSnapshot().config,
      subscribe: (listener) => this.state.subscribe(listener),
    };
    this.fixedCatalog = seam.createSnapshotStore([] as readonly ShortcutFixedCatalogEntry[]);
  }

  /**
   * Danh mục đang hoạt động ở dạng tuần tự hoá được (không callback, không nhãn).
   * Nhận: không.
   * Trả: định nghĩa để kiểm lưu trữ.
   */
  definitions(): readonly ShortcutDefinition[] {
    return [
      ...[...this.commands.values()].map(({ id, defaults }) => ({ id, defaults })),
      ...[...this.fixedCommands.values()].map(({ id, bindings }) => ({ id, defaults: {}, fixed: bindings })),
    ];
  }

  /**
   * Đăng ký hành động nhập liệu chỉ-đọc mà phím của nó không được gán cho lệnh sửa được.
   * Nhận: `command` — hành động đã bản địa hoá và chuỗi phím.
   * Trả: hàm gỡ (gọi lại vô hại).
   * @throws khi id trùng hoặc tổ hợp không hợp lệ.
   */
  registerFixed(command: ShortcutFixedCommand): () => void {
    if (this.fixedCommands.has(command.id) || this.commands.has(command.id)) {
      throw new Error(`Duplicate shortcut command: ${command.id}`);
    }
    for (const binding of command.bindings) normalizeBinding(binding, this.platform);
    this.fixedCommands.set(command.id, command);
    this.refreshLabels();
    return () => {
      if (this.fixedCommands.get(command.id) !== command) return;
      this.fixedCommands.delete(command.id);
      this.refreshLabels();
    };
  }

  /** Cập nhật danh mục hành động cố định (nhãn gọi lại mỗi lần). */
  private refreshFixedLabels(): void {
    this.fixedCatalog.set(
      [...this.fixedCommands.values()].map((command) => ({
        id: command.id,
        label: command.label(),
        keys: command.keys,
        group: command.group,
        bindings: command.bindings.map((binding) => normalizeBinding(binding, this.platform)),
      })),
    );
  }

  /**
   * Công bố tuy chọn đã nhận và mọi nhãn dẫn xuất trong MỘT lần đặt.
   * Nhận: `config` — bản chụp mới nhất của chủ kho.
   * Trả: không.
   */
  configure(config: ShortcutConfigSnapshot): void {
    const current = this.config.getSnapshot();
    if (config.revision === current.revision && config.status === current.status && config.error === current.error) return;
    this.refreshLabels(config);
  }

  /**
   * Đăng ký lệnh sau khi đã kiểm mặc định trên MỌI vỏ + thiết bị được hỗ trợ.
   * Nhận: `command` — định nghĩa của tính năng.
   * Trả: hàm gỡ (gọi lại vô hại).
   * @throws khi id trùng, mặc định bị giữ chỗ, không hợp lệ trên Web, hoặc chồng nhau.
   */
  register(command: ShortcutCommand): () => void {
    if (this.commands.has(command.id) || this.fixedCommands.has(command.id)) {
      throw new Error(`Duplicate shortcut command: ${command.id}`);
    }
    for (const runtime of ["desktop", "web"] as const) {
      for (const platform of ["macos", "windows", "linux"] as const) {
        const candidate = resolveShortcutDefault(command, runtime, platform);
        if (candidate === undefined) continue;
        const binding = normalizeBinding(candidate, platform);
        if (runtime === "web" && !isWebBindingAllowed(binding, platform)) {
          throw new Error(`Unsupported Web shortcut: ${command.id}`);
        }
        if (bindingIssue(binding, runtime, platform) !== null) throw new Error(`Reserved shortcut default: ${command.id}`);
        for (const existing of this.commands.values()) {
          const other = resolveShortcutDefault(existing, runtime, platform);
          if (other !== undefined && overlappingBindings(binding, normalizeBinding(other, platform))) {
            throw new Error(`Conflicting shortcut defaults: ${command.id} and ${existing.id} (${runtime}:${platform})`);
          }
        }
      }
    }
    this.commands.set(command.id, command);
    this.refreshLabels();
    return () => {
      if (this.commands.get(command.id) !== command) return;
      this.commands.delete(command.id);
      this.refreshLabels();
    };
  }

  /**
   * Tính lại binding hiệu lực khi tuy chọn, danh mục lệnh hoặc ngôn ngữ đổi.
   * Nhận: `config` — tuy chọn đã nhận (mặc định: bản chụp hiện tại).
   * Trả: không.
   */
  refreshLabels(config: ShortcutConfigSnapshot = this.config.getSnapshot()): void {
    this.bindings.clear();
    this.conflicts.clear();
    const catalog = effectiveShortcuts(this.definitions(), config.document, this.runtime, this.platform).map((row) => {
      // `effectiveShortcuts` chỉ trả về dòng cho lệnh ĐÃ đăng ký, nên tra cứu này luôn có kết quả.
      const current = this.commands.get(row.id) as ShortcutCommand;
      const enabled = config.status !== "loading" && row.issue === null && row.conflicts.length === 0;
      if (enabled && row.binding !== null) this.bindings.set(bindingKey(row.binding), current);
      if (config.status !== "loading" && row.issue === null && row.conflicts.length > 0 && row.binding !== null) {
        this.conflicts.set(bindingKey(row.binding), current);
      }
      const presented = presentBinding(row.binding, this.platform);
      return {
        ...row,
        label: current.label(),
        aliases: current.aliases,
        keys: presented.keys,
        aria: enabled ? presented.aria : undefined,
      };
    });
    this.state.set({ config, catalog });
    this.refreshFixedLabels();
  }

  /**
   * Chạy một lựa chọn từ menu native, không phụ thuộc binding phím của nó.
   * Nhận: `id` — lệnh đã đăng ký, `context` — vùng nhập và trạng thái modal.
   * Trả: không.
   */
  invoke(id: ShortcutCommandId, context: ShortcutContext): void {
    const command = this.commands.get(id);
    if (command === undefined || (context.modal !== null && !command.modals.includes(context.modal))) return;
    const result = command.resolve({ ...context, source: "menu" });
    if (result.status === "handled") result.run();
  }

  /**
   * Desktop trên Windows/macOS ưu tiên hơn vùng nhập và modal, bất kể nguồn cấu hình.
   * Nhận: `gesture` — dữ kiện phím đã chuẩn hoá, `context` — vùng nhập đồng bộ, `consume` — hàm chặn mặc định của adapter (gọi TRƯỚC khi chạy nghiệp vụ).
   * Trả: đã xử lý / bị chặn kèm lý do / bỏ qua.
   */
  dispatch(gesture: ShortcutGesture, context: ShortcutContext, consume: () => void): ShortcutDispatch {
    if (gesture.defaultPrevented || gesture.composing) return { status: "pass" };
    const modifiers = (["control", "alt", "shift", "meta"] as const).filter((value) => gesture[value]);
    const pairKey = bindingKey({
      code: gesture.code,
      modifiers,
      ...(gesture.secondCode === undefined ? {} : { secondCode: gesture.secondCode }),
    });
    const key =
      this.bindings.has(pairKey) || this.conflicts.has(pairKey)
        ? pairKey
        : bindingKey({ code: gesture.code, modifiers });
    const command = this.bindings.get(key) ?? this.conflicts.get(key);
    const priority = this.runtime === "desktop" && (this.platform === "windows" || this.platform === "macos");
    if (command === undefined || (!priority && !command.regions.includes(context.region))) return { status: "pass" };
    if (
      !priority &&
      context.region === "terminal" &&
      gesture.control &&
      !gesture.meta &&
      !gesture.alt &&
      !gesture.shift &&
      (gesture.code === "KeyW" || gesture.code === "KeyR")
    ) {
      return { status: "pass" };
    }
    if (!this.bindings.has(key)) {
      consume();
      return { status: "blocked", commandId: command.id, reason: "conflict" };
    }
    if (!priority && context.modal !== null && !command.modals.includes(context.modal)) {
      consume();
      return { status: "blocked", commandId: command.id, reason: "modal" };
    }
    const resolution = command.resolve(context);
    if (resolution.status === "pass") return resolution;
    consume();
    if (resolution.status === "blocked") return { ...resolution, commandId: command.id };
    if (!gesture.repeat) resolution.run();
    return { status: "handled", commandId: command.id };
  }
}
