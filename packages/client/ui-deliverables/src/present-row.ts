/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang cua lan goi tool present — NGUYEN VAN ban goc (PresentRow)
 */
import { type Any, fragment, jsx, jsxs, primitive, useId, useEffect, useMemo, useRef, useState } from "./runtime.ts";
import { PresentRowCss } from "./class-names.ts";

/** Present call status and expandable durable result text. */
/* v8 ignore next -- Non-expandable rows never invoke DisclosureRow's required toggle callback. */
const noop = () => undefined;
/** Raw arguments can be partial while a call is streaming. */
function fileNames(raw: Any) {
	let args;
	try {
		args = JSON.parse(raw);
	} catch {
		return raw;
	}
	if (typeof args !== "object" || args === null || !("files" in args) || !Array.isArray(args.files)) return raw;
	return args.files.flatMap((file: Any) => typeof file === "object" && file !== null && "path" in file && typeof file.path === "string" ? [file.path] : []).join(", ");
}
/**
* Render a present call using its recorded arguments and result.
* @param props - tool call and localized status copy.
* @returns a status row with a result disclosure.
*/
export function PresentRow(props: Any) {
	return props.phase === "preparing" ? jsx(PreparingPresentRow, { ...props }) : jsx(StartedPresentRow, { ...props });
}
function PreparingPresentRow({ t }: Any) {
	return jsx("div", {
		"data-tool": "present",
		"data-state": "preparing",
		"aria-label": t("row.preparing"),
		children: jsx(primitive("DisclosureRow"), {
			title: t("row.title"),
			icon: jsx(primitive("IconDeliverDocRegular"), { size: 14 }),
			open: false,
			expandable: false,
			onToggle: noop,
			running: true
		})
	});
}
function StartedPresentRow({ block, inspect, t }: Any) {
	const settled = "kind" in block;
	const state = !settled ? "running" : block.error?.code === "interrupted" ? "stopped" : block.isError ? "error" : "ok";
	const args = (settled ? block.call?.argsRaw : block.argsRaw) ?? "";
	const details = (settled ? block.content.map((item: Any) => item.type === "text" ? item.text : JSON.stringify(item)).join("\n") : "") || (settled && block.error ? `${block.error.name}: ${block.error.code}` : "");
	const [expanded, setExpanded] = useState(false);
	return jsx("div", {
		"data-tool": "present",
		"data-state": state,
		children: jsxs(primitive("DisclosureRow"), {
			title: t("row.title"),
			icon: jsx(primitive("IconDeliverDocRegular"), { size: 14 }),
			open: expanded && details !== "",
			expandable: details !== "",
			expandOnRowClick: true,
			keepContentWhenOpen: true,
			onToggle: () => {
				setExpanded((value: Any) => !value);
			},
			collapsedContent: jsxs("span", {
				className: PresentRowCss.summary,
				children: [jsx("span", { children: t(`row.${state}`) }), jsx("span", {
					className: PresentRowCss.paths,
					children: fileNames(args)
				})]
			}),
			children: [jsx("pre", {
				className: PresentRowCss.output,
				children: details
			}), inspect && jsx("button", {
				type: "button",
				className: PresentRowCss.inspect,
				onClick: inspect,
				children: t("row.inspect")
			})]
		})
	});
}
