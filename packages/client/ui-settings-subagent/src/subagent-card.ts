/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc The cai dat Subagent: mot trang cau hinh voi mot nut luu cho ca hai khoi
 */
import type { CardPrimitives, CardReact } from "./card-types.ts";
import { CARD_CLASS } from "./class-names.ts";
import { formLabels } from "./locales.ts";
import { subagentCardShell } from "./subagent-card-controller.ts";
import type { SubagentLimitsFieldsProps } from "./limits-fields.ts";
import type { SubagentLimitsCardState } from "./subagent-limits-card-controller.ts";
import type { SubagentModelSelectionFieldsProps } from "./model-selection-fields.ts";
import type { SubagentModelSelectionCardState } from "./subagent-model-selection-card-controller.ts";

/** Props mà thẻ Subagent nhận từ renderer. */
export interface SubagentCardProps {
  /** Chế độ hiển thị của renderer (`summary` khi chỉ cần một dòng tóm tắt). */
  readonly view?: string;
  /** Đọc từ điển của trang. */
  t: (key: string) => string;
  /** Hook ảnh chụp thẻ giới hạn. */
  useSubagentLimitsCard: (select: (snapshot: SubagentLimitsCardState) => SubagentLimitsCardState) => SubagentLimitsCardState;
  /** Hook ảnh chụp thẻ chọn model. */
  useSubagentModelSelectionCard: (
    select: (snapshot: SubagentModelSelectionCardState) => SubagentModelSelectionCardState,
  ) => SubagentModelSelectionCardState;
  /** Sửa một giới hạn. */
  editLimit: SubagentLimitsFieldsProps["edit"];
  /** Trả một giới hạn về mặc định. */
  resetLimit: SubagentLimitsFieldsProps["resetField"];
  /** Bật/tắt quyền chọn model. */
  toggleEnabled: SubagentModelSelectionFieldsProps["toggleEnabled"];
  /** Chọn/bỏ một model. */
  toggleModel: SubagentModelSelectionFieldsProps["toggleModel"];
  /** Nạp lại danh mục. */
  retryCatalog: SubagentModelSelectionFieldsProps["retryCatalog"];
  /** Lưu cả hai khối. */
  save: () => void;
  /** Bỏ cả hai bản nháp. */
  discard: () => void;
}

/** Phụ thuộc để dựng thẻ. */
export interface SubagentCardDeps {
  /** React runtime. */
  react: CardReact;
  /** Bộ nguyên thuỷ. */
  primitives: CardPrimitives;
  /** Component hai ô giới hạn. */
  LimitsFields: (props: SubagentLimitsFieldsProps) => unknown;
  /** Component ô chọn model. */
  ModelSelectionFields: (props: SubagentModelSelectionFieldsProps) => unknown;
}

/**
 * Dựng thẻ cài đặt Subagent.
 * Nhận: React runtime, bộ nguyên thuỷ và hai component khối.
 * Trả: component `SubagentCard`.
 */
export function createSubagentCard(deps: SubagentCardDeps): (props: SubagentCardProps) => unknown {
  const { react, primitives } = deps;

  /**
   * Vẽ các cài đặt Subagent đang phục vụ được, một trang cấu hình và một chân lưu.
   * Nhận: từ điển, hai ảnh chụp form và các action dùng chung.
   * Trả: dòng tóm tắt, hoặc form cài đặt đang phục vụ.
   */
  function SubagentCard(props: SubagentCardProps): unknown {
    const { t } = props;
    const limits = props.useSubagentLimitsCard((snapshot) => snapshot);
    const models = props.useSubagentModelSelectionCard((snapshot) => snapshot);
    const headingId = react.useId();
    if (props.view === "summary") return t("subagentDescription");
    const state = subagentCardShell(limits, models);
    return react.jsxs(
      primitives.SettingsForm,
      {
        labels: formLabels(t),
        state,
        onSave: props.save,
        onDiscard: props.discard,
        children: [
          limits.available === true
            ? react.jsxs("section", {
                className: CARD_CLASS.section,
                "aria-labelledby": headingId + "-limits",
                children: [
                  react.jsx("h3", { className: CARD_CLASS.heading, id: headingId + "-limits", children: t("subagentLimitsTitle") }),
                  react.jsx(deps.LimitsFields, {
                    t,
                    state: { ...limits, saving: state.saving },
                    edit: props.editLimit,
                    resetField: props.resetLimit,
                  }),
                ],
              })
            : null,
          models.available === true
            ? react.jsxs("section", {
                className: CARD_CLASS.section,
                "aria-labelledby": headingId + "-models",
                children: [
                  react.jsx("h3", {
                    className: CARD_CLASS.heading,
                    id: headingId + "-models",
                    children: t("subagentModelSelectionTitle"),
                  }),
                  react.jsx(deps.ModelSelectionFields, {
                    t,
                    state: { ...models, saving: state.saving },
                    toggleEnabled: props.toggleEnabled,
                    toggleModel: props.toggleModel,
                    retryCatalog: props.retryCatalog,
                  }),
                ],
              })
            : null,
        ],
      },
    );
  }

  return SubagentCard;
}
