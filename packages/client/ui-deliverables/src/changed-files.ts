/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc The file da doi cua mot luot — NGUYEN VAN ban goc (ChangedFiles)
 */
import { FileDiff } from "./file-diff.ts";
import { basename } from "./presented.ts";
import { changesDiffUrl } from "./changes.ts";
import { en } from "./locales.ts";
import { resolveWorkspacePath } from "./workspace-path.ts";
import { type Any, fragment, jsx, jsxs, primitive, useId, useEffect, useMemo, useRef, useState } from "./runtime.ts";
import { FileDiffCss, ChangedFilesCss } from "./class-names.ts";

/** Turn changes use a compact single-file card or a header with a folded file list. */
/** Rows shown before the fold; the design's summary height for a closing message. */
const COLLAPSED_ROWS = 4;
const GROUPED = new Intl.NumberFormat("en-US");
/** Added and deleted line counts in the card's colors. */
function Counts({ added, deleted, t }: Any) {
	return jsxs(fragment(), { children: [jsx("span", {
		className: ChangedFilesCss.added,
		children: t("changes.added", { count: GROUPED.format(added) })
	}), jsx("span", {
		className: ChangedFilesCss.deleted,
		children: t("changes.deleted", { count: GROUPED.format(deleted) })
	})] });
}
/**
* Render one turn's changed files. The header opens the turn's review in the
* right Sidebar on its first file. A single file uses only the header; it and
* multi-file rows preview their comparison after a 500ms hover.
* @param props - the recorded summary, the review opener, and localized copy.
* @returns the card.
*/
export function ChangedFiles({ changes, cwd, openReview, t, sessionId, useChangesDiff, loadChangesDiff }: Any) {
	const cardRef = useRef(null);
	const pathDescriptionId = useId();
	const [expanded, setExpanded] = useState(false);
	const singleFile = changes.total === 1 ? changes.files[0] : undefined;
	const foldable = changes.files.length > COLLAPSED_ROWS;
	const rows = foldable && !expanded ? changes.files.sliceCOLLAPSED_ROWS : changes.files;
	const header = jsxs("button", {
		type: "button",
		className: ChangedFilesCss.header,
		"aria-label": singleFile === undefined ? t("changes.openReview") : t("changes.viewDiff", { name: singleFile.display }),
		"aria-describedby": singleFile === undefined ? undefined : pathDescriptionId,
		onClick: () => {
			openReview(0);
		},
		children: [jsx("span", {
			className: ChangedFilesCss.tile,
			children: singleFile === undefined ? jsx(primitive("FileTypeIcon"), {
				kind: "code",
				size: 20
			}) : jsx(primitive("FileTypeIcon"), {
				path: singleFile.path,
				size: 20
			})
		}), jsxs("span", {
			className: ChangedFilesCss.titles,
			children: [jsx("span", {
				className: ChangedFilesCss.title,
				children: singleFile === undefined ? t("changes.title", { count: String(changes.total) }) : t("changes.singleTitle", { name: basename(singleFile.path) })
			}), jsxs("span", {
				className: ChangedFilesCss.stat,
				children: [jsx("span", {
					className: ChangedFilesCss.statCounts,
					children: singleFile?.binary === true ? t("changes.binary") : singleFile?.oversized === true ? t("changes.oversized") : jsx(Counts, {
						t,
						added: changes.added,
						deleted: changes.deleted
					})
				}), jsx("span", {
					className: ChangedFilesCss.previewHint,
					children: t("presented.preview")
				})]
			})]
		})]
	});
	return jsxs("div", {
		ref: cardRef,
		className: ChangedFilesCss.card,
		"data-changed-files": true,
		"data-single": singleFile !== undefined || undefined,
		children: [
			singleFile === undefined ? header : jsxs(fragment(), { children: [jsx(primitive("HoverCard"), {
				variant: "preview",
				widthAnchorRef: cardRef,
				openDelayMs: 500,
				anchor: header,
				content: jsx(ChangedFilePreview, {
					sessionId,
					seq: changes.seq,
					index: 0,
					display: resolveWorkspacePath(cwd, singleFile.path),
					useChangesDiff,
					loadChangesDiff,
					t
				})
			}), jsx("span", {
				id: pathDescriptionId,
				hidden: true,
				children: resolveWorkspacePath(cwd, singleFile.path)
			})] }),
			singleFile === undefined && jsx("ul", {
				className: ChangedFilesCss.list,
				children: rows.map((file: Any,  index: Any) => jsxs("li", { children: [jsx(primitive("HoverCard"), {
					variant: "preview",
					widthAnchorRef: cardRef,
					openDelayMs: 500,
					content: jsx(ChangedFilePreview, {
						sessionId,
						seq: changes.seq,
						index,
						display: resolveWorkspacePath(cwd, file.path),
						useChangesDiff,
						loadChangesDiff,
						t
					}),
					anchor: jsxs("button", {
						type: "button",
						className: ChangedFilesCss.row,
						"aria-label": t("changes.viewDiff", { name: file.display }),
						"aria-describedby": `${pathDescriptionId}-${index}`,
						onClick: () => {
							openReview(index);
						},
						children: [jsx("span", {
							className: ChangedFilesCss.path,
							children: file.display
						}), jsx("span", {
							className: ChangedFilesCss.counts,
							children: file.binary === true ? t("changes.binary") : file.oversized === true ? t("changes.oversized") : jsx(Counts, {
								t,
								added: file.added,
								deleted: file.deleted
							})
						})]
					})
				}), jsx("span", {
					id: `${pathDescriptionId}-${index}`,
					hidden: true,
					children: resolveWorkspacePath(cwd, file.path)
				})] }, file.display))
			}),
			foldable && jsxs("button", {
				type: "button",
				className: ChangedFilesCss.toggle,
				"aria-expanded": expanded,
				"aria-label": t(expanded ? "changes.collapseAria" : "changes.expandAria", { count: String(changes.files.length) }),
				onClick: () => {
					setExpanded((value: Any) => !value);
				},
				children: [jsx("span", { children: t(expanded ? "changes.collapse" : "changes.all", { count: String(changes.files.length) }) }), expanded ? jsx(primitive("IconChevronUpOutlineRegular"), {}) : jsx(primitive("IconChevronDownOutlineRegular"), {})]
			})
		]
	});
}
/** Mounted only while its hover card is open, so passing over a row does not read a comparison. */
function ChangedFilePreview({ sessionId, seq, index, display, useChangesDiff, loadChangesDiff, t }: Any) {
	const state = useChangesDiff((value: Any) => value[changesDiffUrl(sessionId, seq, index)]);
	useEffect(() => {
		if (state === undefined) loadChangesDiff(sessionId, seq, index);
	}, [
		state,
		sessionId,
		seq,
		index,
		loadChangesDiff
	]);
	return jsxs("div", {
		className: `${FileDiffCss.root} ${ChangedFilesCss.preview}`,
		"data-changes-hover-preview": true,
		children: [jsx("div", {
			className: FileDiffCss.header,
			children: jsx("span", {
				className: ChangedFilesCss.previewPath,
				"data-changes-preview-path": true,
				children: display
			})
		}), jsx(FileDiff, {
			state,
			split: false,
			wrap: false,
			t,
			retry: () => {
				loadChangesDiff(sessionId, seq, index);
			}
		})]
	});
}
