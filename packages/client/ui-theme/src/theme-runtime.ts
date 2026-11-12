/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc ThemeRuntime: so dang ky theme + tuy chon + co font + layer override token — chuyen 1:1 tu
 *   client/index.js cua bundle goc (lib/client.js dong 1522-2003)
 */

import { SETTINGS_NS, THEME_CHANGE_EVENT } from "./ids.ts";
import {
  DEFAULT_FONT_SIZES,
  DEFAULT_PREFERENCE,
  FONT_FAMILY_FIELDS,
  FONT_ROLES,
  FONT_SIZE_SPECS,
  fontFamilyVariable,
  isFontSize,
  isThemePreference,
  normalizeFontFamily,
  sectionFontSizes,
} from "./theme-settings.ts";
import type { FontFamilies, FontSizes, FontRole, ThemePreference, ThemeSection } from "./theme-settings.ts";

/** Một token: giá trị theo hai chế độ màu. */
export interface TokenModes {
  /** Giá trị cho chế độ sáng. */
  readonly light: string;
  /** Giá trị cho chế độ tối. */
  readonly dark: string;
}

/** Định nghĩa một theme đã đăng ký. */
export interface ThemeDefinition {
  /** Id theme (không được là "system"). */
  readonly id: string;
  /** Chế độ màu của theme. */
  readonly colorScheme: "light" | "dark";
  /** Token của theme: tên → giá trị theo chế độ (đã gộp layer override ở bản active). */
  readonly tokens: Readonly<Record<string, string>>;
}

/** Snapshot bất biến mà UI đọc. */
export interface ThemeSnapshot {
  /** Tuỳ chọn đang dùng ("system" hoặc id theme). */
  readonly preference: string;
  /** Cỡ chữ theo vai trò. */
  readonly fontSizes: FontSizes;
  /** Danh sách font theo vai trò. */
  readonly fontFamilies: FontFamilies;
  /** Theme đang áp dụng (đã gộp override). */
  readonly active: ThemeDefinition;
  /** Mọi theme đã đăng ký. */
  readonly themes: readonly ThemeDefinition[];
  /** Số lần phát sự kiện. */
  readonly revision: number;
}

/** Một dòng mô tả token cho công cụ soi (exportInspectTokens). */
export interface InspectToken {
  /** Tên token. */
  readonly name: string;
  /** Mô tả. */
  readonly description: string;
  /** Kiểu giá trị. */
  readonly valueType: string;
  /** Có cần cả hai chế độ màu không. */
  readonly requiresLightAndDark: boolean;
  /** Tên biến CSS (khi tên bắt đầu bằng --). */
  readonly cssVariable?: string;
}

/** Seam Host: scope settings bền vững của chính plugin này. */
export interface ThemeHostScope {
  /** @returns snapshot của namespace (value là phần dữ liệu đã chấp nhận). */
  getSnapshot(): { value?: ThemeSection };
  /**
   * Ghi một trường.
   * @param field - tên trường.
   * @param value - giá trị mới.
   * @returns promise hoàn tất khi Host nhận.
   */
  set(field: string, value: unknown): Promise<unknown> | unknown;
  /**
   * Ghi nhiều thao tác trong MỘT lần.
   * @param ops - danh sách thao tác set.
   * @returns promise hoàn tất khi Host nhận.
   */
  mutate(ops: readonly { op: string; path: readonly string[]; value: unknown }[]): Promise<unknown> | unknown;
  /**
   * Theo dõi thay đổi của namespace.
   * @param listener - hàm được gọi khi đổi.
   * @returns hàm huỷ đăng ký.
   */
  subscribe(listener: () => void): () => void;
}

/** Phần dịch vụ shortcuts mà runtime dùng để đăng ký phím cỡ chữ (desktop). */
export interface ThemeShortcutsScope {
  /** Nơi chạy (web/desktop). */
  readonly runtime: string;
  /** Mô tả tổ hợp vật lý. */
  describeBinding(binding: { code: string; modifiers: readonly string[] }): { binding: { code: string; modifiers: readonly string[] }; keys: readonly string[] };
  /** Đăng ký lệnh menu cố định. */
  registerFixed(command: Record<string, unknown>): () => void;
  /** Theo dõi phím của lệnh cố định. */
  observeFixedInput(listener: (input: ThemeFixedInput) => void): () => void;
}

