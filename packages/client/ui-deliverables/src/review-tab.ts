/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tab so sanh trong thanh ben phai — NGUYEN VAN ban goc (ReviewTab)
 */
import { FileDiff } from "./file-diff.ts";
import { changedFileUrl, changesDiffUrl, changesSummaryUrl, parseChangesReviewAddress } from "./changes.ts";
import { en } from "./locales.ts";
import { fileAddressFor } from "./workspace-path.ts";
import { type Any, fragment, jsx, jsxs, primitive, useId, useEffect, useMemo, useRef, useState } from "./runtime.ts";
import { FileDiffCss, ReviewTabCss } from "./class-names.ts";

/**
* The review tab: one turn's changed files behind a file selector, with the
* selected file's turn-start and turn-end comparison drawn unified or side by
* side, wrapped or scrolling, and controls to open the file itself.
*/
const GROUPED = new Intl.NumberFormat("en-US");
/**
 * Chi so file ma mot lan dieu huong neu ten, khi no co neu.
 * Nhan: params — tham so cua tab (co the undefined).
 * Tra: chi so nguyen khong am, hoac undefined.
 */
export function navigatedIndex(params: Any) {
	const index = params?.index;
	return typeof index === "number" && Number.isSafeInteger(index) && index >= 0 ? index : undefined;
}
/**
 * Bo dem "+N -M" cua mot file, hoac nhan "nhi phan"/"qua lon".
 * Nhan: props.file — ban ghi file da doi; props.t — ham dich cua namespace deliverables.
 * Tra: node hien thi bo dem.
 */
