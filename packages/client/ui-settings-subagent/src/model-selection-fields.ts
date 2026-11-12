/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc O chon model: cong tac mac dinh TAT + danh sach tuyen adapter chinh xac
 */
import type { CardPrimitives, CardReact } from "./card-types.ts";
import { MODELS_CLASS } from "./class-names.ts";
import type { SubagentModelSelectionCardState } from "./subagent-model-selection-card-controller.ts";
import type { ModelCandidate } from "./types.ts";

/** Props mà ô chọn model nhận. */
export interface SubagentModelSelectionFieldsProps {
  /** Đọc từ điển của trang. */
  t: (key: string) => string;
  /** Ảnh chụp thẻ + cờ dùng chung. */
  state: SubagentModelSelectionCardState & { readonly saving?: boolean };
  /** Bật/tắt quyền chọn model. */
  toggleEnabled: () => void;
  /** Chọn/bỏ một tuyến theo khoá. */
  toggleModel: (key: string) => void;
  /** Nạp lại danh mục. */
  retryCatalog: () => void;
}

/**
 * Dựng ô chọn model cho uỷ nhiệm subagent.
 * Nhận: React runtime và bộ nguyên thuỷ.
 * Trả: component `SubagentModelSelectionFields`.
 */
export function createModelSelectionFields(react: CardReact, primitives: CardPrimitives): (props: SubagentModelSelectionFieldsProps) => unknown {
  /**
   * Vẽ tuỳ chọn mặc định TẮT và đúng các lựa chọn tuyến adapter.
   * Nhận: copy từ điển, ảnh chụp thẻ và các action.
   * Trả: phần quyền chọn model và các lựa chọn tuyến trong thẻ dùng chung.
   */
  function SubagentModelSelectionFields(props: SubagentModelSelectionFieldsProps): unknown {
    const { t, state } = props;
    const availableGroups = new Map<string, { providerName: string; candidates: ModelCandidate[] }>();
    const unavailable: ModelCandidate[] = [];
    for (const candidate of state.candidates ?? []) {
      if (!candidate.available) {
        unavailable.push(candidate);
        continue;
      }
      const group = availableGroups.get(candidate.provider);
      if (group === undefined) {
        availableGroups.set(candidate.provider, { providerName: candidate.providerName, candidates: [candidate] });
      } else {
        group.candidates.push(candidate);
      }
    }
    /**
     * Vẽ một dòng ứng viên.
     * Nhận: ứng viên.
     * Trả: nhãn có checkbox, tên model, tuyến và nhãn "không dùng được" khi cần.
     */
    const renderCandidate = (candidate: ModelCandidate): unknown =>
      react.jsxs(
        "label",
        {
          className: MODELS_CLASS.model,
          children: [
            react.jsx("input", {
              type: "checkbox",
              checked: candidate.selected,
              disabled: state.writable !== true || state.saving === true,
              onChange: () => {
                props.toggleModel(candidate.key);
              },
            }),
            react.jsxs("span", {
              children: [
                react.jsx("span", { className: MODELS_CLASS.modelName, children: candidate.modelName }),
                react.jsx("span", {
                  className: MODELS_CLASS.route,
                  children: candidate.providerName + " · " + candidate.provider + "/" + candidate.model,
                }),
              ],
            }),
            candidate.available
              ? null
              : react.jsx("span", { className: MODELS_CLASS.unavailable, children: t("subagentModelSelectionUnavailable") }),
          ],
        },
        candidate.key,
      );
    return react.jsxs(react.Fragment, {
      children: [
        react.jsxs("div", {
          className: MODELS_CLASS.permission,
          children: [
            react.jsxs("div", {
              className: MODELS_CLASS.toggleRow,
              children: [
                react.jsx("span", { className: MODELS_CLASS.toggleLabel, children: t("subagentModelSelectionToggle") }),
                react.jsx(primitives.Switch, {
                  checked: state.enabled === true,
                  label: t("subagentModelSelectionToggle"),
                  disabled: state.writable !== true || state.saving === true,
                  onChange: props.toggleEnabled,
                }),
              ],
            }),
            react.jsx("p", {
              className: MODELS_CLASS.hint,
              children: t(state.enabled === true ? "subagentModelSelectionChoose" : "subagentModelSelectionOff"),
            }),
          ],
        }),
        state.enabled === true
          ? react.jsxs("div", {
              className: MODELS_CLASS.selection,
              children: [
                state.catalogStatus === "loading"
                  ? react.jsx("p", { className: MODELS_CLASS.notice, role: "status", children: t("subagentModelSelectionLoading") })
                  : null,
                state.catalogStatus === "error"
                  ? react.jsxs("div", {
                      className: MODELS_CLASS.catalogError,
                      role: "alert",
                      children: [
                        react.jsx("span", { children: t("subagentModelSelectionLoadFailed") }),
                        react.jsx("button", {
                          type: "button",
                          disabled: state.saving === true,
                          onClick: props.retryCatalog,
                          children: t("subagentModelSelectionRetry"),
                        }),
                      ],
                    })
                  : null,
                state.catalogPartial === true
                  ? react.jsx("p", { className: MODELS_CLASS.notice, children: t("subagentModelSelectionPartial") })
                  : null,
                (state.candidates ?? []).length > 0
                  ? react.jsxs("fieldset", {
                      className: MODELS_CLASS.models,
                      children: [
                        react.jsx("legend", { children: t("subagentModelSelectionAllowed") }),
                        [...availableGroups].map(([provider, group]) =>
                          react.jsxs(
                            "div",
                            {
                              className: MODELS_CLASS.modelGroup,
                              children: [
                                react.jsx("div", { className: MODELS_CLASS.providerName, children: group.providerName }),
                                group.candidates.map(renderCandidate),
                              ],
                            },
                            provider,
                          ),
                        ),
                        unavailable.length > 0
                          ? react.jsxs("div", {
                              className: MODELS_CLASS.modelGroup,
                              children: [
                                react.jsx("div", {
                                  className: MODELS_CLASS.providerName,
                                  children: t("subagentModelSelectionUnavailableGroup"),
                                }),
                                unavailable.map(renderCandidate),
                              ],
                            })
                          : null,
                      ],
                    })
                  : state.catalogStatus === "ready"
                    ? react.jsx("p", { className: MODELS_CLASS.notice, children: t("subagentModelSelectionEmpty") })
                    : null,
                state.invalid === true
                  ? react.jsx("p", { className: MODELS_CLASS.invalid, children: t("subagentModelSelectionRequired") })
                  : null,
              ],
            })
          : null,
        state.conflicted === true
          ? react.jsx("p", { className: MODELS_CLASS.conflict, role: "status", children: t("subagentModelSelectionConflict") })
          : null,
      ],
    });
  }

  return SubagentModelSelectionFields;
}
