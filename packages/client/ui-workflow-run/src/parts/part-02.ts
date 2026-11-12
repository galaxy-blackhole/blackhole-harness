/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						phases
					};
				});
			};
			return (0, react_jsx_runtime.jsx)("section", {
				className: WorkflowRunPanel_module_css_default.root,
				"data-workflow-run": true,
				"data-run-status": node.data.status,
				onMouseDownCapture: disclosures.run.pendingCleanCollapse ? preventPendingHeaderFocus : void 0,
				children: (0, react_jsx_runtime.jsx)(RunHeader, {
					count: totalMembers,
					name: node.data.name,
					open: disclosures.run.open,
					onToggle: toggleRun,
					status: node.data.status,
					t,
					children: (0, react_jsx_runtime.jsx)("div", {
						ref: runContentRef,
						className: WorkflowRunPanel_module_css_default.phaseList,
						onBlur: settleRunBlur,
						children: node.data.phases.length === 0 ? (0, react_jsx_runtime.jsx)("span", {
							className: WorkflowRunPanel_module_css_default.empty,
							children: t("run.empty")
						}) : node.data.phases.map((phase) => {
							const facts = phaseDisclosureFacts(phase);
							const disclosure = disclosures.phases.get(phase.key) ?? initialDisclosureState(facts);
							return (0, react_jsx_runtime.jsx)(PhaseSection, {
								contentRef: (element) => {
									if (element === null) phaseContentRefs.current.delete(phase.key);
									else phaseContentRefs.current.set(phase.key, element);
								},
								onContentBlur: (event) => {
									settlePhaseBlur(phase.key, event);
								},
								onToggle: () => {
									togglePhase(phase.key);
								},
								open: disclosure.open,
								pendingCleanCollapse: disclosure.pendingCleanCollapse,
								phase,
								navigable,
								openSession,
								parentSessionId: sessionId,
								t
							}, phase.key);
						})
					})
				})
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `workflowRun` namespace dictionaries. */
		/** Dictionary namespace owned by this plugin. */
		const NS = "workflowRun";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"run.title": "{name}",
			"run.members.one": "{count} 个成员",
			"run.members.other": "{count} 个成员",
			"run.empty": "没有启动成员",
			"phase.unassigned": "未分阶段",
			"phase.empty": "空阶段名",
			"statusCount.running": "运行中 {count}",
			"statusCount.completed": "已完成 {count}",
			"statusCount.failed": "失败 {count}",
			"statusCount.cancelled": "已取消 {count}",
			"statusCount.interrupted": "已中断 {count}",
			"member.empty": "空成员名",
			"member.open": "打开 {name}",
			"status.running": "运行中",
			"status.completed": "已完成",
			"status.failed": "失败",
			"status.cancelled": "已取消",
			"status.interrupted": "已中断"
		};
		/** English dictionary (same key set). */
		const en = {
			"run.title": "{name}",
			"run.members.one": "{count} member",
			"run.members.other": "{count} members",
			"run.empty": "No members started",
			"phase.unassigned": "Unphased",
			"phase.empty": "Empty phase name",
			"statusCount.running": "Running {count}",
			"statusCount.completed": "Completed {count}",
			"statusCount.failed": "Failed {count}",
			"statusCount.cancelled": "Cancelled {count}",
			"statusCount.interrupted": "Interrupted {count}",
			"member.empty": "Empty member name",
			"member.open": "Open {name}",
			"status.running": "Running",
			"status.completed": "Completed",
			"status.failed": "Failed",
			"status.cancelled": "Cancelled",
			"status.interrupted": "Interrupted"
		};
		//#endregion
		//#region lib/types/client/workflow-definition.js
		/**
		* Build a collision-free phase key preserving absent versus empty identity.
		* @param phase - exact phase string, or null for an omitted field.
		* @returns the stable renderer key for that phase identity.
		*/
		function workflowPhaseKey(phase) {
			return phase === null ? "missing" : `value:${phase.length}:${phase}`;
		}
		function statusFromStopReason(stopReason) {
			switch (stopReason) {
				case "completed": return "completed";
				case "cancelled": return "cancelled";
				case "error": return "failed";
				/* v8 ignore next -- WorkflowStopReason is closed and every variant is handled above. */
				default: return stopReason;
			}
		}
		function statusFromOutcome(outcome) {
			switch (outcome) {
				case "completed": return "completed";
				case "cancelled": return "cancelled";
				case "failed": return "failed";
				/* v8 ignore next -- WorkflowAgentOutcome is closed and every variant is handled above. */
				default: return outcome;
			}
		}
		/**
		* A foreground run writes its run-end before its Tool Step ends, and a
		* background run outlives that Step, so an ordinary Step or Turn closure says
		* nothing about liveness. Only a Turn closed after a crash or at a fork
		* boundary proves that a run without run-end stopped.
		*/
		function turnAbandoned(location) {
			if (location.kind !== "step" && location.kind !== "turn") return false;
			const reason = location.turn.end?.data.reason.kind;
			return reason === "interrupted" || reason === "forked";
		}
		function projectWorkflow(context, location) {
			const state = context.state;
			const interrupted = state.stopReason === void 0 && turnAbandoned(location);
			const phases = /* @__PURE__ */ new Map();
			for (const member of state.members) {
				const phase = member.phase === void 0 ? null : member.phase;
				const key = workflowPhaseKey(phase);
				let group = phases.get(key);
				if (group === void 0) {
					group = {
						phase,
						members: []
					};
					phases.set(key, group);
				}
				group.members.push({
					seq: member.seq,
					label: member.label,
					childId: member.childId,
					status: member.outcome === void 0 ? interrupted ? "interrupted" : "running" : statusFromOutcome(member.outcome)
				});
			}
			const projectedPhases = [...phases].map(([key, phase]) => ({
				key,
				phase: phase.phase,
				members: phase.members
			}));
			return {
				name: state.name,
				status: state.stopReason === void 0 ? interrupted ? "interrupted" : "running" : statusFromStopReason(state.stopReason),
				phases: projectedPhases
			};
		}
		function updateAgentStart(state, data) {
			const member = {
				seq: data.seq,
				label: data.label,
				...data.phase === void 0 ? {} : { phase: data.phase },
				childId: data.childId
			};
			return {
				...state,
				members: [...state.members, member]
			};
		}
		function updateAgentEnd(state, data) {
			return {
				...state,
				members: state.members.map((member) => member.seq === data.seq ? {
					...member,
					outcome: data.outcome
				} : member)
			};
		}
		/** Durable workflow event family folded into one keyed Chat node. */
		const workflowRunDefinition = {
			kind: "workflow-run",
			target: "chat",
			match: (event) => {
				if (event.type === "tool-workflow/run-start") return {
					id: String(event.data.runId),
					role: "start"
				};
				if (event.type === "tool-workflow/agent-start" || event.type === "tool-workflow/agent-end" || event.type === "tool-workflow/run-end") return {
					id: String(event.data.runId),
					role: "update"
				};
				return null;
			},
			start: (_context, match) => {
				if (match.event.type !== "tool-workflow/run-start") throw new Error("workflow-run start requires tool-workflow/run-start");
				return {
					name: match.event.data.name,
					members: []
				};
			},
			update: (context, match) => {
				if (match.event.type === "tool-workflow/agent-start") return updateAgentStart(context.state, match.event.data);
				if (match.event.type === "tool-workflow/agent-end") return updateAgentEnd(context.state, match.event.data);
				if (match.event.type === "tool-workflow/run-end") return {
					...context.state,
					stopReason: match.event.data.stopReason
				};
				return context.state;
			},
			buildViewNode: (context) => {
				if (context.start === void 0) return null;
				const data = projectWorkflow(context, context.start.location);
				return {
					key: context.key,
					kind: "workflow-run",
					id: context.id,
					target: "chat",
					anchorSeq: context.start.event.seq,
					location: context.start.location,
					visibility: "visible",
					data
				};
			}
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Browser plugin for durable workflow-run Conversation Nodes. */
		/** Required services for Definition, keyed renderer, navigation, and copy. */
		const inject = [
			"uiConversation",
			"uiWorkspace",
			"slots",
			"sessions",
			"locale"
		];
		/** Register the workflow Definition, dictionary, and keyed Chat renderer. */
		function apply(ctx) {
			ctx.uiConversation.events.register(workflowRunDefinition);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-workflow-run: dictionaries");
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "workflow-run",
				locale: NS,
				inject: () => ({ openSession: (target) => {
					ctx.uiWorkspace.openSession(target);
				} })
			}, WorkflowRunPanel));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
