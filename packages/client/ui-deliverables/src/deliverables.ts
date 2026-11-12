/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khoi ban giao duoi moi luot — NGUYEN VAN ban goc (Deliverables)
 */
import { ChangedFiles } from "./changed-files.ts";
import { PresentedFileCard } from "./presented-file-card.ts";
import { changesForClosing, presentedForClosing } from "./turn-deliverables.ts";
import { changesSummaryUrl } from "./changes.ts";
import { presentedFileUrl } from "./presented.ts";
import { type Any, fragment, jsx, jsxs, primitive, useId, useEffect, useMemo, useRef, useState } from "./runtime.ts";
import { DeliverablesCss } from "./class-names.ts";

/** The changed-files card, shown only while the Host serves the turn's summary, and explicitly declared files for a closing turn. */
const COLLAPSED_PRESENTED_COUNT = 4;
/**
* Claim turns with a change announcement or declared files.
* @param owner - closing turn.
* @returns matched announcement and deliveries, or null for a turn with neither.
*/
export function selectDeliverables(owner: Any) {
	const changes = changesForClosing(owner);
	const presented = presentedForClosing(owner);
	return changes === null && presented.length === 0 ? null : {
		changes,
		presented
	};
}
/**
* Contribute file deliveries alongside other completed-Turn artifacts.
* @param props - closing Turn, file actions, and localized copy.
* @returns file rows, or null when the Turn declares none.
*/
export function DeliverablesTail(props: Any) {
	const matched = selectDeliverables(props);
	return matched === null ? null : jsx(Deliverables, {
		...props,
		matched
	});
}
/**
* Render the changed-files card, once the Host has served the announced
* summary and it lists a file, and shared native opening controls for declared
* files. A summary the Host no longer serves leaves no card.
* @param props - matched announcement and files, workspace opener, and localized copy.
* @returns the closing turn's file rows.
*/
export function Deliverables({ matched, openFile, t, sessionId, useSessions, openPresented, openChangesReview, usePresentedOpen, usePresentedHost, useChangesDiff, loadChangesDiff, useChangesSummary, reloadPresentedHost, loadChangesSummary, useShowCodeDiff, renderSlot }: Any) {
	const [expanded, setExpanded] = useState(false);
	const showCodeDiff = useShowCodeDiff((value: Any) => value);
	const cwd = useSessions((state: Any) => state.byId[sessionId]?.cwd);
	const states = usePresentedOpen((value: Any) => value);
	const host = usePresentedHost((value: Any) => value);
	const announced = showCodeDiff ? matched.changes : null;
	const summary = useChangesSummary((value: Any) => announced === null ? undefined : value[changesSummaryUrl(sessionId, announced.seq)]);
	useEffect(() => {
		if (announced !== null && summary === undefined) loadChangesSummary(sessionId, announced.seq);
	}, [
		announced,
		summary,
		sessionId,
		loadChangesSummary
	]);
	const changes = announced !== null && typeof summary === "object" && summary.files.length > 0 ? {
		seq: announced.seq,
		...summary
	} : null;
	const collapsible = matched.presented.length > COLLAPSED_PRESENTED_COUNT;
	const presented = collapsible && !expanded ? matched.presented.sliceCOLLAPSED_PRESENTED_COUNT : matched.presented;
	useEffect(() => {
		if (host === null) reloadPresentedHost();
	}, [host, reloadPresentedHost]);
	return jsxs(fragment(), { children: [changes !== null && jsx(ChangedFiles, {
		changes,
		cwd,
		t,
		sessionId,
		useChangesDiff,
		loadChangesDiff,
		openReview: (index: Any) => {
			openChangesReview({
				sessionId,
				seq: changes.seq,
				turn: changes.turn
			}, index);
		}
	}), matched.presented.length > 0 && jsxs("div", {
		className: DeliverablesCss.root,
		"data-after-changes": changes !== null || undefined,
		children: [
			host === "error" && jsxs("div", {
				className: DeliverablesCss.hostStatus,
				children: [jsx("span", { children: t("presented.hostError") }), jsx(primitive("Button"), {
					size: "sm",
					onClick: () => {
						reloadPresentedHost();
					},
					children: t("presented.retry")
				})]
			}),
			host !== null && host !== "error" && !host.available && jsx("span", {
				className: DeliverablesCss.hostStatus,
				children: t("presented.unavailable")
			}),
			jsx("div", {
				className: DeliverablesCss.presented,
				"data-presented-files-row": true,
				"data-single": matched.presented.length === 1 ? true : undefined,
				children: presented.map((file: Any) => jsx(PresentedFileCard, {
					file,
					cwd,
					phase: states[presentedFileUrl(sessionId, file.seq, file.index)],
					host: host === "error" ? null : host,
					t,
					onPreview: () => {
						openFile(file.path);
					},
					actions: renderSlot("deliverables.file.actions", {
						actionUrl: presentedFileUrl(sessionId, file.seq, file.index),
						available: host !== null && host !== "error" && host.available,
						pending: states[presentedFileUrl(sessionId, file.seq, file.index)] === "opening" || states[presentedFileUrl(sessionId, file.seq, file.index)] === "revealing",
						onAction: (action: Any,  application: Any) => openPresented(sessionId, file.seq, file.index, action, application)
					})
				}, `${file.seq}:${file.index}`))
			}),
			collapsible && jsxs("button", {
				type: "button",
				className: DeliverablesCss.toggle,
				"aria-expanded": expanded,
				"aria-label": t(expanded ? "presented.collapseAria" : "presented.expandAria", { count: matched.presented.length }),
				onClick: () => {
					setExpanded((value: Any) => !value);
				},
				children: [jsx("span", { children: t(expanded ? "presented.collapse" : "presented.all", { count: matched.presented.length }) }), expanded ? jsx(primitive("IconChevronUpOutlineRegular"), {}) : jsx(primitive("IconChevronDownOutlineRegular"), {})]
			})
		]
	})] });
}
