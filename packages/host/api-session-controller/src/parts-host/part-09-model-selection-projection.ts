/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-session-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/model-selection-projection.js
/** Durable model-selection intent and request-use projection. */
const modelSelectionSchema = z$1.object({
	provider: z$1.string().min(1),
	model: z$1.string().min(1),
	reasoningEffort: z$1.string().min(1).optional()
});
const modelSelectionProjectionStateSchema = z$1.object({
	lastUsed: modelSelectionSchema.nullable(),
	pending: modelSelectionSchema.nullable()
});
const modelSelectionProjectionSchema = z$1.object({
	lastUsed: modelSelectionSchema.nullable(),
	next: modelSelectionSchema.nullable()
});
/**
* Advance durable model-selection state by one Session event.
* @param state - selection state before the event.
* @param event - next committed Session event.
* @returns the original or advanced selection state.
*/
function applyModelSelectionProjection(state, event) {
	if (event.type === "model/selection") return sameSelection(state.pending, event.data) ? state : {
		lastUsed: state.lastUsed,
		pending: event.data
	};
	if (event.type !== "request/header") return state;
	const lastUsed = {
		provider: event.data.header.config.provider,
		model: event.data.header.config.model,
		...event.data.header.config.reasoningEffort === void 0 ? {} : { reasoningEffort: String(event.data.header.config.reasoningEffort) }
	};
	const pending = sameSelection(state.pending, lastUsed) ? null : state.pending;
	return sameSelection(state.lastUsed, lastUsed) && pending === state.pending ? state : {
		lastUsed,
		pending
	};
}
const modelSelectionProjection = {
	key: "modelSelection",
	stateSchema: modelSelectionProjectionStateSchema,
	init: () => ({
		lastUsed: null,
		pending: null
	}),
	apply: applyModelSelectionProjection,
	wire: {
		viewSchema: modelSelectionProjectionSchema,
		view: (state) => ({
			lastUsed: state.lastUsed,
			next: state.pending ?? state.lastUsed
		})
	},
	stateVersion: 2
};
function sameSelection(left, right) {
	return left === right || left !== null && right !== null && left.provider === right.provider && left.model === right.model && left.reasoningEffort === right.reasoningEffort;
}
/**
* Register the durable model-selection projection when the registry is present.
* @param ctx - Session Controller context.
*/
function installModelSelectionProjection(ctx) {
	ctx.sessionProjections.register(modelSelectionProjection);
}
//#endregion

export {};
