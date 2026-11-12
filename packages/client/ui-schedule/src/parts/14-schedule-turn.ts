/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/schedule-turn.js
		/**
		* Turn-scoped created-task projection for the `schedule_create` card.
		*
		* This Definition publishes the task a settled call created against its Turn,
		* so the card renders as a turn-level element through ui-chat's
		* `conversation.chat.turnTail` list seat. The task is narrowed from
		* the persisted result JSON, so Session-log replay reproduces the card with no
		* Host change and no presentation metadata. The call's own Tool-group cell
		* belongs to ui-tool's generic keyed tool view, so this package contributes
		* only the Turn-level card.
		*/
		/** Wire Tool name whose settled result carries one created task. */
		const SCHEDULE_CREATE_TOOL = "schedule_create";
		/**
		* Created tasks of one Turn up to a bound sequence.
		*
		* The Conversation Location index owns Turn membership before this runs, so
		* tasks cannot spill across Turns.
		* @param data - engine-published created-task data for one Turn.
		* @param seq - bound sequence; settlements after it are excluded.
		* @returns created result nodes in settlement order; empty when the Turn created none.
		*/
		function scheduleTasksForClosing(data, seq = Number.POSITIVE_INFINITY) {
			return data === void 0 ? [] : data.created.filter((created) => created.seq <= seq);
		}
		/**
		* Select the tasks one Turn created, for the Turn-tail list entry to render.
		*
		* The bounded sequence is the Turn's own end, not the closing Assistant text: a
		* Turn whose last text response precedes a `schedule_create` settlement still
		* owns that creation when it ends on a failed request or a user stop, and the
		* turn-tail seat exists only for a completed Turn. A Turn without a recorded end
		* falls back to the owner's own sequence.
		* @param owner - Turn-tail owner currency for the closing Assistant.
		* @returns created tasks, or null when the Turn created none.
		*/
		function selectScheduleTasks(owner) {
			const created = scheduleTasksForClosing(owner.turn.data.get("schedule-created"), owner.turn.end?.seq ?? owner.seq);
			return created.length === 0 ? null : { created };
		}
		/**
		* Build the card's result node for one settled root call, or undefined when
		* the result is not a complete created task. Malformed and failed results fall
		* through: with no task identity the Turn tail renders no card.
		* @param match - the settling `tool/result` update match.
		* @param call - paired in-window call head.
		* @returns the settled node, or undefined when it names no task.
		*/
		function createdTask(match, call) {
			/* v8 ignore next -- The only call site reaches this after narrowing the same event to `tool/result`. */
			if (match.event.type !== "tool/result") return void 0;
			const message = match.event.data.message;
			if (message.isError === true) return void 0;
			const settled = {
				kind: "tool-result",
				seq: match.event.seq,
				time: match.event.time,
				callId: String(match.event.data.message.source.callId),
				name: call.name,
				args: PartialArguments.fromText(call.argsRaw),
				call: {
					name: call.name,
					argsRaw: call.argsRaw
				},
				callTime: call.time,
				content: message.content,
				isError: false,
				subCalls: []
			};
			return scheduleCreateCardModel(settled, "schedule_create").task === void 0 ? void 0 : settled;
		}
		/** Turn-local `schedule_create` accumulator; it publishes no view Node. */
		const scheduleTurnDefinition = {
			kind: "schedule-created",
			match: (event) => {
				if (event.type === "turn/start") return {
					id: String(event.data.turn),
					role: "start"
				};
				if (event.type === "tool/call") return {
					id: String(event.data.turn),
					role: "update"
				};
				if (event.type === "tool/result" && isAppendSurfaceEvent(event)) return {
					id: String(event.data.turn),
					role: "update"
				};
				return null;
			},
			start: (_context, match) => {
				if (match.event.type !== "turn/start") throw new Error("schedule-created start requires turn/start");
				return {
					turn: match.event.data.turn,
					calls: /* @__PURE__ */ new Map(),
					created: []
				};
			},
			update: (context, match) => {
				if (match.event.type === "tool/call") {
					const calls = new Map(context.state.calls);
					calls.set(String(match.event.data.callId), {
						name: match.event.data.name,
						argsRaw: match.event.data.arguments,
						time: match.event.seq
					});
					return {
						...context.state,
						calls
					};
				}
				if (match.event.type !== "tool/result") return context.state;
				const call = context.state.calls.get(String(match.event.data.message.source.callId));
				if (call?.name !== "schedule_create") return context.state;
				const block = createdTask(match, call);
				return block === void 0 ? context.state : {
					...context.state,
					created: [...context.state.created, block]
				};
			},
			buildLocationData: (context, scope, previous) => {
				if (scope !== "turn" || context.state === void 0) return null;
				if (previous?.kind === "turn" && previous.turn === context.state.turn && previous.key === "schedule-created" && previous.value.created === context.state.created) return previous;
				return {
					kind: "turn",
					turn: context.state.turn,
					key: "schedule-created",
					value: { created: context.state.created }
				};
			}
		};
		//#endregion
