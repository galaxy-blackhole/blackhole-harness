/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Kieu React/nguyen thuy ma ba component cua the Subagent dung
 */

/** Hàm dựng element của React runtime. */
export type JsxFn = (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;

/** Runtime JSX + hook mà ba component dùng. */
export interface CardReact {
  /** Dựng element một con. */
  jsx: JsxFn;
  /** Dựng element nhiều con. */
  jsxs: JsxFn;
  /** Bao nhiều con không cần node bọc. */
  Fragment: unknown;
  /** Id ổn định cho một lượt render (dùng cho aria-labelledby). */
  useId: () => string;
}

/** Bề mặt bộ nguyên thuỷ mà ba component dùng. */
export interface CardPrimitives {
  /** Ô giá trị trong form cài đặt. */
  SettingsValueField: unknown;
  /** Công tắc. */
  Switch: unknown;
  /** Khung form cài đặt dùng chung. */
  SettingsForm: unknown;
}
