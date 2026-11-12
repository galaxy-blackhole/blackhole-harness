/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Protocol phim VAT LY: chuan hoa · khoa ghep · hien thi keycap/ARIA — khong dung DOM
 */

/** Id lệnh ổn định, do tính năng đăng ký sở hữu. */
export type ShortcutCommandId = string & { readonly __brand?: "ShortcutCommandId" };

/** Hệ điều hành của thiết bị nhận phím. */
export type ShortcutPlatform = "macos" | "windows" | "linux";

/** Vỏ ứng dụng quyết định bộ mặc định. */
export type ShortcutRuntime = "desktop" | "web";

/** Vỏ + hệ điều hành chọn ra một hồ sơ mặc định/tuỳ chọn. */
export type ShortcutProfile = `${ShortcutRuntime}:${ShortcutPlatform}`;

/** Phím bổ trợ logic; `primary` nở thành Meta trên macOS và Control ở nơi khác. */
export type ShortcutModifier = "primary" | "control" | "alt" | "shift" | "meta";

/** Một hoặc hai phím vật lý khác nhau được giữ cùng lúc, kèm bộ phím bổ trợ chính xác. */
export interface ShortcutBinding {
  /** Mã phím vật lý (`KeyA`, `Digit1`, `F1..F24`, hoặc tên trong bảng tên phím). */
  readonly code: string;
  /** Phím thứ hai của hợp âm (tuỳ chọn). */
  readonly secondCode?: string;
  /** Các phím bổ trợ đã khai. */
  readonly modifiers: readonly ShortcutModifier[];
}

/** Bộ phím bổ trợ sau khi nở; thứ tự này cũng là thứ tự keycap. */
export type NormalizedModifier = "control" | "alt" | "shift" | "meta";

/** Binding đã chuẩn hoá. */
export interface NormalizedBinding {
  /** Mã phím vật lý (đã sắp xếp khi có hợp âm). */
  readonly code: string;
  /** Phím thứ hai nếu có. */
  readonly secondCode?: string;
  /** Phím bổ trợ theo thứ tự chuẩn. */
  readonly modifiers: readonly NormalizedModifier[];
}

/** Tên hiển thị của những mã phím không phải chữ/số. */
const KEY_NAMES: Record<string, string> = {
  Slash: "/",
  Comma: ",",
  Period: ".",
  Backslash: "\\",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Enter: "Enter",
  Escape: "Esc",
  Space: "Space",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/** Thứ tự chuẩn của phím bổ trợ. */
export const MODIFIER_ORDER: readonly NormalizedModifier[] = ["control", "alt", "shift", "meta"];

/** Mẫu mã phím vật lý được nhận. */
const CODE_PATTERN = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4]))$/u;

/** Ký hiệu keycap theo hệ điều hành. */
const MODIFIER_SYMBOLS: Record<ShortcutPlatform, Record<NormalizedModifier, string>> = {
  macos: { control: "⌃", alt: "⌥", shift: "⇧", meta: "⌘" },
  windows: { control: "Ctrl", alt: "Alt", shift: "Shift", meta: "Meta" },
  linux: { control: "Ctrl", alt: "Alt", shift: "Shift", meta: "Meta" },
};

/** Tên phím bổ trợ dùng cho ARIA. */
const MODIFIER_ARIA: Record<NormalizedModifier, string> = {
  control: "Control",
  alt: "Alt",
  shift: "Shift",
  meta: "Meta",
};

/**
 * Nở phím bổ trợ logic, bỏ trùng và kiểm mã phím vật lý.
 * Nhận: `binding` — binding đã khai, `platform` — thiết bị nhận phím.
 * Trả: binding chuẩn hoá (mã phím đã sắp xếp khi có hợp âm).
 * @throws khi mã phím không được hỗ trợ hoặc hai phím trùng nhau.
 */