export function Counts({ file, t }: Any) {
	if (file.binary === true) return jsx("span", {
		className: ReviewTabCss.label,
		children: t("changes.binary")
	});
	if (file.oversized === true) return jsx("span", {
		className: ReviewTabCss.label,
		children: t("changes.oversized")
	});
	return jsxs(fragment(), { children: [jsx("span", {
		className: ReviewTabCss.added,
		children: t("changes.added", { count: GROUPED.format(file.added) })
	}), jsx("span", {
		className: ReviewTabCss.deleted,
		children: t("changes.deleted", { count: GROUPED.format(file.deleted) })
	})] });
}
/**
* The review type's body, registered under `sidebar.right.pane.tab` as `changes-review`.
* @param props - composed slot props.
* @returns the selected file's comparison behind the file selector, or the state that stands in for it.
*/
export function ReviewTab({ useTabInfo, sessionId, useSessions, useStore, actions, useChangesSummary, useChangesDiff, usePresentedOpen, usePresentedHost, loadChangesSummary, loadChangesDiff, reloadPresentedHost, openChanged, t, renderSlot }: Any) {
	const { tab } = useTabInfo();
	const { navigation, signal } = tab;
	const coordinates = useMemo(() => parseChangesReviewAddress(tab.contentId), [tab.contentId]);
	if (coordinates === undefined) throw new Error(`ui-deliverables: not a review address "${tab.contentId}"`);
	const { seq } = coordinates;
	const cwd = useSessions((sessions: Any) => sessions.byId[sessionId]?.cwd);
	const summary = useChangesSummary((value: Any) => value[changesSummaryUrl(sessionId, seq)]);
	const state = useStore((store: Any) => store.byTab[tab.id]);
	const host = usePresentedHost((value: Any) => value);
	useEffect(() => {
		if (state?.navigated === navigation.revision) return;
		actions.navigated(tab.id, navigation.revision, navigatedIndex(navigation.params) ?? state?.index ?? 0);
	}, [
		state,
		navigation.revision,
		navigation.params,
		actions,
		tab.id
	]);
	useEffect(() => {
		const forget = () => {
			actions.forget(tab.id);
		};
		signal.addEventListener("abort", forget, { once: true });
		return () => {
			signal.removeEventListener("abort", forget);
		};
	}, [
		signal,
		actions,
		tab.id
	]);
	useEffect(() => {
		if (summary === undefined) loadChangesSummary(sessionId, seq);
	}, [
		summary,
		sessionId,
		seq,
		loadChangesSummary
	]);
	useEffect(() => {
		if (host === null) reloadPresentedHost();
	}, [host, reloadPresentedHost]);
	const files = typeof summary === "object" ? summary.files : [];
	const index = state !== undefined && files[state.index] !== undefined ? state.index : 0;
	const file = files[index];
	const diffState = useChangesDiff((value: Any) => file === undefined ? undefined : value[changesDiffUrl(sessionId, seq, index)]);
	useEffect(() => {
		if (file !== undefined && diffState === undefined) loadChangesDiff(sessionId, seq, index);
	}, [
		file,
		diffState,
		sessionId,
		seq,
		index,
		loadChangesDiff
	]);
	const phase = usePresentedOpen((value: Any) => file === undefined ? undefined : value[changedFileUrl(sessionId, seq, index)]);
	const [menuOpen, setMenuOpen] = useState(false);
	const split = state?.split === true;
	const wrap = state?.wrap === true;
	const native = host !== null && host !== "error" && host.available && phase !== "nativeUnavailable";
	const summaryState = summary === undefined || summary === "loading" ? "loading" : summary === "missing" ? "missing" : "ready";
	return jsxs("div", {
		className: `${FileDiffCss.root} ${ReviewTabCss.root}`,
		"data-changes-review": true,
		"data-review-state": summaryState,
		children: [
			jsxs("div", {
				className: FileDiffCss.header,
				children: [
					file === undefined ? jsx("span", {
						className: ReviewTabCss.selectorLabel,
						children: t("review.title", { turn: String(coordinates.turn) })
					}) : jsx(primitive("Menu"), {
						className: ReviewTabCss.selector,
						open: menuOpen,
						autoFocus: true,
						portal: true,
						align: "start",
						dense: true,
						onClose: () => {
							setMenuOpen(false);
						},
						anchor: jsxs("button", {
							type: "button",
							className: ReviewTabCss.selectorButton,
							"aria-haspopup": "menu",
							"aria-expanded": menuOpen,
							"aria-label": t("review.selectFile"),
							title: file.display,
							"data-review-file": file.path,
							onClick: () => {
								setMenuOpen((value: Any) => !value);
							},
							children: [jsx(primitive("PathLabel"), { path: file.display }), jsx(primitive("IconChevronDownOutlineRegular"), { size: 12 })]
						}),
						items: files.map((entry: Any,  at: Any) => ({
							id: String(at),
							label: jsxs("span", {
								className: ReviewTabCss.item,
								children: [jsx("span", {
									className: ReviewTabCss.itemPath,
									children: entry.display
								}), jsx("span", {
									className: ReviewTabCss.itemCounts,
									children: jsx(Counts, {
										file: entry,
										t
									})
								})]
							})
						})),
						selectedId: String(index),
						onSelect: (id: Any) => {
							actions.selected(tab.id, Number(id));
							setMenuOpen(false);
						}
					}),
					file !== undefined && jsx("span", {
						className: ReviewTabCss.counts,
						children: jsx(Counts, {
							file,
							t
						})
					}),
					jsxs("span", {
						className: ReviewTabCss.tools,
						children: [
							jsx(primitive("Tooltip"), {
								label: t(split ? "review.unified" : "review.split"),
								side: "bottom",
								delayMs: 500,
								children: jsx("button", {
									type: "button",
									className: ReviewTabCss.tool,
									"aria-pressed": split,
									"aria-label": t("review.splitAria"),
									"data-review-tool": "split",
									onClick: () => {
										actions.toggledSplit(tab.id);
									},
									children: jsx(primitive("IconCompareSplitOutlineRegular"), { className: ReviewTabCss.compareIcon })
								})
							}),
							jsx(primitive("Tooltip"), {
								label: t(wrap ? "review.nowrap" : "review.wrap"),
								side: "bottom",
								delayMs: 500,
								children: jsx("button", {
									type: "button",
									className: ReviewTabCss.tool,
									"aria-pressed": wrap,
									"aria-label": t("review.wrapAria"),
									"data-review-tool": "wrap",
									onClick: () => {
										actions.toggledWrap(tab.id);
									},
									children: wrap ? jsx(primitive("IconNowrapFillRegular"), {}) : jsx(primitive("IconWrapFillRegular"), {})
								})
							}),
							file !== undefined && jsx(primitive("Tooltip"), {
								label: t("review.openFile"),
								side: "bottom",
								delayMs: 500,
								children: jsx("button", {
									type: "button",
									className: ReviewTabCss.tool,
									"aria-label": t("review.openFileAria", { name: file.display }),
									"data-review-tool": "open-file",
									onClick: () => {
										tab.actions.openResource(fileAddressFor(sessionId, cwd, file.path));
									},
									children: jsx(primitive("IconInspectOutlineRegular"), {})
								})
							}),
							file !== undefined && renderSlot("deliverables.review.file.actions", {
								actionUrl: changedFileUrl(sessionId, seq, index),
								available: native,
								pending: phase === "opening" || phase === "revealing",
								onAction: (action: Any,  application: Any) => openChanged(sessionId, seq, index, action, application)
							})
						]
					})
				]
			}),
			summaryState === "loading" && jsx("p", {
				className: FileDiffCss.status,
				role: "status",
				children: t("diff.loading")
			}),
			summaryState === "missing" && jsx("p", {
				className: FileDiffCss.status,
				children: t("diff.missing")
			}),
			file !== undefined && jsx(FileDiff, {
				state: diffState,
				split,
				wrap,
				t,
				retry: () => {
					loadChangesDiff(sessionId, seq, index);
				}
			})
		]
	});
}
