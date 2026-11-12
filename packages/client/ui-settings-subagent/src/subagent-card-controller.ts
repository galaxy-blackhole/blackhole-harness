/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Trinh bay va action dung chung cho hai khoi cai dat Subagent do Host so huu
 */
import type { SubagentLimitsCardFace, SubagentLimitsCardState } from "./subagent-limits-card-controller.ts";
import type { SubagentModelSelectionCardFace, SubagentModelSelectionCardState } from "./subagent-model-selection-card-controller.ts";

/** Vỏ trạng thái mà khung form dùng chung render. */
export interface SettingsFormShell {
  /** Có khối nào phục vụ được không. */
  readonly available: boolean;
  /** Mọi khối đều ghi được. */
  readonly writable: boolean;
  /** Có khối nào bẩn không. */
  readonly dirty: boolean;
  /** Có khối nào không hợp lệ (hoặc xung đột khi đang bẩn) không. */
  readonly invalid: boolean;
  /** Có khối nào đang lưu không. */
  readonly saving: boolean;
  /** Có khối nào lưu hỏng không. */
  readonly failed: boolean;
}

/** Cả hai nguồn form và các action mà MỘT thẻ Subagent phơi ra. */
export interface SubagentCardFace {
  /** Hook ảnh chụp của cả hai khối. */
  readonly hooks: Record<string, unknown>;
  /** Sửa một giới hạn. */
  readonly editLimit: SubagentLimitsCardFace["edit"];
  /** Trả một giới hạn về mặc định. */
  readonly resetLimit: SubagentLimitsCardFace["resetField"];
  /** Bật/tắt quyền chọn model. */
  readonly toggleEnabled: SubagentModelSelectionCardFace["toggleEnabled"];
  /** Chọn/bỏ một model. */
  readonly toggleModel: SubagentModelSelectionCardFace["toggleModel"];
  /** Nạp lại danh mục model. */
  readonly retryCatalog: SubagentModelSelectionCardFace["retryCatalog"];
  /** Lưu các bản nháp hợp lệ qua controller sở hữu namespace của chúng. */
  readonly save: () => void;
  /** Bỏ cả hai bản nháp mà không đụng cài đặt đã lưu. */
  readonly discard: () => void;
}

/**
 * Suy ra trạng thái dùng chung của thẻ mà KHÔNG nhân đôi đăng ký của hai form.
 * Nhận: form giới hạn hiện tại và form chọn model hiện tại.
 * Trả: mức phục vụ được và mức đã chốt trên các khối mà Host này phục vụ.
 */
export function subagentCardShell(limits: SubagentLimitsCardState, models: SubagentModelSelectionCardState): SettingsFormShell {
  const sections = [limits, models].filter((section) => section.available === true);
  return {
    available: sections.length > 0,
    writable: sections.every((section) => section.writable === true),
    dirty: sections.some((section) => section.dirty === true),
    invalid: sections.some((section) => section.invalid === true) || (models.available === true && models.dirty === true && models.conflicted === true),
    saving: sections.some((section) => section.saving === true),
    failed: sections.some((section) => section.failed === true),
  };
}

/**
 * Ghép MỘT thẻ từ hai form đã có; mỗi phép ghi vẫn giữ hàng rào revision của namespace nó.
 * Nhận: nguồn + action của form giới hạn, và của form chọn model.
 * Trả: nguồn đã ràng buộc theo framework và hai action lưu/bỏ dùng chung.
 */
export function subagentCardFace(limits: SubagentLimitsCardFace, models: SubagentModelSelectionCardFace): SubagentCardFace {
  const limitsSnapshot = () => (limits.hooks.subagentLimitsCard as { getSnapshot: () => SubagentLimitsCardState }).getSnapshot();
  const modelsSnapshot = () => (models.hooks.subagentModelSelectionCard as { getSnapshot: () => SubagentModelSelectionCardState }).getSnapshot();
  return {
    hooks: {
      ...limits.hooks,
      ...models.hooks,
    },
    editLimit: limits.edit,
    resetLimit: limits.resetField,
    toggleEnabled: models.toggleEnabled,
    toggleModel: models.toggleModel,
    retryCatalog: models.retryCatalog,
    /** Lưu cả hai khối nếu trạng thái chung cho phép; model trước, giới hạn sau. */
    save: () => {
      const limitState = limitsSnapshot();
      const modelState = modelsSnapshot();
      const state = subagentCardShell(limitState, modelState);
      if (!state.available || !state.writable || !state.dirty || state.invalid || state.saving) return;
      if (modelState.available === true && modelState.dirty === true) models.save();
      if (limitState.available === true && limitState.dirty === true) limits.save();
    },
    /** Bỏ cả hai bản nháp, trừ khi đang lưu. */
    discard: () => {
      if (subagentCardShell(limitsSnapshot(), modelsSnapshot()).saving) return;
      limits.discard();
      models.discard();
    },
  };
}
