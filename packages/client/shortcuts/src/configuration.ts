/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tai lieu tuy chon da kiem + giai xung dot tat dinh (khong phu thuoc trinh duyet)
 */

import {
  bindingKey,
  isWebBindingAllowed,
  normalizeBinding,
  type NormalizedBinding,
  type ShortcutBinding,
  type ShortcutCommandId,
  type ShortcutPlatform,
  type ShortcutProfile,
  type ShortcutRuntime,
} from "./binding.ts";

/** Ghi đè là cục bộ theo thiết bị; lệnh vắng mặt thì theo mặc định, còn `null` là gỡ hẳn. */
export interface ShortcutDocument {
  /** Phiên bản schema của tài liệu. */
  readonly schemaVersion: 1 | 2;
  /** Ghi đè theo hồ sơ vỏ:hệ điều hành. */
  readonly profiles: Readonly<Partial<Record<ShortcutProfile, Readonly<Record<string, ShortcutBinding | null>>>>>;
}

/** Định nghĩa lệnh dạng tuần tự hoá, nhận từ khung sản phẩm đã tin. */
export interface ShortcutDefinition {
  /** Id lệnh. */
  readonly id: ShortcutCommandId;
  /** Mặc định theo từng hồ sơ. */
  readonly defaults: Readonly<Partial<Record<ShortcutProfile, ShortcutBinding>>>;
  /** Hành động cố định giữ chỗ một hay nhiều tổ hợp thay vì phơi mặc định sửa được. */
  readonly fixed?: readonly [ShortcutBinding, ...ShortcutBinding[]];
}

/** Lý do từ chối, để UI chọn câu chữ đã bản địa hoá. */
export type BindingIssue = "reserved" | "unsupported-browser" | "modifier-required" | "unsupported-key";

/** Một dòng đang xung đột vẫn hiện binding đã yêu cầu nhưng không chạy được. */
export interface EffectiveShortcut {
  /** Id lệnh. */
  readonly id: ShortcutCommandId;
  /** Binding hiệu lực (null nếu chưa gán). */
  readonly binding: NormalizedBinding | null;
  /** Người dùng đã ghi đè hay chưa. */
  readonly modified: boolean;
  /** Các lệnh đang đè lên nhau. */
  readonly conflicts: readonly ShortcutCommandId[];
  /** Lý do từ chối, hoặc null nếu hợp lệ. */
  readonly issue: BindingIssue | null;
}

/** Một lần sửa tuy chọn có kiểm revision, giới hạn trong vỏ+thiết bị hiện tại. */
export type ShortcutEdit =
  | { readonly type: "set"; readonly id: ShortcutCommandId; readonly binding: ShortcutBinding | null }
  | { readonly type: "reset"; readonly id: ShortcutCommandId }
  | { readonly type: "reset-all" };

/** Giá trị là bản ghi thường (không phải mảng, không phải null). */
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Mẫu id lệnh: ít nhất hai khúc, khúc đầu chữ thường. */
const commandPattern = /^[a-z][a-zA-Z0-9-]*(?:\.[a-zA-Z][a-zA-Z0-9-]*)+$/u;

/** Mẫu hồ sơ vỏ:hệ điều hành. */
const profilePattern = /^(desktop|web):(macos|windows|linux)$/u;

/** Bộ phím bổ trợ được nhận khi đọc JSON. */
const MODIFIER_VALUES: readonly string[] = ["primary", "control", "alt", "shift", "meta"];

/** Nhánh không bao giờ tới — giữ cho union đóng. */
function assertNever(value: never, label: string): never {
  throw new Error(`Unexpected ${label}: ${String(value)}`);
}

/**
 * Kiểm các trường JSON của binding TRƯỚC khi chuẩn hoá; trường lạ bị từ chối để tránh ghi mất dữ liệu.
 * Nhận: `value` — dữ liệu từ file hoặc IPC.
 * Trả: binding với mã phím được hỗ trợ, hoặc null khi gỡ hẳn.
 * @throws khi hình dạng sai hoặc mã phím không được hỗ trợ.
 */
