/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cong chan rui ro cua the chon — nguyen van cay render va chu cua ban goc
 */

import type { PopupSelectController } from "../popup.ts";
import type { JsxRuntimeLike, PopupStateLike, PrimitivesLike, Translate } from "../types.ts";

/**
 * Dung ham ve hop xac nhan rui ro cua the chon.
 * Nhan: runtime — react/jsx-runtime; primitives — seam ui-primitives (lay RiskConfirmation).
 * Tra: ham ve (state, popup, t) -> node.
 */
export function createConfirmation(runtime: JsxRuntimeLike, primitives: PrimitivesLike): (state: PopupStateLike, popup: PopupSelectController<never>, t: Translate) => unknown {
  return (state: PopupStateLike, popup: PopupSelectController<never>, t: Translate): unknown => {
    const confirmation = state.confirming?.confirmation;
    if (confirmation === undefined) return undefined;
    return runtime.jsx(
      primitives.RiskConfirmation,
      {
        open: true,
        title: confirmation.title,
        description: confirmation.description,
        acknowledgeLabel: confirmation.acknowledgeLabel,
        cancelLabel: confirmation.cancelLabel,
        closeLabel: t("close"),
        confirmLabel: confirmation.confirmLabel,
        acknowledged: state.acknowledged,
        onAcknowledgedChange: (value: boolean): void => {
          popup.acknowledge(value);
        },
        onCancel: (): void => {
          popup.cancelConfirmation();
        },
        onConfirm: (): void => {
          void popup.confirm();
        },
      },
      undefined,
    );
  };
}
