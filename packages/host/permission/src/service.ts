/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Service preset quyền `ctx.permissionPresets`: bảng preset đã cấu hình, móc tích hợp Auto cố
 *      định, đường ghi qua đúng setter của từng núm, catalog tiến trình (Remote `catalog`), đơn vị
 *      chiếu `permissions`, lượt ghim quyền khởi tạo cho phiên, và lệnh `/permission`.
 */

import type { Context } from "@deepseek-ai/cordis";
import { CommandDefinitionId } from "@deepseek-ai/dsh-commands/brand";
import { SANDBOX_MODES, setSandboxMode } from "@deepseek-ai/dsh-sandbox-policy";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { APPROVAL_POLICIES, setApprovalPolicy } from "@deepseek-ai/dsh-user-approval";
import z from "@deepseek-ai/schemastery";
import { z as zod } from "zod/v4";
import {
  applyPermissionEvent,
  AUTO_PRESET,
  AUTO_PRESET_SPEC,
  CUSTOM_PRESET,
  DEFAULT_PRESETS,
  EMPTY_KNOBS,
  permissionStateSchema,
} from "./presets.ts";
import {
  seamsOf,
  type ApprovalPolicy,
  type CommandsSeam,
  type Config,
  type KnobState,
  type PermissionCatalog,
  type PermissionProjectionState,
  type PermissionSession,
  type PermissionSettings,
  type PresetOption,
  type PresetSpec,
  type SandboxMode,
  type SettingsSeam,
} from "./types.ts";

/** Kiểu `Session` của kernel, lấy qua chính setter mà gói gọi (không import gói seam nào). */
type KernelSession = Parameters<typeof setSandboxMode>[0];

/**
 * Ép một phiên của row về kiểu phiên của kernel — CHỈ ở tầng KIỂU; hình dạng lúc chạy mới là thứ
 * setter đọc.
 * Nhận: `session` — phiên theo hình dạng CẤU TRÚC của miền quyền.
 * Trả: cùng thể hiện ấy, mang kiểu `Session` của kernel.
 */
function asKernelSession(session: PermissionSession): KernelSession {
  return session as unknown as KernelSession;
}

/**
 * Sở hữu bảng preset quyền của deployment, móc tích hợp Auto cố định, và đường ghi của chúng.
 * Cần một executor `ctx.shell` CƯỠNG CHẾ và `ctx.approval`; tổ hợp núm không khớp preset nào được
 * báo là {@link CUSTOM_PRESET}, không phải lỗi.
 */
export class PermissionPresetService extends TypertRemoteService {
  /** Schema cấu hình (schemastery) — để Settings/config-editor của kernel render được từng trường. */
  static Config = z
    .object({
      presets: z
        .dict(
          z.object({
            sandbox: z.union(SANDBOX_MODES).required(),
            approval: z.union(APPROVAL_POLICIES).required(),
            name: z.string(),
            description: z.string(),
          }),
        )
        .default(DEFAULT_PRESETS),
      defaultPreset: z.string().volatile(),
    }) as unknown as z<Config>;

  /** Seam cần có: executor cưỡng chế, seam duyệt, sổ phiên, sổ chiếu phiên. */
  static inject = ["shell", "approval", "sessions", "sessionProjections"];

  /** Bảng preset của deployment — bất biến suốt vòng đời plugin (trừ khi Config được soạn lại). */
  readonly presets: Record<string, PresetSpec>;

  /** Cổng đồng ý của Auto đang sống; `undefined` nghĩa là Auto KHÔNG có mặt trong catalog. */
  autoAdmit: (() => void) | undefined;

  /** Phép đọc mặc định cho phiên mới — đọc tham chiếu Config SỐNG mỗi lượt. */
  defaultSettings!: () => PermissionSettings;

