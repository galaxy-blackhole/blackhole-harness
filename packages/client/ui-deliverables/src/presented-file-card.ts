/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc The mot file da ban giao — NGUYEN VAN ban goc (PresentedFileCard)
 */
import { PRESENTED_SUCCESS_HOLD_MS } from "./present-open.ts";
import { basename } from "./presented.ts";
import { resolveWorkspacePath } from "./workspace-path.ts";
import { type Any, fragment, jsx, jsxs, primitive, useId, useEffect, useMemo, useRef, useState } from "./runtime.ts";
import { DeliverablesCss } from "./class-names.ts";

function cardDescription(description: Any,  fallback: Any) {
	const trimmed = description?.replace(/\s*(?:\([^()]*\)|（[^（）]*）)\s*$/u, "").trim();
	return trimmed === undefined || trimmed === "" ? fallback : trimmed;
}
/**
* Render independent file actions without nesting buttons inside a clickable card.
* @param props - durable file metadata, Sidebar preview, Host capabilities, gesture status, and localized copy.
* @returns the file card and its anchored action menu.
*/
export function PresentedFileCard({ file, cwd, phase, host, onPreview, actions, t }: Any) {
	const succeeded = phase === "opened" || phase === "revealed";
	const reveal = host?.fileManager ?? "directory";
	const name = basename(file.path);
	const metadata = primitive("fileExtension")(name).toUpperCase() || t("presented.file");
	const status = phase === undefined ? cardDescription(file.description, metadata) : t(reveal === "directory" && phase === "revealed" ? "presented.directoryOpened" : reveal === "directory" && phase === "revealing" ? "presented.directoryOpening" : reveal === "directory" && phase === "revealError" ? "presented.directoryError" : `presented.${phase}`);
	return jsxs("div", {
		className: DeliverablesCss.file,
		"data-presented-file": true,
		children: [
			jsx("button", {
				type: "button",
				className: DeliverablesCss.cardPreview,
				title: resolveWorkspacePath(cwd, file.path),
				"aria-label": t("presented.previewCard", { name: file.path }),
				onClick: onPreview
			}),
			jsx("span", {
				className: DeliverablesCss.fileIcon,
				children: jsx(primitive("FileTypeIcon"), {
					path: file.path,
					size: 20
				})
			}),
			jsxs("div", {
				className: DeliverablesCss.fileBody,
				children: [jsxs("div", {
					className: DeliverablesCss.details,
					children: [jsx("span", {
						className: DeliverablesCss.fileName,
						children: name
					}), jsxs("span", {
						className: DeliverablesCss.description,
						"data-presented-description": true,
						role: phase === undefined ? undefined : "status",
						"data-error": phase === "error" || phase === "revealError" || phase === "nativeUnavailable" ? true : undefined,
						children: [jsx("span", {
							className: DeliverablesCss.secondaryText,
							"data-success": succeeded || undefined,
							style: succeeded ? {
								animationDelay: `${PRESENTED_SUCCESS_HOLD_MS}ms`,
								animationDuration: `200ms`
							} : undefined,
							children: status
						}), jsx("span", {
							className: DeliverablesCss.previewHint,
							children: t("presented.preview")
						})]
					})]
				}), jsx("div", {
					className: DeliverablesCss.actions,
					children: actions
				})]
			})
		]
	});
}