/** Một lần bấm phím đi vào lệnh cố định. */
export interface ThemeFixedInput {
  /** Loại đầu vào. */
  readonly type: string;
  /** Tổ hợp vật lý. */
  readonly gesture: { composing: boolean; defaultPrevented: boolean; repeat: boolean; code: string } & Record<string, unknown>;
  /** Ngữ cảnh phím. */
  readonly context: { region: string };
  /** Đánh dấu đã xử lý. */
  consume(): void;
}

/** Context phía browser mà runtime cần (chỉ phần thật dùng). */
export interface ThemeRuntimeContext {
  /**
   * Đăng ký hiệu ứng sống theo plugin.
   * @param effect - hàm trả về disposer.
   * @param label - nhãn để gỡ lỗi.
   */
  effect(effect: () => void | (() => void), label?: string): void;
  /**
   * Phát sự kiện theme/change.
   * @param event - tên sự kiện.
   * @param payload - snapshot.
   */
  emit(event: string, payload?: unknown): void;
  /**
   * Chạy callback khi các dịch vụ có mặt.
   * @param services - tên dịch vụ cần.
   * @param callback - hàm nhận scope.
   */
  inject(services: readonly string[], callback: (scope: { shortcuts: ThemeShortcutsScope; locale: { bind(ns: string): (key: string) => string }; effect(effect: () => void | (() => void), label?: string): void }) => void): void;
}

/** Hai theme dựng sẵn: bảng token nằm trong stylesheet cơ sở, registry chỉ giữ định danh. */
const BUILTIN_THEMES: readonly ThemeDefinition[] = Object.freeze([
  Object.freeze({ id: "light", colorScheme: "light", tokens: Object.freeze({}) }) as ThemeDefinition,
  Object.freeze({ id: "dark", colorScheme: "dark", tokens: Object.freeze({}) }) as ThemeDefinition,
]);

/** Danh mục token mà công cụ soi liệt kê sẵn (NGUYÊN VĂN bản gốc — 14 token). */
const BUILTIN_INSPECT_TOKENS: readonly { name: string; description: string }[] = [
  { name: "--dsw-alias-bg-base", description: "Application base background." },
  { name: "--dsw-alias-bg-layer-1", description: "Primary raised surface background." },
  { name: "--dsw-alias-bg-layer-2", description: "Secondary nested surface background." },
  { name: "--dsw-alias-bg-overlay", description: "Overlay and popover background." },
  { name: "--dsw-alias-border-l1", description: "Primary subtle border." },
  { name: "--dsw-alias-border-l2", description: "Secondary stronger border." },
  { name: "--dsw-alias-brand-primary", description: "Primary brand accent." },
  { name: "--dsw-alias-label-primary", description: "Primary text color." },
  { name: "--dsw-alias-label-secondary", description: "Secondary text color." },
  { name: "--dsw-alias-state-error-primary", description: "Primary error state color." },
  { name: "--dsw-alias-state-idle-primary", description: "Primary inactive state color." },
  { name: "--dsw-alias-state-success-primary", description: "Primary success state color." },
  { name: "--dsw-alias-state-warn-primary", description: "Primary warning state color." },
  { name: "--dsw-specific-sidebar-fill", description: "Sidebar column and title-row background." },
];

/**
 * Đọc cỡ chữ mà script boot của Host đã ghi lên body TRƯỚC khi plugin chạy, để snapshot đầu khớp lần vẽ
 * đầu (không nháy giá trị mặc định trong lúc chờ settings). Không có DOM / giá trị ngoài khoảng ⇒ mặc định.
 * @returns cỡ chữ theo vai trò.
 */
function bootstrapFontSizes(): FontSizes {
  if (typeof document === "undefined") return DEFAULT_FONT_SIZES;
  const read = (role: FontRole): number => {
    const parsed = Number.parseInt(document.body.style.getPropertyValue(FONT_SIZE_SPECS[role].variable), 10);
    return isFontSize(role, parsed) ? parsed : FONT_SIZE_SPECS[role].default;
  };
  return Object.freeze({ text: read("text"), code: read("code"), terminal: read("terminal") });
}

