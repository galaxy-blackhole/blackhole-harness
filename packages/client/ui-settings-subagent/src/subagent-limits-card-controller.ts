/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Controller cua form GIOI HAN uy nhiem: hai truong so doc lap cung mot form staged
 */
import type { FormModelLike, NumberFieldDescriptor, SettingsSection, SubagentPrimitives } from "./types.ts";

/** Ảnh chụp một trường số đã staged (do mô hình form phơi ra). */
export interface SubagentLimitFieldState {
  /** Giá trị đang gõ. */
  readonly value?: string;
  /** Có khác giá trị đã lưu không. */
  readonly overridden?: boolean;
  /** Có hợp lệ không. */
  readonly invalid?: boolean;
}

/** Giá trị hai giới hạn đã lưu. */
export interface SubagentLimitsSettings {
  /** Độ sâu đệ quy tối đa. */
  readonly maxDepth?: number;
  /** Số subagent song song tối đa. */
  readonly maxActiveSubagents?: number;
}

/** Ảnh chụp mà thẻ giới hạn phơi ra cho renderer. */
export interface SubagentLimitsCardState extends Record<string, unknown> {
  /** Có phục vụ được không. */
  readonly available?: boolean;
  /** Có ghi được không. */
  readonly writable?: boolean;
  /** Có thay đổi chưa lưu không. */
  readonly dirty?: boolean;
  /** Trường `maxDepth` đã staged. */
  readonly maxDepth?: SubagentLimitFieldState;
  /** Trường `maxActiveSubagents` đã staged. */
  readonly maxActiveSubagents?: SubagentLimitFieldState;
}

/** Mặt nghiệp vụ của thẻ giới hạn. */
export interface SubagentLimitsCardFace {
  /** Hook ảnh chụp + action của form. */
  readonly hooks: { readonly subagentLimitsCard: unknown };
  /** Sửa một trường theo văn bản người dùng. */
  readonly edit: (field: string, text: string) => void;
  /** Trả một trường về mặc định. */
  readonly resetField: (field: string) => void;
  /** Lưu các bản nháp hợp lệ. */
  readonly save: () => void;
  /** Bỏ mọi bản nháp. */
  readonly discard: () => void;
}

/**
 * Bọc một trường số với luật hợp lệ của trang.
 * Nhận: tên trường và giá trị nhỏ nhất hợp lệ.
 * Trả: descriptor trường số đã siết luật (số nguyên an toàn, ≥ minimum, không phải -0).
 */
export function limitField(primitives: SubagentPrimitives, field: string, minimum: number): NumberFieldDescriptor {
  const numeric = primitives.settingsNumberField(field);
  return {
    ...numeric,
    /**
     * Phân giải văn bản thành phép ghi, siết thêm luật của trang.
     * Nhận: văn bản người dùng gõ.
     * Trả: phép ghi hợp lệ, hoặc undefined khi không hợp lệ.
     */
    parse: (text: string) => {
      const write = numeric.parse(text);
      if (write?.kind !== "set") return write;
      const value = write.value as number;
      return Number.isSafeInteger(value) && value >= minimum && !Object.is(value, -0) ? write : undefined;
    },
  };
}

/** Ghép hai giới hạn độc lập có thể trả về mặc định vào MỘT form staged. */
export class SubagentLimitsCardController {
  /** Mô hình form của bộ nguyên thuỷ. */
  private readonly form: FormModelLike;

  /** Store theo dõi ảnh chụp form. */
  private readonly store: unknown;

  /**
   * Nhận: mục cài đặt `subagent` của Host và bộ nguyên thuỷ.
   * Trả: controller đã sẵn sàng `inject()`.
   */
  constructor(scope: SettingsSection<SubagentLimitsSettings>, primitives: SubagentPrimitives) {
    this.form = new primitives.SettingsFormModel(scope, [limitField(primitives, "maxDepth", 0), limitField(primitives, "maxActiveSubagents", 1)]);
    this.store = this.form.bind(() => ({
      ...this.form.shell(),
      maxDepth: this.form.field("maxDepth"),
      maxActiveSubagents: this.form.field("maxActiveSubagents"),
    }));
  }

  /**
   * Ghép ô giới hạn vào renderer.
   * Nhận: không có.
   * Trả: hook ảnh chụp và các action ghi đã staged.
   */
  inject(): SubagentLimitsCardFace {
    return {
      hooks: { subagentLimitsCard: this.store },
      ...(this.form.actions() as unknown as Omit<SubagentLimitsCardFace, "hooks">),
    };
  }

  /** Gỡ mọi đăng ký giá trị đã nhận. */
  dispose(): void {
    this.form.dispose();
  }
}