export function parseBinding(value: unknown): ShortcutBinding | null {
  if (value === null) return null;
  if (
    !record(value) ||
    Object.keys(value).some((key) => key !== "code" && key !== "secondCode" && key !== "modifiers") ||
    typeof value.code !== "string" ||
    !Array.isArray(value.modifiers) ||
    (Object.hasOwn(value, "secondCode") && typeof value.secondCode !== "string") ||
    !value.modifiers.every((modifier) => typeof modifier === "string" && MODIFIER_VALUES.includes(modifier))
  ) {
    throw new Error("Invalid shortcut binding");
  }
  const binding: ShortcutBinding = {
    code: value.code,
    modifiers: value.modifiers as ShortcutBinding["modifiers"],
    ...(typeof value.secondCode === "string" ? { secondCode: value.secondCode } : {}),
  };
  normalizeBinding(binding, "windows");
  return binding;
}

/**
 * Giải mã cả tài liệu mà vẫn giữ ghi đè của những lệnh đang ngủ.
 * Nhận: `raw` — JSON đã lưu, hoặc null khi chưa có tài liệu.
 * Trả: tài liệu đã nhận, hoặc lý do đọc hỏng ('invalid' | 'future').
 */
export function parseShortcutDocument(raw: string | null): ShortcutDocument | "invalid" | "future" {
  if (raw === null) return { schemaVersion: 1, profiles: {} };
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return "invalid";
    if (typeof value.schemaVersion === "number" && value.schemaVersion > 2) return "future";
    if (
      (value.schemaVersion !== 1 && value.schemaVersion !== 2) ||
      !record(value.profiles) ||
      Object.keys(value).some((key) => key !== "schemaVersion" && key !== "profiles")
    ) {
      return "invalid";
    }
    const profiles: Record<string, Record<string, ShortcutBinding | null>> = {};
    for (const [profile, overrides] of Object.entries(value.profiles)) {
      if (!profilePattern.test(profile) || !record(overrides)) return "invalid";
      const bindings: Record<string, ShortcutBinding | null> = {};
      for (const [id, binding] of Object.entries(overrides)) {
        if (!commandPattern.test(id)) return "invalid";
        const parsed = parseBinding(binding);
        if (value.schemaVersion === 1 && parsed?.secondCode !== undefined) return "invalid";
        bindings[id] = parsed;
      }
      profiles[profile] = bindings;
    }
    return { schemaVersion: value.schemaVersion, profiles };
  } catch (_error) {
    return "invalid";
  }
}

/**
 * Kiểm chỗ đã bị hệ thống/trình soạn thảo/trình duyệt giữ, dùng phím bổ trợ đã nở.
 * Nhận: `binding` — ứng viên đã chuẩn hoá, `runtime` — vỏ ứng dụng, `platform` — thiết bị.
 * Trả: lý do từ chối, hoặc null khi tổ hợp được phép.
 */
export function bindingIssue(
  binding: NormalizedBinding,
  runtime: ShortcutRuntime,
  platform: ShortcutPlatform,
): BindingIssue | null {
  const { code, modifiers } = binding;
  // Desktop trên Windows/macOS do tầng native quyết định, không kiểm ở đây.
  if (runtime === "desktop" && (platform === "windows" || platform === "macos")) return null;
  if (binding.secondCode !== undefined) return "unsupported-key";
  if (modifiers.length === 0 || modifiers.every((modifier) => modifier === "shift")) return "modifier-required";
  if ((platform === "windows" || platform === "macos") && modifiers.length >= 3) return null;
  if (runtime === "web" && (platform === "windows" || platform === "macos") && isWebBindingAllowed(binding, platform)) {
    return null;
  }
  const primary = modifiers.includes(platform === "macos" ? "meta" : "control");
  const SYSTEM_KEYS = [
    "Escape",
    "Tab",
    "Space",
    "Backspace",
    "Delete",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ];
  const EDITOR_KEYS = ["KeyC", "KeyV", "KeyX", "KeyZ", "KeyY", "KeyQ", "KeyH"];
  if (
    SYSTEM_KEYS.includes(code) ||
    (code === "Enter" && !modifiers.includes("alt")) ||
    (primary && EDITOR_KEYS.includes(code)) ||
    (primary && code === "KeyA" && !modifiers.includes("shift")) ||
    (platform !== "macos" && (modifiers.includes("meta") || (modifiers.includes("alt") && ["F4", "F2"].includes(code)))) ||
    (platform === "macos" && modifiers.includes("control") && modifiers.includes("meta")) ||
    (platform === "macos" && modifiers.includes("alt") && !primary)
  ) {
    return "reserved";
  }
  if (runtime === "web" && !isWebBindingAllowed(binding, platform)) return "unsupported-browser";
  return null;
}

