/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nhan preset trong hang dau phien — chi doc, nguyen van cay render ban goc (AgentPresetLabel)
 */

import { LABEL_CLASS } from "./class-names.ts";
import { presetDisplayText } from "./display.ts";
import type { RosterSnapshot } from "./roster.ts";
import type { JsxRuntime, Primitives, ReactLike, Translator } from "./runtime.ts";

/** Mot dong phien ma nhan doc chieu cua no. */
export interface LabelSessionSummary {
  /** Gia tri chieu cua phien (agentPreset nam o day). */
  readonly projectionValues?: Readonly<Record<string, unknown>>;
}

/** Trang thai bang phien ma nhan doc — chi phan that su dung. */
export interface LabelSessionsState {
  /** Phien theo id. */
  readonly byId: Readonly<Record<string, LabelSessionSummary | undefined>>;
}

/** Props ma khung slot tiem vao nhan preset. */
export interface AgentPresetLabelProps {
  /** Id phien dang mo. */
  readonly sessionId: string;
  /** Hook chon tu bang phien. */
  readonly useSessions: <T>(selector: (state: LabelSessionsState) => T) => T;
  /** Hook chon tu store so preset. */
  readonly useAgentPresets: <T>(selector: (state: RosterSnapshot) => T) => T;
  /** Nap so preset (de co ban quyen hien thi). */
  readonly load: () => void;
  /** Ham dich cua namespace. */
  readonly t: Translator;
}

/** Phu thuoc ma nhan preset can — bang module da nap san. */
export interface LabelDeps {
  /** Runtime JSX. */
  readonly runtime: JsxRuntime;
  /** Hook React. */
  readonly react: ReactLike;
  /** Bo primitive. */
  readonly primitives: Primitives;
}

/**
 * Dung component nhan preset cua mot phien.
 * Nhan: deps — runtime JSX, hook React va bo primitive.
 * Tra: component nhan (props theo {@link AgentPresetLabelProps}).
 */
export function createAgentPresetLabel(deps: LabelDeps): (props: AgentPresetLabelProps) => unknown {
  const { jsx, jsxs } = deps.runtime;
  const { useEffect } = deps.react;
  const primitives = deps.primitives;

  /**
   * Ve ten preset cua phien nay canh tieu de cua no.
   *
   * Chi doc theo cau truc: thanh phan cua mot phien duoc chot ngay khi hoi thoai bat dau, va hang dau
   * chi dang doc sau do. Dat mot dieu khien o day la hua mot lan doi ma Host tu choi; noi ro phien dang
   * chay gi moi la cach trinh bay trung thuc, con lua chon nam o man hinh phien moi.
   * Nhan: props — props do slot soan ra.
   * Tra: nhan, hoac null khi phien khong ghi preset nao.
   */
  return function AgentPresetLabel(props: AgentPresetLabelProps): unknown {
    const { sessionId, useSessions, useAgentPresets, load, t } = props;
    const preset = useSessions((state) => {
      const value = state.byId[sessionId]?.projectionValues?.["agentPreset"];
      return typeof value === "string" ? value : undefined;
    });
    const options = useAgentPresets((state) => state.options);
    useEffect(() => {
      if (preset !== undefined) load();
    }, [preset, load]);
    if (preset === undefined) return null;
    const option = options.find((entry) => entry.id === preset);
    const text = option === undefined ? undefined : presetDisplayText(option, t);
    return jsxs(
      "span",
      {
        className: LABEL_CLASS.label,
        title: text?.description ?? t("headerHint"),
        children: [
          jsx(primitives.IconAgentPresetOutlineRegular, { size: 14, className: LABEL_CLASS.icon }),
          text?.name ?? preset,
        ],
      },
    );
  };
}
