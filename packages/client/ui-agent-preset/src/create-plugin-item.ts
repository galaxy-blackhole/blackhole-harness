/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Muc "de agent tao plugin" trong menu them plugin — nguyen van cay render ban goc
 */

import { CREATE_PLUGIN_ITEM_CLASS } from "./class-names.ts";
import { CREATOR_PRESET_ID } from "./ids.ts";
import type { RosterSnapshot } from "./roster.ts";
import type { JsxRuntime, Primitives, ReactLike, Translator } from "./runtime.ts";

/** Props ma slot plugins.add.actions tiem vao muc tao plugin. */
export interface CreatePluginMenuItemProps {
  /** Ham dich cua namespace. */
  readonly t: Translator;
  /** Hook chon tu store so preset. */
  readonly useAgentPresets: <T>(selector: (state: RosterSnapshot) => T) => T;
  /** Nap so preset. */
  readonly load: () => void;
  /** Dong menu them plugin. */
  readonly onDismiss: () => void;
  /** Mo Creator ma khong gui tin nhan nao. */
  readonly startCreatorDraft: () => void;
}

/** Phu thuoc ma muc tao plugin can. */
export interface CreatePluginItemDeps {
  /** Runtime JSX. */
  readonly runtime: JsxRuntime;
  /** Hook React. */
  readonly react: ReactLike;
  /** Bo primitive. */
  readonly primitives: Primitives;
}

/**
 * Dung component muc "de agent tao plugin".
 * Nhan: deps — runtime JSX, hook React va bo primitive.
 * Tra: component muc menu (props theo {@link CreatePluginMenuItemProps}).
 */
export function createCreatePluginMenuItem(deps: CreatePluginItemDeps): (props: CreatePluginMenuItemProps) => unknown {
  const { jsx, jsxs } = deps.runtime;
  const { useEffect } = deps.react;
  const primitives = deps.primitives;

  /**
   * Dong menu them plugin truoc khi mo Creator ma khong gui tin nhan nao.
   * Nhan: props — tu dien, so preset, ham dong menu va ham mo Creator.
   * Tra: muc menu on dinh, noi ro vi sao Creator khong dung duoc.
   */
  return function CreatePluginMenuItem(props: CreatePluginMenuItemProps): unknown {
    const { t, useAgentPresets, load, onDismiss, startCreatorDraft } = props;
    const roster = useAgentPresets((state) => state);
    const enabled = roster.status === "ready" && roster.options.some((option) => option.id === CREATOR_PRESET_ID);
    useEffect(() => {
      load();
    }, [load]);
    let description: string = t("createPluginDescription");
    if (roster.status === "idle" || roster.status === "loading") description = t("createPluginChecking");
    else if (roster.status === "error" || roster.status === "unavailable") description = t("createPluginUnavailable");
    else if (!enabled) description = t("createPluginMissing");
    return jsx(primitives.MenuItemButton, {
      icon: jsx(primitives.IconAgentPresetOutlineRegular, { size: 14 }),
      disabled: !enabled,
      onSelect: () => {
        onDismiss();
        startCreatorDraft();
      },
      children: jsxs("span", {
        className: CREATE_PLUGIN_ITEM_CLASS.copy,
        children: [
          jsx("span", { children: t("createPlugin") }),
          jsx("span", { className: CREATE_PLUGIN_ITEM_CLASS.description, title: description, children: description }),
        ],
      }),
    });
  };
}
