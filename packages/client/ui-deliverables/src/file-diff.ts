/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khung so sanh hai phien ban cua mot file — NGUYEN VAN ban goc (FileDiff)
 */
import { type Any, fragment, jsx, jsxs, primitive, useId, useEffect, useMemo, useRef, useState } from "./runtime.ts";
import { FileDiffCss } from "./class-names.ts";

/** Shared file comparison for the turn-tail hover preview and Sidebar review. */
/** Maximum rendered lines per comparison. */
const MAX_RENDERED_LINES = 5e3;
function highlightedSide(rows: Any,   side: Any,   highlighter: Any) {
	const source = rows.flatMap((row: Any) => {
		const no = row[side];
		return no === undefined ? [] : [{
			no,
			text: row.text
		}];
	});
	if (source.length === 0) return /* @__PURE__ */ new Map();
	const highlighted = highlighter(source.map((line: Any) => line.text).join("\n"));
	if (highlighted === undefined) return undefined;
	return new Map(source.map((line: Any,  index: Any) => {
		return [line.no, highlighted[index] ?? []];
	}));
}
function hunkHighlights(hunk: Any,  highlighter: Any) {
	const rows = hunkRows(hunk);
	return {
		old: highlightedSide(rows, "old", highlighter),
		new: highlightedSide(rows, "new", highlighter)
	};
}
function DiffText({ text, spans }: Any) {
	return jsx("span", {
		className: FileDiffCss.text,
		"data-diff-code": spans === undefined ? undefined : "",
		children: spans === undefined ? text : spans.map((span: Any,  index: Any) => jsx("span", {
			style: span.style,
			children: span.text
		}, index))
	});
}
/**
* Number a hunk's lines: context lines count on both sides, deletions on the
* old side, additions on the new side.
* @param hunk - a served hunk.
* @returns the rows in order.
*/
function hunkRows(hunk: Any) {
	let oldNo = hunk.oldStart;
	let newNo = hunk.newStart;
	return hunk.lines.map((line: Any) => {
		const text = line.slice(1);
		switch (line[0]) {
			case "+": return {
				kind: "add",
				old: undefined,
				new: newNo++,
				text
			};
			case "-": return {
				kind: "del",
				old: oldNo++,
				new: undefined,
				text
			};
			default: return {
				kind: "context",
				old: oldNo++,
				new: newNo++,
				text
			};
		}
	});
}
/**
* Pair a hunk's lines for the side-by-side view: each run of deletions is
* aligned with the run of additions that follows it, row by row, and context
* lines sit on both sides.
* @param hunk - a served hunk.
* @returns the rows in order.
*/
function splitRows(hunk: Any) {
	const rows = [];
	let dels: Any[] = [];
	let adds: Any[] = [];
	const flush = () => {
		for (let at = 0; at < Math.max(dels.length, adds.length); at += 1) {
			const left = dels[at];
			const right = adds[at];
			rows.push({
				...left === undefined ? {} : { left },
				...right === undefined ? {} : { right }
			});
		}
		dels = [];
		adds = [];
	};
	for (const row of hunkRows(hunk)) if (row.kind === "del") dels.push({
		no: row.old,
		text: row.text,
		kind: "del"
	});
	else if (row.kind === "add") adds.push({
		no: row.new,
		text: row.text,
		kind: "add"
	});
	else {
		flush();
		rows.push({
			left: {
				no: row.old,
				text: row.text,
				kind: "context"
			},
			right: {
				no: row.new,
				text: row.text,
				kind: "context"
			}
		});
	}
	flush();
	return rows;
}
/**
* The hunks to draw, cut at {@link MAX_RENDERED_LINES} lines in total.
* @param hunks - served hunks.
* @returns the hunks with the last one shortened as needed, and whether anything was cut.
*/
function renderedHunks(hunks: Any) {
	let budget = MAX_RENDERED_LINES;
	const kept: Any[] = [];
	for (const hunk of hunks) {
		if (budget === 0) return {
			hunks: kept,
			truncated: true
		};
		kept.push(hunk.lines.length <= budget ? hunk : {
			...hunk,
			lines: hunk.lines.slicebudget
		});
		budget -= Math.min(budget, hunk.lines.length);
	}
	return {
		hunks: kept,
		truncated: hunks.some((hunk: Any,  at: Any) => kept[at] !== hunk)
	};
}
/** The one-line fact about a text comparison worth stating above its hunks, if any. */
function noteOf(diff: Any) {
	if (!diff.before) return "diff.created";
	if (!diff.after) return "diff.deleted";
	if (diff.hunks.length === 0) return "diff.unchanged";
}
/**
* Render a file comparison with the same states and highlighting in previews and review tabs.
* Addition-only and deletion-only comparisons use one column without changing the requested layout.
* @param props - comparison state, layout choices, retry action, and localized copy.
* @returns the comparison or its loading, unavailable, or error state.
*/
export function FileDiff({ state, split, wrap, retry, t }: Any) {
	if (state === undefined || state === "loading") return jsx("p", {
		className: FileDiffCss.status,
		role: "status",
		children: t("diff.loading")
	});
	if (state === "missing") return jsx("p", {
		className: FileDiffCss.status,
		children: t("diff.missing")
	});
	if (state === "error") return jsxs("div", {
		className: FileDiffCss.status,
		children: [jsx("span", { children: t("diff.error") }), jsx(primitive("Button"), {
			size: "sm",
			onClick: retry,
			children: t("presented.retry")
		})]
	});
	if (state.kind === "binary") return jsx("p", {
		className: FileDiffCss.status,
		children: t("diff.binary")
	});
	if (state.kind === "oversized") return jsx("p", {
		className: FileDiffCss.status,
		children: t("diff.oversized")
	});
	const oneSided = state.hunks.some((hunk: Any) => hunk.lines.some((line: Any) => line.startsWith("+"))) !== state.hunks.some((hunk: Any) => hunk.lines.some((line: Any) => line.startsWith("-")));
	return jsx(TextDiff, {
		diff: state,
		split: split && !oneSided,
		wrap,
		t
	});
}
/** The kind a paired row carries: a deletion or addition on either side, otherwise context. */
function splitRowKind(row: Any) {
	return row.left?.kind === "del" ? "del" : row.right?.kind === "add" ? "add" : "context";
}
function hunkHeader(hunk: Any) {
	return `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
}
/**
* The side-by-side view without wrapping: two columns that clip their long
* lines and scroll together on both axes, so a long line on one side never
* runs under the other and both sides show the same rows and columns of text.
* Every line is one fixed-height row, which keeps the sides aligned.
* The columns suppress elastic overscroll while retaining native in-range scrolling.
*/
function SplitColumns({ hunks, highlights }: Any) {
	const paired = useMemo(() => hunks.map((hunk: Any) => ({
		header: hunkHeader(hunk),
		rows: splitRows(hunk)
	})), [hunks]);
	const columns = useRef({
		left: null,
		right: null
	});
	const offsets = useRef({
		left: {
			scrollLeft: 0,
			scrollTop: 0
		},
		right: {
			scrollLeft: 0,
			scrollTop: 0
		}
	});
	const follow = (side: Any) => (event: Any) => {
		const peer = side === "left" ? "right" : "left";
		const other = columns.current[peer];
		/* v8 ignore next -- Both column refs are attached before browser scroll events can run. */
		if (other === null) return;
		for (const axis of ["scrollLeft", "scrollTop"]) {
			const value = event.currentTarget[axis];
			if (offsets.current[side][axis] === value) continue;
			offsets.current[side][axis] = value;
			other[axis] = value;
			offsets.current[peer][axis] = other[axis];
		}
	};
	return jsx("div", {
		className: FileDiffCss.columns,
		children: ["left", "right"].map((side) => jsx("div", {
			className: FileDiffCss.column,
			"data-diff-side": side,
			ref: (element: Any) => {
				columns.current[side] = element;
			},
			onScroll: follow(side),
			children: paired.map((hunk: Any,  position: Any) => jsxs("section", {
				className: FileDiffCss.hunk,
				children: [jsx("div", {
					className: FileDiffCss.hunkHeader,
					"data-diff-hunk-header": true,
					children: hunk.header
				}), hunk.rows.map((row: Any,  at: Any) => {
					const cell = row[side];
					const spans = cell === undefined ? undefined : highlights[position]?.[side === "left" ? "old" : "new"]?.get(cell.no);
					return jsxs("div", {
						className: `${FileDiffCss.sideLine} ${cell === undefined ? FileDiffCss.empty : FileDiffCss[cell.kind]}`,
						"data-diff-line": splitRowKind(row),
						children: [jsx("span", {
							className: FileDiffCss.number,
							children: cell?.no ?? ""
						}), jsx(DiffText, {
							text: cell?.text ?? "",
							spans
						})]
					}, at);
				})]
			}, position))
		}, side))
	});
}
/** The hunks of a text comparison with their line numbers, unified or side by side. */
function TextDiff({ diff, split, wrap, t }: Any) {
	const note = noteOf(diff);
	const { hunks, truncated } = useMemo(() => renderedHunks(diff.hunks), [diff.hunks]);
	const highlighter = primitive("useCodeHighlighter")(primitive("languageForPath")(diff.path));
	const highlights = useMemo(() => hunks.map((hunk: Any) => hunkHighlights(hunk, highlighter)), [hunks, highlighter]);
	return jsxs("div", {
		className: FileDiffCss.body,
		"data-review-view": split ? "split" : "unified",
		"data-review-wrap": wrap || undefined,
		children: [
			note !== undefined && jsx("p", {
				className: FileDiffCss.note,
				"data-diff-note": hunks.length === 0 ? "empty" : "metadata",
				children: t(note)
			}),
			diff.coarse && jsx("p", {
				className: FileDiffCss.note,
				"data-diff-coarse": true,
				children: t("diff.coarse")
			}),
			truncated && jsx("p", {
				className: FileDiffCss.note,
				"data-diff-truncated": true,
				children: t("diff.truncated", { count: String(5e3) })
			}),
			split && !wrap ? jsx(SplitColumns, {
				hunks,
				highlights
			}) : hunks.map((hunk: Any,  position: Any) => {
				const highlighted = highlights[position];
				return jsxs("section", {
					className: FileDiffCss.hunk,
					children: [jsx("div", {
						className: FileDiffCss.hunkHeader,
						"data-diff-hunk-header": true,
						children: hunkHeader(hunk)
					}), split ? splitRows(hunk).map((row, at) => jsxs("div", {
						className: FileDiffCss.splitLine,
						"data-diff-line": splitRowKind(row),
						children: [jsxs("span", {
							className: `${FileDiffCss.cell} ${row.left === undefined ? FileDiffCss.empty : FileDiffCss[row.left.kind]}`,
							children: [jsx("span", {
								className: FileDiffCss.number,
								children: row.left?.no ?? ""
							}), jsx(DiffText, {
								text: row.left?.text ?? "",
								spans: row.left === undefined ? undefined : highlighted?.old?.get(row.left.no)
							})]
						}), jsxs("span", {
							className: `${FileDiffCss.cell} ${row.right === undefined ? FileDiffCss.empty : FileDiffCss[row.right.kind]}`,
							children: [jsx("span", {
								className: FileDiffCss.number,
								children: row.right?.no ?? ""
							}), jsx(DiffText, {
								text: row.right?.text ?? "",
								spans: row.right === undefined ? undefined : highlighted?.new?.get(row.right.no)
							})]
						})]
					}, at)) : hunkRows(hunk).map((row: Any,  at: Any) => jsxs("div", {
						className: `${FileDiffCss.line} ${FileDiffCss[row.kind]}`,
						"data-diff-line": row.kind,
						children: [
							jsx("span", {
								className: FileDiffCss.number,
								children: row.old ?? ""
							}),
							jsx("span", {
								className: FileDiffCss.number,
								children: row.new ?? ""
							}),
							jsx("span", {
								className: FileDiffCss.sign,
								children: row.kind === "add" ? "+" : row.kind === "del" ? "-" : " "
							}),
							jsx(DiffText, {
								text: row.text,
								spans: row.kind === "add" ? highlighted?.new?.get(row.new) : highlighted?.old?.get(row.old)
							})
						]
					}, at))]
				}, position);
			})
		]
	});
}