/**
 * Chọn mặc định tường minh của chủ lệnh cho một hồ sơ thiết bị.
 * Nhận: `definition` — định nghĩa lệnh, `runtime`, `platform`.
 * Trả: binding đã khai, hoặc undefined khi hành động chưa gán.
 */
export function resolveShortcutDefault(
  definition: ShortcutDefinition,
  runtime: ShortcutRuntime,
  platform: ShortcutPlatform,
): ShortcutBinding | undefined {
  return definition.defaults[`${runtime}:${platform}` as ShortcutProfile];
}

/**
 * Giải ghi đè và xung đột KHÔNG phụ thuộc thứ tự đăng ký; ghi đè tường minh đẩy mặc định ra.
 * Nhận: `definitions` — lệnh đang hoạt động, `document` — tuy chọn đã nhận, `runtime`, `platform`.
 * Trả: mọi lệnh đang hoạt động, kể cả binding đang xung đột.
 */
export function effectiveShortcuts(
  definitions: readonly ShortcutDefinition[],
  document: ShortcutDocument,
  runtime: ShortcutRuntime,
  platform: ShortcutPlatform,
): readonly EffectiveShortcut[] {
  const overrides = document.profiles[`${runtime}:${platform}` as ShortcutProfile] ?? {};
  const fixed = definitions.flatMap(
    (row) => row.fixed?.map((binding) => ({ id: row.id, binding: normalizeBinding(binding, platform) })) ?? [],
  );
  const rows = definitions
    .filter((row) => row.fixed === undefined)
    .map(({ id, defaults }) => {
      const modified = Object.hasOwn(overrides, id);
      const candidate = modified ? overrides[id] : resolveShortcutDefault({ id, defaults }, runtime, platform);
      const binding = candidate == null ? null : normalizeBinding(candidate, platform);
      return {
        id,
        binding,
        modified,
        issue: binding === null ? null : bindingIssue(binding, runtime, platform),
      };
    });
  return rows.map((row) => {
    const binding = row.binding;
    return {
      ...row,
      conflicts:
        binding === null
          ? []
          : [
              ...new Set([
                ...rows
                  .filter(
                    (other) =>
                      other.id !== row.id &&
                      other.binding !== null &&
                      other.issue === null &&
                      overlappingBindings(other.binding, binding) &&
                      (!row.modified || other.modified),
                  )
                  .map((other) => other.id),
                ...fixed.filter((other) => overlappingBindings(other.binding, binding)).map((other) => other.id),
              ]),
            ],
    };
  });
}

/**
 * Phát hiện tổ hợp trùng nhau, hoặc một phím đơn nằm trong hợp âm hai phím.
 * Nhận: `left` — ứng viên đã chuẩn hoá, `right` — binding đang giữ chỗ.
 * Trả: hai binding có cùng bộ phím bổ trợ và chồng nhau hay không.
 */
export function overlappingBindings(left: NormalizedBinding, right: NormalizedBinding): boolean {
  if (left.modifiers.join("+") !== right.modifiers.join("+")) return false;
  if (left.secondCode !== undefined && right.secondCode !== undefined) return bindingKey(left) === bindingKey(right);
  return [left.code, left.secondCode].some(
    (code) => code !== undefined && (code === right.code || code === right.secondCode),
  );
}

/**
 * Áp một lần sửa mà không đụng tới hồ sơ khác hay ghi đè đang ngủ.
 * Nhận: `document`, `edit`, `runtime`, `platform`.
 * Trả: tài liệu ứng viên (còn phải kiểm xung đột và ghi bền).
 */
