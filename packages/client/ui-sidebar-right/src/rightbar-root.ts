/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Goc slot rightbar: giu mot khung nhin phien cho moi phien (ban goc: shell/RightbarRoot.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/shell/RightbarRoot.js
 */

import * as react_jsx_runtime from "react/jsx-runtime";
import * as react from "react";
import { SIDEBAR_RIGHT_CLASS } from "./css.ts";

/** Root-scoped controller for the right Sidebar's Session content. */
function SessionView({ view, visible, SessionProvider, renderSlot, mountView, width, viewportWidth, canShow }: any) {
	(0, react.useLayoutEffect)(() => mountView(view.reference), [mountView, view.reference]);
	const active = visible && view.selected;
	return (0, react_jsx_runtime.jsx)("div", {
		className: SIDEBAR_RIGHT_CLASS.session,
		hidden: !active,
		"data-sidebar-right-session": view.sessionId,
		children: (0, react_jsx_runtime.jsx)(SessionProvider, {
			session: view.reference,
			children: renderSlot("rightbar.session", {
				width,
				viewportWidth,
				canShow,
				active,
				retainTab: view.retainTab
			})
		})
	});
}
/**
* Keep independent Session subtrees and hide those outside the selected Conversation.
* @param props - frame geometry, view targets and the authorized Session renderer.
* @returns the foreground and retained background Sidebars.
*/
export function RightbarRoot({ usePanelInfo, useViews, ...props }: any) {
	const visible = usePanelInfo((info: any) => info.activePanelId === null);
	return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: useViews((value: any) => value).map((view: any) => (0, react_jsx_runtime.jsx)(SessionView, {
		...props,
		view,
		visible
	}, view.sessionId)) });
}
