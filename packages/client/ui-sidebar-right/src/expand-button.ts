/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nut mo rong thanh ben phai trong goc phien (ban goc: shell/ExpandButton.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/shell/ExpandButton.js
 */

import * as react_jsx_runtime from "react/jsx-runtime";
import * as _deepseek_ai_dsh_client_ui_primitives from "@galaxy-blackhole/gbh-client-ui-primitives";
import { EXPAND_BUTTON_CLASS } from "./css.ts";

/** The expand control while the panel is collapsed; nothing while it is shown. */
export function ExpandButton({ sessionId, useStore, actions, t, useShortcuts }: any) {
	const shortcut = useShortcuts((entries: any) => entries.find((entry: any) => entry.id === "sidebar.right.toggle"));
	if (useStore((state: any) => state.bySession[sessionId]?.layout.expanded ?? false)) return null;
	return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
		label: t("chrome.expand"),
		shortcutKeys: shortcut?.keys,
		side: "bottom",
		delayMs: 500,
		children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			className: EXPAND_BUTTON_CLASS.button,
			"aria-label": t("chrome.expandAria"),
			"aria-keyshortcuts": shortcut?.aria,
			"data-sidebar-right-expand": true,
			onClick: () => {
				actions.setExpanded(sessionId, true);
			},
			children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutlineRegular, { className: EXPAND_BUTTON_CLASS.icon })
		})
	});
}