export function normalizeBinding(binding: ShortcutBinding, platform: ShortcutPlatform): NormalizedBinding {
  const codes = [binding.code, ...(binding.secondCode === undefined ? [] : [binding.secondCode])].sort();
  for (const code of codes) {
    if (!CODE_PATTERN.test(code) && !Object.hasOwn(KEY_NAMES, code)) throw new Error(`Unsupported shortcut code: ${code}`);
  }
  if (codes.length === 2 && codes[0] === codes[1]) throw new Error("Shortcut keys must be distinct");
  const modifiers = new Set(
    binding.modifiers.map((value) => (value === "primary" ? (platform === "macos" ? "meta" : "control") : value)),
  );
  const primary = codes[0] as string;
  const second = codes[1];
  return {
    code: primary,
    ...(second === undefined ? {} : { secondCode: second }),
    modifiers: MODIFIER_ORDER.filter((value) => modifiers.has(value)),
  };
}

/**
 * Tạo khoá so khớp CHÍNH XÁC từ binding đã chuẩn hoá.
 * Nhận: `binding` — binding đã chuẩn hoá.
 * Trả: khoá ổn định dùng cho cả so khớp lẫn kiểm xung đột.
 */
export function bindingKey(binding: NormalizedBinding): string {
  const codes = binding.secondCode === undefined ? [binding.code] : [binding.code, binding.secondCode].sort();
  return [...binding.modifiers, ...codes].join("+");
}

/**
 * Định dạng keycap và ARIA. Windows chèn dấu cộng giữa các phím bổ trợ, còn hai phím của hợp âm thì đứng liền nhau.
 * Nhận: `binding` — binding đã chuẩn hoá (hoặc null khi chưa gán), `platform` — thiết bị nhận phím.
 * Trả: keycap hiển thị và chuỗi ARIA (hợp âm hai phím không có ARIA vì ARIA chỉ nhận một phím không-bổ-trợ).
 */
export function presentBinding(
  binding: NormalizedBinding | null,
  platform: ShortcutPlatform,
): { keys: readonly string[]; aria: string | undefined } {
  if (binding === null) return { keys: [], aria: undefined };
  const key = KEY_NAMES[binding.code] ?? binding.code.replace(/^(Key|Digit)/u, "");
  const symbols = MODIFIER_SYMBOLS[platform];
  const ariaKey =
    binding.code === "Space"
      ? "Space"
      : binding.code === "Escape"
        ? "Escape"
        : binding.code.startsWith("Arrow")
          ? binding.code
          : key;
  const second = binding.secondCode === undefined ? [] : [KEY_NAMES[binding.secondCode] ?? binding.secondCode.replace(/^(Key|Digit)/u, "")];
  const keys = [...binding.modifiers.map((value) => symbols[value]), key];
  return {
    keys: [
      ...(platform === "windows" ? keys.flatMap((label, index) => (index === 0 ? [label] : ["+", label])) : keys),
      ...second,
    ],
    aria:
      binding.secondCode === undefined
        ? [...binding.modifiers.map((value) => MODIFIER_ARIA[value]), ariaKey].join("+")
        : undefined,
  };
}

/**
 * Kiểm tổ hợp trên Web: Windows/macOS nhận thêm mọi tổ hợp 3–4 phím bổ trợ; Linux giữ bộ hạn chế.
 * Nhận: `binding` — ứng viên đã chuẩn hoá, `platform` — thiết bị nhận phím.
 * Trả: có được nhận hay không (được nhận không bảo đảm trình duyệt/hệ thống sẽ giao phím).
 */
export function isWebBindingAllowed(binding: NormalizedBinding, platform: ShortcutPlatform): boolean {
  if (binding.secondCode !== undefined) return false;
  if (platform === "windows" || platform === "macos") {
    if (binding.modifiers.length >= 3) return true;
    const primary = platform === "macos" ? "meta" : "control";
    if (
      binding.modifiers.length === 1 &&
      ((['Comma', 'Backslash'].includes(binding.code) && binding.modifiers[0] === primary) ||
        (binding.code === "Backquote" && binding.modifiers[0] === "control"))
    ) {
      return true;
    }
    if (
      binding.modifiers.length === 2 &&
      binding.modifiers.includes(primary) &&
      (binding.modifiers.includes("alt") || binding.modifiers.includes("shift"))
    ) {
      return true;
    }
  }
  const allowList: ShortcutBinding[] = [
    { code: "Slash", modifiers: ["primary"] },
    { code: "Comma", modifiers: ["primary", "shift"] },
    { code: "Period", modifiers: ["primary", "shift"] },
  ];
  return allowList.some((candidate) => bindingKey(binding) === bindingKey(normalizeBinding(candidate, platform)));
}