/**
 * Đọc danh sách font mà script boot của Host đã ghi lên body (cùng lý do với bootstrapFontSizes).
 * @returns danh sách font đã chuẩn hoá theo vai trò.
 */
function bootstrapFontFamilies(): FontFamilies {
  if (typeof document === "undefined") return Object.freeze({ text: "", code: "", terminal: "" });
  const style = document.body.style;
  return Object.freeze({
    text: normalizeFontFamily(style.getPropertyValue(fontFamilyVariable("text"))),
    code: normalizeFontFamily(style.getPropertyValue(fontFamilyVariable("code"))),
    terminal: normalizeFontFamily(style.getPropertyValue(fontFamilyVariable("terminal"))),
  });
}

/**
 * Danh sách font đã chuẩn hoá từ một section settings đã được chấp nhận (tài liệu sửa tay có thể chứa input thô).
 * @param section - section settings đã chấp nhận.
 * @returns danh sách font theo vai trò.
 */
function durableFontFamilies(section: ThemeSection): FontFamilies {
  return Object.freeze({
    text: normalizeFontFamily(section.textFontFamily),
    code: normalizeFontFamily(section.codeFontFamily),
    terminal: normalizeFontFamily(section.terminalFontFamily),
  });
}

/**
 * Kiểm hình dạng runtime của MỘT layer override (caller sinh bởi model đưa JS không kiểu vào biên này).
 * @param source - định danh layer (dùng trong thông điệp lỗi).
 * @param tokens - ánh xạ tên token → cặp {light,dark}.
 * @returns bản sao phòng vệ theo từng token.
 */
function validateOverrides(source: string, tokens: Record<string, unknown>): Record<string, TokenModes> {
  const validated: Record<string, TokenModes> = {};
  for (const [name, value] of Object.entries(tokens)) {
    if (typeof value === "string") {
      throw new TypeError(
        'theme override "' + name + '" from "' + source + '" is a bare string — pass { light: ' + JSON.stringify(value) + ", dark: " + JSON.stringify(value) + " } (repeat the value when it is the same in both palettes); a single value goes illegible when the user switches color scheme",
      );
    }
    const modes = value as { light?: unknown; dark?: unknown } | null;
    if (modes === null || typeof modes !== "object" || typeof modes.light !== "string" || typeof modes.dark !== "string") {
      throw new TypeError('theme override "' + name + '" from "' + source + '" must map to a { light, dark } pair of strings — one value per color scheme');
    }
    validated[name] = { light: modes.light, dark: modes.dark };
  }
  return validated;
}

/**
 * Mô tả mặc định cho một token do composition hiện tại đăng ký.
 * @param name - tên token.
 * @returns dòng mô tả token.
 */
function dynamicToken(name: string): InspectToken {
  return {
    name,
    description: "Theme token registered by the current Client composition.",
    valueType: "CSS value",
    requiresLightAndDark: true,
    ...(name.startsWith("--") ? { cssVariable: name } : {}),
  };
}

/**
 * Đăng ký phím cỡ chữ cho Desktop khi có dịch vụ bàn phím + từ điển (bản gốc: installFontSizeShortcuts).
 * @param ctx - context phía browser.
 * @param adjust - hàm đổi mọi cỡ chữ theo delta.
 * @returns không.
 */
function installFontSizeShortcuts(ctx: ThemeRuntimeContext, adjust: (delta: number) => void): void {
  ctx.inject(["shortcuts", "locale"], (scope) => {
    if (scope.shortcuts.runtime !== "desktop") return;
    const t = scope.locale.bind(SETTINGS_NS);
    const combinations: { binding: { code: string; modifiers: readonly string[] }; delta: number }[] = [];
    for (const [direction, code, delta] of [["increase", "Equal", 1], ["decrease", "Minus", -1]] as const) {
      const binding = { code, modifiers: ["primary"] };
      const bindings = direction === "increase" ? [binding, { code, modifiers: ["primary", "shift"] }] : [binding];
      for (const candidate of bindings) combinations.push({ binding: scope.shortcuts.describeBinding(candidate).binding, delta });
      scope.effect(
        () =>
          scope.shortcuts.registerFixed({
            id: "fontSize." + direction,
            label: () => t("fontSize.text." + direction),
            keys: scope.shortcuts.describeBinding(binding).keys,
            bindings,
            group: "application",
          }),
        "ui-theme: " + direction + " font size reference",
      );
    }
    scope.effect(
      () =>
        scope.shortcuts.observeFixedInput((input) => {
          if (input.type === "reset") return;
          const { gesture, context } = input;
          if (gesture.composing || gesture.defaultPrevented || gesture.repeat || context.region === "terminal") return;
          const matched = combinations.find(
            ({ binding }) =>
              binding.code === gesture.code &&
              ["control", "alt", "shift", "meta"].every((modifier) => gesture[modifier] === binding.modifiers.includes(modifier)),
          );
          if (matched === undefined) return;
          input.consume();
          adjust(matched.delta);
        }),
      "ui-theme: font size input",
    );
  });
}

