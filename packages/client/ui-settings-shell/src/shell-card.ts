/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Thẻ của trang cài đặt shell executor: một dòng mô tả (view summary) hoặc form hai trường số
 */

import { type SettingsFormLabelsLike, type ShellSettingsLocaleKey, formLabels } from "./locales.ts";

/** Trạng thái trang renderer bơm vào thẻ này (khớp ShellCardState của bản gốc). */
export interface ShellCardStateLike extends Record<string, unknown> {
  /** Bản cài đặt có cho ghi cấu hình không. */
  writable: boolean;
  /** Trạng thái trường thời gian chạy tối đa. */
  timeoutMs: Record<string, unknown>;
  /** Trạng thái trường trần dung lượng mỗi luồng. */
  maxOutputBytes: Record<string, unknown>;
}

/** Props renderer bơm cho thẻ này (khớp ShellCardProps của bản gốc). */
export interface ShellCardPropsLike {
  /** View mà trang Plugins hỏi: summary là một dòng, còn lại là form. */
  view?: string;
  /** Hàm đọc từ điển của trang (đã bind namespace settings.shell). */
  t: (key: ShellSettingsLocaleKey) => string;
  /** Hook đọc ảnh chụp form do mặt inject cấp. */
  useShellCard: <T>(selector: (snapshot: ShellCardStateLike) => T) => T;
  /** Gửi giá trị đang soạn lên Host. */
  save: () => unknown;
  /** Bỏ thay đổi đang soạn. */
  discard: () => unknown;
  /** Sửa một trường theo chữ người dùng gõ. */
  edit: (field: string, text: string) => void;
  /** Trả một trường về mặc định của Host. */
  resetField: (field: string) => void;
}

/** Hai hàm dựng phần tử của jsx runtime (khớp react/jsx-runtime). */
export interface JsxRuntimeLike {
  /** Một phần tử con. */
  jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Nhiều phần tử con. */
  jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
}

/** Hai primitive của ui-primitives mà thẻ này dùng. */
export interface CardPrimitivesLike {
  /** Khung form cài đặt dùng chung. */
  SettingsForm: unknown;
  /** Một trường giá trị của khung form đó. */
  SettingsValueField: unknown;
}

/**
 * Dựng hàm render thẻ shell executor từ các module do bảng module cấp.
 * Nhận: jsx runtime (React) và hai primitive SettingsForm/SettingsValueField.
 * Trả: hàm render nhận props của renderer — trả về một dòng mô tả khi view là summary, còn lại trả form hai trường số.
 */
export function createShellCard(runtime: JsxRuntimeLike, primitives: CardPrimitivesLike): (props: ShellCardPropsLike) => unknown {
  const { jsx, jsxs } = runtime;
  const { SettingsForm, SettingsValueField } = primitives;
  const field = (props: Record<string, unknown>): unknown => jsx(SettingsValueField, props);
  return (props: ShellCardPropsLike): unknown => {
    const { t } = props;
    const state = props.useShellCard((snapshot) => snapshot);
    if (props.view === "summary") return t("description");
    const disabled = !state.writable;
    const labels: SettingsFormLabelsLike = formLabels(t);
    return jsxs(SettingsForm, {
      labels,
      state,
      onSave: props.save,
      onDiscard: props.discard,
      children: [
        field({
          id: "plugin-config-shell-timeout",
          label: t("timeoutMs"),
          hint: t("timeoutMsHint"),
          overriddenLabel: t("overridden"),
          resetLabel: t("reset"),
          invalidLabel: t("invalidNumber"),
          numeric: true,
          disabled,
          ...state.timeoutMs,
          onEdit: (text: string) => props.edit("timeoutMs", text),
          onReset: () => props.resetField("timeoutMs"),
        }),
        field({
          id: "plugin-config-shell-output",
          label: t("maxOutputBytes"),
          hint: t("maxOutputBytesHint"),
          overriddenLabel: t("overridden"),
          resetLabel: t("reset"),
          invalidLabel: t("invalidNumber"),
          numeric: true,
          disabled,
          ...state.maxOutputBytes,
          onEdit: (text: string) => props.edit("maxOutputBytes", text),
          onReset: () => props.resetField("maxOutputBytes"),
        }),
      ],
    });
  };
}
