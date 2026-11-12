/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-workflow-run",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-workflow-run/src/client/WorkflowRunPanel.module.css.mjs
		const css = ".DBuyfa_root{width:100%;min-width:0}.DBuyfa_runHeader{box-sizing:border-box;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);align-items:center;gap:6px;width:100%;min-width:0;height:32px;padding:0 8px;display:flex}.DBuyfa_runHeader:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.DBuyfa_runLeading{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));color:inherit;flex:none;justify-content:center;align-items:center;margin-right:0;display:inline-flex}.DBuyfa_runTitle{max-width:42%;color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-weight:510;line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:none;overflow:hidden}.DBuyfa_runSummary{min-width:0;color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px));text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.DBuyfa_statusTail{height:20px;color:inherit;white-space:nowrap;flex:none;align-items:center;gap:4px;font-size:11px;font-weight:510;line-height:16px;display:inline-flex;overflow:hidden}.DBuyfa_phaseHeader{box-sizing:border-box;align-items:center;gap:6px;width:100%;min-width:0;height:32px;display:flex}.DBuyfa_phaseHeader:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px;border-radius:var(--dsw-radius-md)}.DBuyfa_phaseLeading{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));color:inherit;flex:none;justify-content:center;align-items:center;margin-right:0;display:inline-flex}.DBuyfa_phaseTitle{min-width:0;max-width:42%;color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:0 auto;overflow:hidden}.DBuyfa_phaseCount{min-width:0;color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.DBuyfa_phaseStatus{width:calc(132px + var(--dsh-content-font-delta-secondary,0px) * 10);color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));text-align:right;text-overflow:ellipsis;white-space:nowrap;flex:none;overflow:hidden}.DBuyfa_separator{corner-shape:round;background:var(--dsw-alias-label-tertiary);border-radius:50%;flex:none;width:2px;height:2px}.DBuyfa_phaseList{flex-direction:column;gap:4px;min-width:0;padding:4px 0 0 16px;display:flex}.DBuyfa_phase{min-width:0}.DBuyfa_members{flex-direction:column;gap:2px;min-width:0;padding:0 0 0 16px;display:flex}.DBuyfa_memberRow,.DBuyfa_memberButton{width:100%;min-width:0;min-height:calc(24px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;background:0 0;border:0;align-items:center;gap:12px;padding:0;display:flex}.DBuyfa_memberButton{cursor:pointer}.DBuyfa_memberButton .DBuyfa_memberLabel{color:var(--dsw-alias-link);font-weight:500;text-decoration:none}.DBuyfa_memberButton:hover .DBuyfa_memberLabel,.DBuyfa_memberButton:focus-visible .DBuyfa_memberLabel{text-underline-offset:3px;text-decoration:underline dotted}.DBuyfa_dotSlot{width:16px;height:calc(24px + var(--dsh-content-font-delta,0px));flex:none;justify-content:center;align-items:center;display:inline-flex;overflow:hidden}.DBuyfa_memberButton:focus-visible{outline:none}.DBuyfa_memberButton:focus-visible .DBuyfa_memberLabelWrap{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-1px}.DBuyfa_memberLabelWrap{min-width:0;height:calc(24px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);flex:1;align-items:center;padding:0 2px;display:flex;overflow:hidden}.DBuyfa_memberLabel{min-width:0;color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.DBuyfa_memberStatus{width:64px;color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));text-align:right;text-overflow:ellipsis;white-space:nowrap;flex:none;overflow:hidden}.DBuyfa_empty{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));padding:0}@media (width<=560px){.DBuyfa_phaseList,.DBuyfa_members{padding-left:12px}}.DBuyfa_headerContent{flex:1}.DBuyfa_headerContentLayout{gap:6px}";
		const tagId = "@deepseek-ai/dsh-client-ui-workflow-run/WorkflowRunPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-workflow-run";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var WorkflowRunPanel_module_css_default = {
			"dotSlot": "DBuyfa_dotSlot",
			"empty": "DBuyfa_empty",
			"headerContent": "DBuyfa_headerContent",
			"headerContentLayout": "DBuyfa_headerContentLayout",
			"memberButton": "DBuyfa_memberButton",
			"memberLabel": "DBuyfa_memberLabel",
			"memberLabelWrap": "DBuyfa_memberLabelWrap",
			"memberRow": "DBuyfa_memberRow",
			"memberStatus": "DBuyfa_memberStatus",
			"members": "DBuyfa_members",
			"phase": "DBuyfa_phase",
			"phaseCount": "DBuyfa_phaseCount",
			"phaseHeader": "DBuyfa_phaseHeader",
			"phaseLeading": "DBuyfa_phaseLeading",
			"phaseList": "DBuyfa_phaseList",
			"phaseStatus": "DBuyfa_phaseStatus",
			"phaseTitle": "DBuyfa_phaseTitle",
			"root": "DBuyfa_root",
			"runHeader": "DBuyfa_runHeader",
			"runLeading": "DBuyfa_runLeading",
			"runSummary": "DBuyfa_runSummary",
			"runTitle": "DBuyfa_runTitle",
			"separator": "DBuyfa_separator",
			"statusTail": "DBuyfa_statusTail"
		};
		//#endregion
		//#region lib/types/client/WorkflowRunPanel.js
		const STATUS_KEYS = {
			running: "status.running",
			completed: "status.completed",
			failed: "status.failed",
			cancelled: "status.cancelled",
			interrupted: "status.interrupted"
		};
		function dotState(status) {
			switch (status) {
				case "running": return "ongoing";
				case "completed": return "done";
				case "failed": return "error";
				case "cancelled":
				case "interrupted": return "warning";
				/* v8 ignore next -- WorkflowRunStatus is closed and every variant is handled above. */
				default: return status;
			}
		}
		function readablePhase(phase, t) {
			if (phase === null) return t("phase.unassigned");
			return phase === "" ? t("phase.empty") : phase;
		}
		function readableMember(label, t) {
			return label === "" ? t("member.empty") : label;
		}
		function statusCount(status, count, t) {
			return t(`statusCount.${status}`, { count });
		}
		function memberCount(count, t) {
			return t(count === 1 ? "run.members.one" : "run.members.other", { count });
		}
		function StatusDisclosure(props) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
				...props,
				expandable: true
			});
		}
		function abnormal(status) {
			return status === "failed" || status === "cancelled" || status === "interrupted";
		}
		function phaseDisclosureFacts(phase) {
			return {
				mode: phase.members.some((member) => abnormal(member.status)) ? "abnormal" : phase.members.some((member) => member.status === "running") ? "running" : "clean",
				activityCount: phase.members.length
			};
		}
		function runDisclosureFacts(status, phases) {
			return {
				mode: abnormal(status) || phases.some(([, facts]) => facts.mode === "abnormal") ? "abnormal" : status === "running" || phases.some(([, facts]) => facts.mode === "running") ? "running" : "clean",
				activityCount: phases.reduce((count, [, facts]) => count + facts.activityCount, 0)
			};
		}
		function initialDisclosureState(facts) {
			return {
				...facts,
				open: facts.mode !== "clean",
				pendingCleanCollapse: false
			};
		}
		function advanceDisclosureState(current, facts, focusWithin) {
			if (current.mode === facts.mode && current.activityCount === facts.activityCount) {
				if (!current.pendingCleanCollapse || focusWithin) return current;
				return {
					...current,
					open: false,
					pendingCleanCollapse: false
				};
			}
			if (facts.mode === "clean") {
				const deferCollapse = current.open && focusWithin;
				return {
					...facts,
					open: deferCollapse,
					pendingCleanCollapse: deferCollapse
				};
			}
			if (current.mode === "clean" || facts.mode === "abnormal" && current.mode !== "abnormal") return {
				...facts,
				open: true,
				pendingCleanCollapse: false
			};
			return {
				...facts,
				open: current.open,
				pendingCleanCollapse: false
			};
		}
		function focusIsWithin(element) {
			if (element === null || element === void 0) return false;
			return element.contains(element.ownerDocument.activeElement);
		}
		function collapsePending(state) {
			if (!state.pendingCleanCollapse) return state;
			return {
				...state,
				open: false,
				pendingCleanCollapse: false
			};
		}
		function existingPhaseState(phases, key) {
			const phase = phases.get(key);
			/* v8 ignore next -- mounted phase callbacks are created from this owner map. */
			if (phase === void 0) throw new Error(`Missing disclosure state for phase ${key}`);
			return phase;
		}
		function preventPendingHeaderFocus(event) {
			const header = event.currentTarget.querySelector("[data-disclosure-row]");
			/* v8 ignore next -- DisclosureRow always renders its header before the content. */
			if (header === null) throw new Error("Missing disclosure header");
			if (header.contains(event.target)) event.preventDefault();
		}
		function phaseStatusSummary(members, t) {
			const counts = /* @__PURE__ */ new Map();
			for (const member of members) counts.set(member.status, (counts.get(member.status) ?? 0) + 1);
			const count = (status) => counts.get(status) ?? 0;
			const active = [
				"running",
				"failed",
				"cancelled",
				"interrupted"
			].filter((status) => count(status) > 0);
			if (active.length === 0) return statusCount("completed", count("completed"), t);
			return (active.includes("interrupted") && count("completed") > 0 ? ["completed", ...active] : active).map((status) => statusCount(status, count(status), t)).join(" · ");
		}
		function navigableMembers(sessions, phases, parentId, statuses) {
			const result = /* @__PURE__ */ new Map();
			for (const phase of phases) for (const member of phase.members) {
				const child = sessions.byId[member.childId];
				const identity = sessions.projectionsBySession[member.childId]?.values.subagent;
				if (member.status === "running" && child?.parentId === parentId && identity !== void 0 && identity !== null && (statuses.get(child.id)?.running ?? child.running)) result.set(member.childId, identity.mode);
			}
			return result;
		}
		function RunHeader({ children, count, name, onToggle, open, status, t }) {
			return (0, react_jsx_runtime.jsx)(StatusDisclosure, {
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {}),
				title: t("run.title", { name }),
				open,
				onToggle,
				expandOnRowClick: true,
				previewChevron: false,
				keepContentWhenOpen: true,
				rowClassName: WorkflowRunPanel_module_css_default.runHeader,
				contentClassName: WorkflowRunPanel_module_css_default.headerContent,
				contentLayoutClassName: WorkflowRunPanel_module_css_default.headerContentLayout,
				leadingClassName: WorkflowRunPanel_module_css_default.runLeading,
				titleClassName: WorkflowRunPanel_module_css_default.runTitle,
				collapsedContent: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: WorkflowRunPanel_module_css_default.separator,
						"aria-hidden": true
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: WorkflowRunPanel_module_css_default.runSummary,
						children: memberCount(count, t)
					}),
					(0, react_jsx_runtime.jsxs)("span", {
						className: WorkflowRunPanel_module_css_default.statusTail,
						"data-status": status,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dotState(status) }), (0, react_jsx_runtime.jsx)("span", { children: t(STATUS_KEYS[status]) })]
					})
				] }),
				children
			});
		}
		function MemberRow({ member, mode, openSession, parentSessionId, t }) {
			const navigable = mode !== void 0;
			const name = readableMember(member.label, t);
			const [focused, setFocused] = (0, react.useState)(false);
			const renderButton = navigable || focused;
			const content = (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("span", {
					className: WorkflowRunPanel_module_css_default.dotSlot,
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dotState(member.status) })
				}),
				(0, react_jsx_runtime.jsx)("span", {
					className: WorkflowRunPanel_module_css_default.memberLabelWrap,
					"data-member-label-wrap": true,
					children: (0, react_jsx_runtime.jsx)("span", {
						className: WorkflowRunPanel_module_css_default.memberLabel,
						"data-member-label": true,
						children: name
					})
				}),
				(0, react_jsx_runtime.jsx)("span", {
					className: WorkflowRunPanel_module_css_default.memberStatus,
					"data-member-status-text": true,
					children: t(STATUS_KEYS[member.status])
				})
			] });
			if (!renderButton) return (0, react_jsx_runtime.jsx)("div", {
				className: WorkflowRunPanel_module_css_default.memberRow,
				"data-member-status": member.status,
				children: content
			});
			return (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: navigable ? WorkflowRunPanel_module_css_default.memberButton : WorkflowRunPanel_module_css_default.memberRow,
				"data-member-status": member.status,
				"aria-disabled": navigable ? void 0 : true,
				"aria-label": navigable ? t("member.open", { name }) : name,
				tabIndex: navigable ? void 0 : -1,
				onFocus: () => {
					setFocused(true);
				},
				onBlur: () => {
					setFocused(false);
				},
				onClick: mode !== void 0 ? () => {
					openSession({
						parentSessionId,
						childSessionId: member.childId,
						mode
					});
				} : void 0,
				children: content
			});
		}
		function PhaseSection({ contentRef, onContentBlur, onToggle, open, pendingCleanCollapse, phase, navigable, openSession, parentSessionId, t }) {
			return (0, react_jsx_runtime.jsx)("div", {
				className: WorkflowRunPanel_module_css_default.phase,
				onMouseDownCapture: pendingCleanCollapse ? preventPendingHeaderFocus : void 0,
				children: (0, react_jsx_runtime.jsx)(StatusDisclosure, {
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {}),
					title: readablePhase(phase.phase, t),
					open,
					onToggle,
					expandOnRowClick: true,
					previewChevron: false,
					keepContentWhenOpen: true,
					rowClassName: WorkflowRunPanel_module_css_default.phaseHeader,
					contentClassName: WorkflowRunPanel_module_css_default.headerContent,
					contentLayoutClassName: WorkflowRunPanel_module_css_default.headerContentLayout,
					leadingClassName: WorkflowRunPanel_module_css_default.phaseLeading,
					titleClassName: WorkflowRunPanel_module_css_default.phaseTitle,
					collapsedContent: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: WorkflowRunPanel_module_css_default.separator,
							"aria-hidden": true
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: WorkflowRunPanel_module_css_default.phaseCount,
							"data-phase-count": true,
							children: memberCount(phase.members.length, t)
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: WorkflowRunPanel_module_css_default.phaseStatus,
							"data-phase-status-text": true,
							children: phaseStatusSummary(phase.members, t)
						})
					] }),
					children: (0, react_jsx_runtime.jsx)("div", {
						ref: contentRef,
						className: WorkflowRunPanel_module_css_default.members,
						onBlur: onContentBlur,
						children: phase.members.map((member) => (0, react_jsx_runtime.jsx)(MemberRow, {
							member,
							mode: navigable.get(member.childId),
							openSession,
							parentSessionId,
							t
						}, member.seq))
					})
				})
			});
		}
		/** Render one durable workflow run with status-driven run and phase disclosure. */
		function WorkflowRunPanel({ node, sessionId, useSessions, useSessionStatus, openSession, t }) {
			const phaseFacts = (0, react.useMemo)(() => node.data.phases.map((phase) => [phase.key, phaseDisclosureFacts(phase)]), [node.data.phases]);
			const runFacts = (0, react.useMemo)(() => runDisclosureFacts(node.data.status, phaseFacts), [node.data.status, phaseFacts]);
			const totalMembers = runFacts.activityCount;
			const [disclosures, setDisclosures] = (0, react.useState)(() => ({
				run: initialDisclosureState(runFacts),
				phases: new Map(phaseFacts.map(([key, facts]) => [key, initialDisclosureState(facts)]))
			}));
			const runContentRef = (0, react.useRef)(null);
			const phaseContentRefs = (0, react.useRef)(/* @__PURE__ */ new Map());
			const statuses = useSessionStatus((value) => value);
			const navigable = useSessions((sessions) => navigableMembers(sessions, node.data.phases, sessionId, statuses), _deepseek_ai_dsh_client_store.shallowEqual);
			(0, react.useLayoutEffect)(() => {
				setDisclosures((current) => {
					const phases = /* @__PURE__ */ new Map();
					let phasesChanged = current.phases.size !== phaseFacts.length;
					let phaseStartedCycle = false;
					for (const [key, facts] of phaseFacts) {
						const previous = current.phases.get(key);
						const next = previous === void 0 ? initialDisclosureState(facts) : advanceDisclosureState(previous, facts, focusIsWithin(phaseContentRefs.current.get(key)));
						phases.set(key, next);
						if (next !== previous) phasesChanged = true;
						if (previous?.mode === "clean" && (facts.mode !== "clean" || facts.activityCount !== previous.activityCount)) phaseStartedCycle = true;
					}
					const advancedRun = advanceDisclosureState(current.run, runFacts, focusIsWithin(runContentRef.current));
					const run = phaseStartedCycle && runFacts.mode !== "clean" && !advancedRun.open ? {
						...advancedRun,
						open: true,
						pendingCleanCollapse: false
					} : advancedRun;
					return run !== current.run || phasesChanged ? {
						run,
						phases
					} : current;
				});
			}, [
				disclosures.run.open,
				phaseFacts,
				runFacts
			]);
			const toggleRun = () => {
				setDisclosures((current) => ({
					...current,
					run: {
						...current.run,
						open: !current.run.open,
						pendingCleanCollapse: false
					}
				}));
			};
			const togglePhase = (key) => {
				setDisclosures((current) => {
					const phases = new Map(current.phases);
					const phase = existingPhaseState(phases, key);
					phases.set(key, {
						...phase,
						open: !phase.open,
						pendingCleanCollapse: false
					});
					return {
						...current,
						phases
					};
				});
			};
			const settleRunBlur = (event) => {
				if (event.currentTarget.contains(event.relatedTarget)) return;
				setDisclosures((current) => {
					const run = collapsePending(current.run);
					return run === current.run ? current : {
						...current,
						run
					};
				});
			};
			const settlePhaseBlur = (key, event) => {
				if (event.currentTarget.contains(event.relatedTarget)) return;
				setDisclosures((current) => {
					const phase = existingPhaseState(current.phases, key);
					const next = collapsePending(phase);
					if (next === phase) return current;
					const phases = new Map(current.phases);
					phases.set(key, next);
					return {
						...current,
export {};