/**
 * Lõi của row ui-theme: sổ đăng ký theme + tuỳ chọn + cỡ chữ/danh sách font + layer override token.
 *
 * light/dark là dựng sẵn (stylesheet cơ sở mang cả hai palette); theme bên thứ ba đăng ký lớp alias.
 * Đọc qua getTheme, ghi tuỳ chọn CHỈ qua setTheme, đồng bộ liên tục CHỈ qua sự kiện theme/change.
 */
export class ThemeRuntime {
  private readonly themes: ThemeDefinition[];
  private preference: string = DEFAULT_PREFERENCE;
  private fontSizes: FontSizes = bootstrapFontSizes();
  private fontFamilies: FontFamilies = bootstrapFontFamilies();
  private revision = 0;
  /**
   * Số lượt ghi settings của CHÍNH mình chưa hoàn tất; adopt chờ về 0 để tiếng dội của lượt ghi CŨ
   * không hoàn nguyên thay đổi MỚI hơn.
   */
  private pendingWrites = 0;
  private snapshot: ThemeSnapshot;
  private readonly media: { matches: boolean; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } | undefined;
  /** Layer override theo nguồn; seq (tăng dần) là thứ tự xếp lớp. */
  private readonly overrides = new Map<string, { seq: number; tokens: Record<string, TokenModes> }>();
  private overrideSeq = 0;

  /**
   * @param ctx - context sở hữu (sự kiện phát trên đó; listener media/scope được gỡ qua ctx.effect).
   * @param host - scope tuỳ chọn bền vững của Host do chính plugin này sở hữu.
   */
  constructor(
    private readonly ctx: ThemeRuntimeContext,
    private readonly host: ThemeHostScope,
  ) {
    this.themes = [...BUILTIN_THEMES];
    this.media = typeof matchMedia === "undefined" ? undefined : matchMedia("(prefers-color-scheme: dark)");
    this.snapshot = this.buildSnapshot();
    if (this.media !== undefined) {
      const media = this.media;
      const onChange = (): void => {
        if (this.preference !== "system") return;
        this.publish();
      };
      ctx.effect(() => {
        if (typeof media.addEventListener !== "function") return undefined;
        media.addEventListener("change", onChange);
        return () => {
          media.removeEventListener?.("change", onChange);
        };
      }, "ui-theme: prefers-color-scheme listener");
    }
    ctx.effect(
      () =>
        host.subscribe(() => {
          this.adopt();
        }),
      "ui-theme: settings scope adoption",
    );
    this.adopt();
    installFontSizeShortcuts(ctx, (delta) => {
      this.adjustFontSizes(delta);
    });
  }

  /**
   * Đọc snapshot theme hiện tại.
   * @returns snapshot (tham chiếu ổn định tới lần đổi kế tiếp).
   */
  getTheme(): ThemeSnapshot {
    return this.snapshot;
  }

  /**
   * Xuất danh mục token hiện tại mà KHÔNG đọc DOM/computed style.
   * @returns mô tả token an toàn JSON, gồm cả tên đã đăng ký và tên chỉ có trong override.
   */
  exportInspectTokens(): InspectToken[] {
    const tokens = new Map<string, InspectToken>(
      BUILTIN_INSPECT_TOKENS.map((token) => [token.name, { ...token, valueType: "CSS color", requiresLightAndDark: true, cssVariable: token.name }]),
    );
    for (const theme of this.themes) for (const name of Object.keys(theme.tokens)) if (!tokens.has(name)) tokens.set(name, dynamicToken(name));
    for (const layer of this.overrides.values()) for (const name of Object.keys(layer.tokens)) if (!tokens.has(name)) tokens.set(name, dynamicToken(name));
    return [...tokens.values()].map((token) => ({ ...token })).sort((left, right) => left.name.localeCompare(right.name));
  }

