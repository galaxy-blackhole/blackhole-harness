/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hai o gioi han (do sau · song song) voi dung kiem tra va hanh vi tra mac dinh ban goc
 */
import { LIMITS_CLASS } from "./class-names.ts";
import type { CardPrimitives, CardReact } from "./card-types.ts";
import type { SubagentLimitFieldState } from "./subagent-limits-card-controller.ts";

/** Props mà hai ô giới hạn nhận. */
export interface SubagentLimitsFieldsProps {
  /** Đọc từ điển của trang. */
  t: (key: string) => string;
  /** Ảnh chụp hai trường đã staged + cờ dùng chung. */
  state: {
    /** Có ghi được không. */
    readonly writable?: boolean;
    /** Đang lưu (từ vỏ dùng chung). */
    readonly saving?: boolean;
    /** Trường độ sâu. */
    readonly maxDepth?: SubagentLimitFieldState;
    /** Trường số song song. */
    readonly maxActiveSubagents?: SubagentLimitFieldState;
  };
  /** Sửa một trường. */
  edit: (field: string, text: string) => void;
  /** Trả một trường về mặc định. */
  resetField: (field: string) => void;
}

/**
 * Dựng hai ô giới hạn uỷ nhiệm.
 * Nhận: React runtime và bộ nguyên thuỷ.
 * Trả: component `SubagentLimitsFields`.
 */
export function createLimitsFields(react: CardReact, primitives: CardPrimitives): (props: SubagentLimitsFieldsProps) => unknown {
  /**
   * Vẽ hai ô với đúng luật kiểm tra và hành vi trả mặc định ban đầu.
   * Nhận: từ điển, hai trường đã staged và hai callback sửa/trả mặc định.
   * Trả: hai ô co giãn kèm luật áp dụng.
   */
  function SubagentLimitsFields(props: SubagentLimitsFieldsProps): unknown {
    const { t, state } = props;
    return react.jsx(react.Fragment, {
      children: react.jsxs("div", {
        className: LIMITS_CLASS.limits,
        children: [
          react.jsx("div", {
            className: LIMITS_CLASS.limit,
            children: react.jsx(primitives.SettingsValueField, {
              id: "plugin-config-subagent-depth",
              label: t("subagentMaxDepth"),
              help: {
                label: t("subagentDepthHelpLabel"),
                content: react.jsxs(react.Fragment, {
                  children: [
                    react.jsx("p", { children: t("subagentDepthHelp") }),
                    react.jsx("table", {
                      className: LIMITS_CLASS.depthTable,
                      "aria-label": t("subagentDepthHelpLabel"),
                      children: react.jsxs("tbody", {
                        children: [
                          react.jsxs("tr", {
                            children: [
                              react.jsx("th", { scope: "row", children: 0 }),
                              react.jsx("td", { children: t("subagentDepthZero") }),
                            ],
                          }),
                          react.jsxs("tr", {
                            children: [
                              react.jsx("th", { scope: "row", children: 1 }),
                              react.jsx("td", { children: t("subagentDepthOne") }),
                            ],
                          }),
                        ],
                      }),
                    }),
                    react.jsx("p", { children: t("subagentDepthOverride") }),
                  ],
                }),
              },
              overriddenLabel: t("overridden"),
              resetLabel: t("reset"),
              invalidLabel: t("subagentDepthInvalid"),
              numeric: true,
              disabled: state.writable !== true || state.saving === true,
              ...(state.maxDepth ?? {}),
              onEdit: (text: string) => {
                props.edit("maxDepth", text);
              },
              onReset: () => {
                props.resetField("maxDepth");
              },
            }),
          }),
          react.jsx("div", {
            className: LIMITS_CLASS.limit,
            children: react.jsx(primitives.SettingsValueField, {
              id: "plugin-config-subagent-capacity",
              label: t("subagentMaxActive"),
              help: {
                label: t("subagentCapacityHelpLabel"),
                content: react.jsx("p", { children: t("subagentCapacityHelp") }),
              },
              overriddenLabel: t("overridden"),
              resetLabel: t("reset"),
              invalidLabel: t("subagentCapacityInvalid"),
              numeric: true,
              disabled: state.writable !== true || state.saving === true,
              ...(state.maxActiveSubagents ?? {}),
              onEdit: (text: string) => {
                props.edit("maxActiveSubagents", text);
              },
              onReset: () => {
                props.resetField("maxActiveSubagents");
              },
            }),
          }),
        ],
      }),
    });
  }

  return SubagentLimitsFields;
}