  /**
   * Đăng ký service `permissionPresets`: khai namespace thiết lập, kiểm bảng preset, ghim quyền cho
   * phiên đang sống, đăng ký chiếu `permissions`, và (khi có) lệnh `/permission`.
   * Nhận: context host và cấu hình đã qua schema.
   * Trả: thực thể đã đăng ký (bảng preset đã kiểm, mặc định đã giải).
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "permissionPresets");
    ctx.inject(["settings"], (child) => {
      const settings = (child as unknown as { settings: SettingsSeam }).settings;
      child.effect(() => settings.configure({ auto: false }, ctx.fiber));
    });
    this.presets = config.presets;
    if (CUSTOM_PRESET in this.presets) {
      throw new Error('permission: "custom" is reserved for the derived not-a-preset state and cannot name a table entry');
    }
    if (AUTO_PRESET in this.presets) {
      throw new Error('permission: "auto" is reserved and cannot name a configured preset');
    }
    if (seamsOf(ctx).shell.sandboxMode === undefined) {
      throw new Error(
        "permission: the mounted bash executor does not confine (no sandboxMode) — presets bundle a sandbox mode, so composing this plugin over an unconfined executor is a misconfiguration",
      );
    }
    const inferredDefault = this.derive(EMPTY_KNOBS);
    const defaultPreset = config.defaultPreset.get() ?? inferredDefault;
    if (defaultPreset === CUSTOM_PRESET) {
      throw new Error("permission: composed sandbox and approval defaults match no preset; configure defaultPreset explicitly");
    }
    this.resolve(defaultPreset);
    this.defaultSettings = () => {
      const liveDefault = config.defaultPreset.get() ?? inferredDefault;
      if (!Object.hasOwn(this.presets, liveDefault)) throw new Error(`permission: unknown default preset "${liveDefault}"`);
      return { defaultPreset: liveDefault };
    };
    const selectionSchema = zod.object({ currentValue: zod.string().min(1) });
    seamsOf(ctx).sessionProjections.register({
      key: "permissions",
      stateVersion: 2,
      stateSchema: permissionStateSchema,
      init: () => ({ ...EMPTY_KNOBS, seeded: false }),
      apply: applyPermissionEvent,
      wire: {
        viewSchema: selectionSchema,
        view: (state) => ({ currentValue: this.derive(state) }),
      },
    });
    seamsOf(ctx).on("session/created", (session) => {
      this.pinInitialPermission(session as PermissionSession);
    });
    for (const session of seamsOf(ctx).sessions.list()) this.pinInitialPermission(session);
    ctx.inject(["commands"], (commandCtx) => {
      const commands = (commandCtx as unknown as { commands: CommandsSeam }).commands;
      commands.register({
        definitionId: CommandDefinitionId("@deepseek-ai/dsh-permission-presets"),
        name: "permission",
        description: "Switch the permission preset (sandbox mode + approval policy)",
        input: { hint: "<preset>" },
        handler: ({ agent, rawInput }) => {
          const name = rawInput.trim();
          if (name === "") {
            return { kind: "success", text: `current preset ${this.current(agent.session)} (available: ${this.names.join(", ")})` };
          }
          if (!this.names.includes(name)) {
            return { kind: "error", text: `unknown preset "${name}" (available: ${this.names.join(", ")})` };
          }
          this.apply(agent.session, name, (policy) => {
            seamsOf(this.ctx).approval.setPolicy(agent, policy);
          });
          return { kind: "success", text: `preset ${name}` };
        },
      });
    });
  }

  /**
   * Tên preset được quảng cáo: các mục đã cấu hình theo thứ tự khai, rồi Auto khi tích hợp đang sống.
   * Nhận: không.
   * Trả: mọi tên preset chuyển được — mảng MỚI mỗi lượt đọc.
   */
  get names(): string[] {
    return [...Object.keys(this.presets), ...(this.autoAdmit === undefined ? [] : [AUTO_PRESET])];
  }

  /**
   * Đọc catalog đầy đủ cấp tiến trình mà UI của phiên hiện tại thấy.
   * Nhận: không.
   * Trả: mọi preset chọn được ngay lúc này, theo thứ tự đóng góp.
   */
  @Remote("catalog")
  catalog(): PermissionCatalog {
    return {
      options: this.names.map((name) => this.optionOf(name)),
      defaultOptions: Object.keys(this.presets).map((name) => this.optionOf(name)),
      defaultPreset: this.defaultSettings().defaultPreset,
    };
  }

  /**
   * Công bố preset Auto cố định cho phiên hiện tại, sống theo vòng đời effect của tích hợp gọi nó.
   * Nhận: `admit` — cổng đồng bộ chạy trước khi chọn/khôi phục Auto đang sống.
   * Trả: hàm dọn bất đồng bộ gỡ Auto khỏi catalog.
   */
  registerAuto(admit: () => void): () => Promise<void> {
    return this.ctx.effect(() => {
      if (this.autoAdmit !== undefined) throw new Error('permission: preset "auto" is already registered');
      this.autoAdmit = admit;
      this.emitCatalogChanged();
      return () => {
        this.autoAdmit = undefined;
        this.emitCatalogChanged();
      };
    }, "permissionPresets.registerAuto()") as unknown as () => Promise<void>;
  }