  /**
   * Đổi tuỳ chọn theme — cửa ghi tuỳ chọn người dùng DUY NHẤT.
   * @param id - id theme đã đăng ký hoặc "system"; id lạ thì ném.
   * @returns không.
   */
  setTheme(id: string): void {
    if (id !== "system" && !this.themes.some((theme) => theme.id === id)) throw new Error('theme "' + id + '" is not registered');
    if (this.preference === id) return;
    this.preference = id;
    if (isThemePreference(id)) this.write(() => this.host.set("preference", id));
    this.publish();
  }

  /**
   * Đổi cỡ chữ của một vai trò; giá trị hợp lệ được ghi qua scope settings và phát theme/change.
   * @param role - vai trò font.
   * @param px - số nguyên px trong khoảng FONT_SIZE_SPECS của vai trò; ngoài khoảng/không nguyên thì ném.
   * @returns không.
   */
  setFontSize(role: FontRole, px: number): void {
    const spec = FONT_SIZE_SPECS[role];
    if (!isFontSize(role, px)) throw new Error(role + " font size " + px + " is outside " + spec.min + ".." + spec.max);
    if (this.fontSizes[role] === px) return;
    this.fontSizes = Object.freeze({ ...this.fontSizes, [role]: px });
    this.write(() => this.host.set(spec.field, px));
    this.publish();
  }

  /**
   * Cộng/trừ mọi cỡ chữ trong khoảng riêng của từng vai trò và lưu các trường đổi trong MỘT lượt mutate.
   * @param delta - số px cộng vào mỗi vai trò (âm để giảm).
   * @returns không (không ghi/không phát sự kiện khi mọi vai trò đã ở biên).
   */
  adjustFontSizes(delta: number): void {
    const fontSizes: Record<FontRole, number> = { ...this.fontSizes };
    const fields: Record<string, number> = {};
    for (const role of FONT_ROLES) {
      const { field, min, max } = FONT_SIZE_SPECS[role];
      const px = Math.max(min, Math.min(max, fontSizes[role] + delta));
      if (px === fontSizes[role]) continue;
      fontSizes[role] = px;
      fields[field] = px;
    }
    const ops = Object.entries(fields).map(([field, value]) => ({ op: "set", path: [field], value }));
    if (ops.length === 0) return;
    this.fontSizes = Object.freeze(fontSizes);
    this.write(() => this.host.mutate(ops));
    this.publish();
  }

  /**
   * Đổi danh sách font của một vai trò — cửa ghi font DUY NHẤT (giá trị được chuẩn hoá trước khi ghi).
   * @param role - vai trò font.
   * @param value - danh sách tên font cách nhau bằng dấu phẩy; rỗng = trả về stack dựng sẵn.
   * @returns không.
   */
  setFontFamily(role: FontRole, value: string): void {
    const list = normalizeFontFamily(value);
    if (this.fontFamilies[role] === list) return;
    this.fontFamilies = Object.freeze({ ...this.fontFamilies, [role]: list });
    this.write(() => this.host.set(FONT_FAMILY_FIELDS[role], list));
    this.publish();
  }

  /**
   * Xếp một lượt ghi settings rồi adopt section bền vững khi không còn lượt ghi nào của mình.
   * @param operation - hàm thực hiện ghi.
   * @returns không.
   */
  write(operation: () => unknown): void {
    this.pendingWrites += 1;
    Promise.resolve(operation()).finally(() => {
      this.pendingWrites -= 1;
      this.adopt();
    });
  }

