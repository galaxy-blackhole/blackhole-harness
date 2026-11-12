/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tieu de tab huong dan: bieu tuong la ban va chu cua tab (ban goc: tabs/guide/GuideTitle.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/tabs/guide/GuideTitle.js
 */

import * as react_jsx_runtime from "react/jsx-runtime";
import { GUIDE_BODY_CLASS } from "./css.ts";

/**
* The compass: a ring with the needle's rhombus pointing north-east, on
* `currentColor` so each rendering picks its own ink.
* @param props - rendered size and class.
* @returns the compass glyph.
*/
export function CompassGlyph({ size = 16, className }: any) {
	return (0, react_jsx_runtime.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		"aria-hidden": "true",
		className,
		children: [(0, react_jsx_runtime.jsx)("path", {
			d: "M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z",
			stroke: "currentColor"
		}), (0, react_jsx_runtime.jsx)("path", {
			d: "M10.6101 5.39014L8.99014 8.99014L5.39014 10.6101L7.01014 7.01014L10.6101 5.39014Z",
			fill: "currentColor"
		})]
	});
}
/**
* The cube: an isometric box — hexagonal silhouette, the top face's two edges,
* and the front seam — in straight strokes with softly rounded joins, on
* `currentColor`. The guide body draws it in a capsule whose type registered
* no glyph of its own.
* @param props - rendered size and class.
* @returns the cube glyph.
*/
export function CubeGlyph({ size = 16, className }: any) {
	return (0, react_jsx_runtime.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		"aria-hidden": "true",
		className,
		children: [(0, react_jsx_runtime.jsx)("path", {
			d: "M7.99998 2.5L12.9 5.2V10.8L7.99998 13.5L3.09998 10.8V5.2L7.99998 2.5Z",
			stroke: "currentColor",
			strokeLinejoin: "round"
		}), (0, react_jsx_runtime.jsx)("path", {
			d: "M3.09998 5.19995L7.99998 7.89995M7.99998 7.89995L12.9 5.19995M7.99998 7.89995V13.5",
			stroke: "currentColor",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})]
	});
}
/**
* The title as the chip and a floating panel's header show it.
* @param props - the tab information hook.
* @returns the compass followed by the tab's title text.
*/
export function GuideTitle({ useTabInfo }: any) {
	const { tab } = useTabInfo();
	return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(CompassGlyph, { className: GUIDE_BODY_CLASS.titleIcon }), tab.title] });
}