  /**
   * Preset đang được chọn làm mặc định cho các phiên tương lai.
   * Nhận: không.
   * Trả: giá trị thiết lập đã giải, hoặc mặc định thành phần khi chưa mount provider thiết lập.
   */
  get defaultPreset(): string {
    return this.defaultSettings().defaultPreset;
  }

  /**
   * Đọc trạng thái chiếu `permissions` của một phiên.
   * Nhận: `session` — phiên cần đọc.
   * Trả: trạng thái đã gộp; NÉM khi đơn vị chiếu chưa đăng ký (không trả rỗng).
   */
  private permissionState(session: PermissionSession): PermissionProjectionState {
    const state = seamsOf(this.ctx).sessionProjections.stateOf(session, "permissions");
    if (state === undefined) throw new Error("permission: permissions session projection is not registered");
    return state;
  }

  /**
   * Giải preset khớp giá trị núm hiệu lực. Lựa chọn cuối còn khớp thắng thế khi hai preset dùng
   * chung một bộ, một Auto còn được chọn cũng khớp chính sách `never`; ngoài ra mục cấu hình khớp
   * ĐẦU TIÊN thắng.
   * Nhận: `session` — phiên cần đọc trạng thái núm.
   * Trả: tên preset hiệu lực, hoặc {@link CUSTOM_PRESET} khi không preset nào khớp.
   */
  current(session: PermissionSession): string {
    return this.derive(this.permissionState(session));
  }

  /**
   * Giải preset cho MỘT trạng thái núm đã gộp (phép toán dùng chung của `current` và đơn vị chiếu).
   * Nhận: `state` — trạng thái núm (có thể là {@link EMPTY_KNOBS}).
   * Trả: tên preset hiệu lực, hoặc `custom`.
   */
  private derive(state: KnobState): string {
    const sandbox = state.sandbox ?? seamsOf(this.ctx).shell.sandboxMode;
    const approval = state.approval ?? seamsOf(this.ctx).approval.config.policy ?? "ask";
    const matches = (spec: PresetSpec): boolean => spec.sandbox === sandbox && spec.approval === approval;
    if (state.preset !== null) {
      const spec = this.specOf(state.preset);
      if (spec !== undefined && matches(spec)) return state.preset;
      if (state.preset === AUTO_PRESET && spec?.sandbox === sandbox && approval === "never") return AUTO_PRESET;
    }
    for (const [name, spec] of Object.entries(this.presets)) if (matches(spec)) return name;
    return CUSTOM_PRESET;
  }

  /**
   * Giải bộ hai núm của một preset chọn được.
   * Nhận: `name` — tên preset cần giải.
   * Trả: bộ đã cấu hình.
   * Ném khi `name` không được cấu hình và cũng không phải Auto đang sống.
   */
  resolve(name: string): PresetSpec {
    const spec = this.specOf(name);
    if (spec === undefined) throw new Error(`permission: unknown preset "${name}" (known: ${this.names.join(", ")})`);
    return spec;
  }

  /**
   * Dựng lựa chọn cho client từ một preset chọn được hoặc {@link CUSTOM_PRESET}.
   * Nhãn thiếu thì rơi về chính khoá preset.
   * Nhận: `name` — khoá đã cấu hình, `auto` đang sống, hoặc `custom`.
   * Trả: lựa chọn mà client vẽ.
   * Ném khi `name` không thuộc ba loại trên.
   */
  optionOf(name: string): PresetOption {
    if (name === CUSTOM_PRESET) {
      return {
        value: CUSTOM_PRESET,
        name: "Custom",
        description: "Current sandbox and approval settings do not match a preset.",
      };
    }
    const spec = this.resolve(name);
    return {
      value: name,
      name: spec.name ?? name,
      ...(spec.description !== undefined ? { description: spec.description } : {}),
    };
  }