  /**
   * Nhận tuỳ chọn bền vững đã được scope chấp nhận mà KHÔNG ghi ngược lại.
   * @returns không.
   */
  adopt(): void {
    if (this.pendingWrites > 0) return;
    const section = this.host.getSnapshot().value;
    if (section === undefined) return;
    const fontFamilies = durableFontFamilies(section);
    const fontSizes = sectionFontSizes(section);
    if (
      this.preference === section.preference &&
      FONT_ROLES.every((role) => this.fontSizes[role] === fontSizes[role] && this.fontFamilies[role] === fontFamilies[role])
    ) {
      return;
    }
    this.preference = section.preference;
    this.fontSizes = fontSizes;
    this.fontFamilies = fontFamilies;
    this.publish();
  }

  /**
   * Đăng ký một theme; id trùng thì ném (một người ngồi mỗi id, cặp dựng sẵn cũng tính).
   * @param definition - id, colorScheme và token alias override.
   * @returns disposer; gỡ theme đang là tuỳ chọn ⇒ trả tuỳ chọn về mặc định.
   */
  register(definition: ThemeDefinition): () => void {
    if (definition.id === "system") throw new Error('"system" is a preference, not a registrable theme id');
    if (this.themes.some((theme) => theme.id === definition.id)) throw new Error('theme "' + definition.id + '" is already registered');
    this.themes.push(definition);
    this.publish();
    return () => {
      if (!this.themes.some((theme) => theme.id === definition.id)) return;
      const index = this.themes.findIndex((theme) => theme.id === definition.id);
      if (index >= 0) this.themes.splice(index, 1);
      if (this.preference === definition.id) this.preference = DEFAULT_PREFERENCE;
      this.publish();
    };
  }

  /**
   * Chong một layer override token lên theme đang active (base theme không đổi; layer xếp theo seq, layer sau thắng
   * từng token; gỡ layer trả lại giá trị bị che). Gọi lại cùng source = thay cả layer đó và xếp lại lên trên.
   * @param source - định danh layer (mỗi source một layer; gói động truyền id package).
   * @param tokens - tên token → cặp {light,dark}; giá trị chuỗi trần thì ném lỗi dạy học.
   * @returns disposer chỉ gỡ đúng layer này (no-op nếu source đã override lại).
   */
  overrideTokens(source: string, tokens: Record<string, TokenModes | unknown>): () => void {
    const layer = { seq: this.overrideSeq++, tokens: validateOverrides(source, tokens as Record<string, unknown>) };
    this.overrides.set(source, layer);
    this.publish();
    return () => {
      if (this.overrides.get(source) !== layer) return;
      this.overrides.delete(source);
      this.publish();
    };
  }

  /**
   * Dựng snapshot mới từ trạng thái hiện tại.
   * @returns snapshot đông cứng.
   */
  private buildSnapshot(): ThemeSnapshot {
    const resolvedId = this.preference === "system" ? (this.media?.matches === true ? "dark" : "light") : this.preference;
    const active = this.themes.find((theme) => theme.id === resolvedId);
    if (active === undefined) throw new Error('theme registry lost "' + resolvedId + '"');
    return Object.freeze({
      preference: this.preference,
      fontSizes: this.fontSizes,
      fontFamilies: this.fontFamilies,
      active: this.composeActive(active),
      themes: Object.freeze([...this.themes]),
      revision: this.revision,
    });
  }

  /**
   * Gộp các layer override vào theme active: theo seq, layer sau thắng từng token, mỗi giá trị chọn theo
   * chế độ màu của theme active. Không có layer thì trả nguyên định nghĩa đã đăng ký.
   * @param active - theme active đã đăng ký.
   * @returns theme đã gộp.
   */
  private composeActive(active: ThemeDefinition): ThemeDefinition {
    if (this.overrides.size === 0) return active;
    const tokens: Record<string, string> = { ...active.tokens };
    for (const layer of [...this.overrides.values()].sort((left, right) => left.seq - right.seq)) {
      for (const [name, modes] of Object.entries(layer.tokens)) tokens[name] = modes[active.colorScheme];
    }
    return Object.freeze({ ...active, tokens: Object.freeze(tokens) });
  }

  /**
   * Tăng revision, dựng snapshot mới rồi phát theme/change.
   * @returns không.
   */
  private publish(): void {
    this.revision += 1;
    this.snapshot = this.buildSnapshot();
    this.ctx.emit(THEME_CHANGE_EVENT, this.snapshot);
  }
}