export function editShortcutDocument(
  document: ShortcutDocument,
  edit: ShortcutEdit,
  runtime: ShortcutRuntime,
  platform: ShortcutPlatform,
): ShortcutDocument {
  const schemaVersion =
    runtime === "desktop" && (platform === "macos" || platform === "windows") ? 2 : document.schemaVersion;
  const profile = `${runtime}:${platform}` as ShortcutProfile;
  let overrides: Record<string, ShortcutBinding | null> = { ...document.profiles[profile] };
  switch (edit.type) {
    case "set":
      overrides[edit.id] = edit.binding;
      break;
    case "reset": {
      const { [edit.id]: _removed, ...remaining } = overrides;
      overrides = remaining;
      break;
    }
    case "reset-all":
      overrides = {};
      break;
    default:
      return assertNever(edit, "shortcut edit");
  }
  return { schemaVersion, profiles: { ...document.profiles, [profile]: overrides } };
}

/**
 * Kiểm một lần sửa tuy chọn ở ranh giới IPC của Desktop.
 * Nhận: `value` — yêu cầu chưa tin từ renderer.
 * Trả: thao tác đã bị ràng buộc.
 * @throws khi yêu cầu sai hình dạng.
 */
export function parseShortcutEdit(value: unknown): ShortcutEdit {
  if (!record(value)) throw new Error("Invalid shortcut edit");
  if (value.type === "reset-all" && Object.keys(value).length === 1) return { type: value.type };
  if (typeof value.id !== "string" || !commandPattern.test(value.id)) throw new Error("Invalid shortcut command");
  if (value.type === "reset" && Object.keys(value).length === 2) return { type: "reset", id: value.id as ShortcutCommandId };
  if (value.type === "set" && Object.keys(value).length === 3) {
    return { type: "set", id: value.id as ShortcutCommandId, binding: parseBinding(value.binding) };
  }
  throw new Error("Invalid shortcut edit");
}

/**
 * Kiểm danh mục lệnh tuần tự hoá của sản phẩm đã tin, ở cửa vào IPC.
 * Nhận: `value` — định nghĩa lệnh do renderer gửi.
 * Trả: định nghĩa đã kiểm.
 * @throws khi id trùng, mặc định chồng nhau, hoặc tổ hợp không được phép.
 */
export function parseShortcutDefinitions(value: unknown): readonly ShortcutDefinition[] {
  if (!Array.isArray(value)) throw new Error("Invalid shortcut catalog");
  const ids = new Set<string>();
  for (const entry of value as unknown[]) {
    if (
      !record(entry) ||
      typeof entry.id !== "string" ||
      !commandPattern.test(entry.id) ||
      ids.has(entry.id) ||
      !record(entry.defaults) ||
      Object.keys(entry).some((key) => key !== "id" && key !== "defaults" && key !== "fixed")
    ) {
      throw new Error("Invalid shortcut definition");
    }
    ids.add(entry.id);
    if (Object.hasOwn(entry, "fixed")) {
      if (!Array.isArray(entry.fixed) || entry.fixed.length === 0 || Object.keys(entry.defaults).length > 0) {
        throw new Error("Invalid fixed shortcut definition");
      }
      for (const binding of entry.fixed) {
        if (parseBinding(binding) === null) throw new Error("Invalid fixed shortcut binding");
      }
    }
    for (const [profile, candidate] of Object.entries(entry.defaults)) {
      if (!profilePattern.test(profile)) throw new Error("Invalid shortcut profile");
      if (parseBinding(candidate) === null) throw new Error("Invalid shortcut default");
    }
  }
  const definitions = value as readonly ShortcutDefinition[];
  for (const runtime of ["desktop", "web"] as const) {
    for (const platform of ["macos", "windows", "linux"] as const) {
      const bindings: NormalizedBinding[] = [];
      for (const entry of definitions) {
        const binding = resolveShortcutDefault(entry, runtime, platform);
        if (binding === undefined) continue;
        const normalized = normalizeBinding(binding, platform);
        if (
          bindings.some((other) => overlappingBindings(other, normalized)) ||
          bindingIssue(normalized, runtime, platform) !== null
        ) {
          throw new Error("Conflicting or reserved shortcut default");
        }
        bindings.push(normalized);
      }
    }
  }
  return definitions;
}