  /**
   * Ghi một preset đã đổi, rồi cập nhật từng núm đã đổi qua CHÍNH setter của nó. Chọn lại đúng preset
   * đang hiệu lực thì không ghi gì.
   * Nhận: `session` — phiên thuộc lần chuyển; `name` — preset cần chuyển (tên lạ thì ném).
   * Trả: không.
   */
  set(session: PermissionSession, name: string): void {
    this.apply(session, name, (policy) => {
      setApprovalPolicy(asKernelSession(session), policy);
    });
  }

  /**
   * Áp một preset qua danh tính bền của nó và các setter chuẩn tắc của hai núm.
   * Nhận: `session` — phiên nhận chuyển; `name` — preset; `setApproval` — đường ghi chính sách duyệt.
   * Trả: không.
   */
  private apply(session: PermissionSession, name: string, setApproval: (policy: ApprovalPolicy) => void): void {
    const spec = this.resolve(name);
    if (name === AUTO_PRESET) this.autoAdmit?.();
    const current = this.current(session);
    const knobs = this.permissionState(session);
    const updateKnobs = (): void => {
      if (spec.sandbox !== (knobs.sandbox ?? seamsOf(this.ctx).shell.sandboxMode)) {
        setSandboxMode(asKernelSession(session), spec.sandbox);
      }
      if (spec.approval !== (knobs.approval ?? seamsOf(this.ctx).approval.config.policy ?? "ask")) setApproval(spec.approval);
    };
    if (current !== name) session.append("permission/preset", { preset: name });
    updateKnobs();
  }

  /**
   * Điền MỌI dữ kiện quyền còn thiếu trước khi một phiên được công bố. Phiên TƯƠI dùng mặc định
   * người dùng hiện tại; phiên đã gieo hạt hoặc mới khởi tạo một phần GIỮ giá trị núm hiệu lực và chỉ
   * nhận thêm dữ kiện bền còn thiếu. Một danh tính Auto đã lưu đòi tích hợp đang sống và phải qua
   * cổng đồng ý trước khi công bố.
   * Nhận: `session` — phiên cần ghim.
   * Trả: không.
   */
  private pinInitialPermission(session: PermissionSession): void {
    const state = this.permissionState(session);
    const { preset, sandbox, approval, seeded } = state;
    if (preset === AUTO_PRESET) {
      if (this.autoAdmit === undefined) throw new Error('permission: cannot restore preset "auto" without its active integration');
      this.autoAdmit();
    }
    if (preset === null && sandbox === null && approval === null && !seeded) {
      const name = this.defaultPreset;
      const spec = this.resolve(name);
      session.append("permission/preset", { preset: name });
      setSandboxMode(asKernelSession(session), spec.sandbox);
      setApprovalPolicy(asKernelSession(session), spec.approval);
      return;
    }
    const effective = this.derive(state);
    if (preset === null && effective !== CUSTOM_PRESET) session.append("permission/preset", { preset: effective });
    if (sandbox === null) setSandboxMode(asKernelSession(session), seamsOf(this.ctx).shell.sandboxMode as SandboxMode);
    if (approval === null) setApprovalPolicy(asKernelSession(session), seamsOf(this.ctx).approval.config.policy ?? "ask");
  }

  /**
   * Phát một thông báo làm mới catalog KHÔNG payload và KHÔNG phủ quyết.
   * Nhận: không.
   * Trả: không — người nghe ném hay trả promise reject đều chỉ bị ghi cảnh báo.
   */
  private emitCatalogChanged(): void {
    for (const listener of seamsOf(this.ctx).events.dispatch("emit", ["permission-presets/catalog-changed"])) {
      try {
        const returned = listener();
        if (returned != null && typeof (returned as PromiseLike<unknown>).then === "function") {
          Promise.resolve(returned).catch((error: unknown) => {
            seamsOf(this.ctx).logger.warn(
              `permission: catalog-changed listener failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
        }
      } catch (error) {
        seamsOf(this.ctx).logger.warn(
          `permission: catalog-changed listener failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Giải một preset đã cấu hình hoặc preset cố định đang sống, KHÔNG ném.
   * Nhận: `name` — tên cần tra.
   * Trả: bộ hai núm, hoặc `undefined` khi không có.
   */
  private specOf(name: string): PresetSpec | undefined {
    return this.presets[name] ?? (name === AUTO_PRESET && this.autoAdmit !== undefined ? AUTO_PRESET_SPEC : undefined);
  }
}

export default PermissionPresetService;
