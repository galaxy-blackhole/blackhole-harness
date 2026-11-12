/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua artefact typert.host.js @deepseek-ai/dsh-api-session-controller — khong sua tay
 */
// @ts-nocheck

const _deepseek_ai_dsh_api_session_controller_session_list_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_list_result$schema$value ??= z.object({
  'items': z.array(z.object({
  'agentAvailable': z.boolean().readonly().describe('Whether this Session currently owns a live Agent.'),
  'formatStatus': z.union([z.literal("current"), z.literal("migration-required")]).readonly().optional().describe('Current for attached Sessions; otherwise the persistence format status when reported.'),
  'sessionId': z.string().readonly(),
  'updatedAt': z.number().readonly(),
  'running': z.boolean().readonly(),
  'blank': z.boolean().readonly(),
  'parentSessionId': z.string().readonly().optional(),
  'origin': z.literal("subagent").readonly().optional(),
  'cwd': z.string().readonly().optional(),
  'projections': z.object({
  'kind': z.union([z.literal("cached"), z.literal("sequenced")]).readonly().describe('`sequenced`: the Host\'s live registry produced the block for an attached Session, so `asOfSeq` is comparable with baselines and frames of the same connection. `cached`: a header-only listing viewed the block from the persisted projection cache, so `asOfSeq` is the stored record\'s own watermark and must not be compared with the connected Session\'s values.'),
  'asOfSeq': z.number().readonly().describe('Watermark of the block in the sequence space named by `kind`.'),
  'values': z.intersection(z.object({
  'inbox': z.object({
  'next-turn': z.array(z.json()).readonly(),
  'next-step': z.array(z.json()).readonly(),
}).optional().describe('Pending agent input reconstructed from durable inbox splices.'),
  'workingDirectory': z.union([z.literal(null), z.string()]).optional().describe('Recorded current directory for Session observations, or null when none is recorded.'),
  'agentPreset': z.union([z.literal(null), z.string()]).optional().describe('Preset the Session runs, or null when the deployment composes none.'),
  'title': z.union([z.literal(null), z.string()]).optional().describe('The session\'s current normalized title — the latest `session/title` event\'s text (last-wins), or `null` before the first title lands. A plain string: the shape the client list rows consume.'),
  'todos': z.union([z.literal(null), z.array(z.object({
  'content': z.string().describe('What this task is — a short imperative line shown in the UI.'),
  'status': z.union([z.literal("completed"), z.literal("pending"), z.literal("in_progress")]).describe('Lifecycle state. `in_progress` marks a task being worked now; parallel work may mark several.'),
}))]).optional().describe('The agent\'s current whole todo list (the latest `todo/write` snapshot), or `null` before the first write. Whole-value rule: every `todo/write` carries the complete replacement list, so the fold is last-wins.'),
  'sessionListMetadata': z.object({
  'blank': z.boolean().readonly().describe('Whether the folded prefix contains no turn.'),
  'lastPromptAt': z.union([z.literal(null), z.number()]).readonly().describe('Latest human-authored prompt time in the folded prefix.'),
}).optional().describe('Persisted facts used to summarize a Session without activating it.'),
  'imageLimits': z.object({
  'maxImageBytes': z.number(),
  'maxImagesPerMessage': z.number(),
  'maxMessageImageBytes': z.number(),
  'maxImagePixels': z.number(),
  'maxImageDimension': z.number().describe('Maximum intrinsic width and maximum intrinsic height in pixels for one image.'),
  'mediaTypes': z.array(z.union([z.literal("image/png"), z.literal("image/jpeg"), z.literal("image/webp"), z.literal("image/gif")])),
}).optional().describe('Image-intake limits enforced by the Session prompt endpoint.'),
  'modelSelection': z.object({
  'lastUsed': z.union([z.literal(null), z.object({
  'provider': z.string().readonly(),
  'model': z.string().readonly(),
  'reasoningEffort': z.string().readonly().optional(),
})]).readonly().describe('Selection consumed by the latest recorded model request.'),
  'next': z.union([z.literal(null), z.object({
  'provider': z.string().readonly(),
  'model': z.string().readonly(),
  'reasoningEffort': z.string().readonly().optional(),
})]).readonly().describe('Selection the next request should use, falling back to {@link lastUsed}.'),
}).optional().describe('Durable model selection already used and selected for the next request.'),
  'permissions': z.object({
  'currentValue': z.string().describe('The effective current value: a configured preset key, `auto`, or `custom`.'),
}).optional().describe('The session\'s current permission, folded from the three whole-value knob events (`permission/preset`, `sandbox/mode`, `approval/policy`) over the composition defaults. Selectable options come from the process-level catalog Remote. Key absence means no permission service is composed — clients hide the control.'),
  'subagentCatalog': z.array(z.union([z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("one-shot").readonly(),
  'label': z.string().readonly().optional(),
}), z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("external").readonly(),
  'label': z.string().readonly().optional(),
}), z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("continuable").readonly(),
  'label': z.string().readonly(),
}), z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("unknown").readonly(),
  'label': z.string().readonly().optional(),
})])).optional().describe('Direct children in parent catalog event order, excluding fork-inherited facts.'),
  'subagentTiming': z.object({
  'settledMs': z.number().describe('Milliseconds accumulated across completed turns after the child\'s own descriptor.'),
  'active': z.object({
  'since': z.number().describe('Start of the open turn.'),
  'through': z.number().describe('Latest event time folded into this projection cut.'),
}).optional().describe('Same-cut bounds of the currently open turn, when one has not reached `turn/end`.'),
  'lastTurnCompleted': z.boolean().optional().describe('Whether the latest closed turn after the child\'s own descriptor completed normally; absent while a turn is open or before one closes.'),
}).optional().describe('Active-turn duration and latest closed-turn completion for a descriptor-backed subagent session.'),
  'subagent': z.union([z.literal(null), z.object({
  'mode': z.literal("one-shot").describe('A terminal one-shot child.'),
  'label': z.string().optional().describe('Optional durable creation label from the child\'s descriptor.'),
  'seq': z.number().describe('Seq of the `subagent/descriptor` event this identity was folded from. `session.isOwnSeq(seq)` proves the identity comes from the child\'s OWN log suffix — where a descriptor is immutable once appended — and not from a fork seed\'s replayed ancestor descriptor.'),
}), z.object({
  'mode': z.literal("continuable").describe('A resumable conversation.'),
  'label': z.string().describe('Durable creation label from the child\'s descriptor.'),
  'seq': z.number().describe('Seq of the folded descriptor event; see the one-shot arm for the own-suffix proof.'),
})]).optional().describe('Identity of a descriptor-backed subagent session. `null` ⟺ no valid descriptor (missing, malformed, or unrecognized-version — deliberately undistinguished). The sentinel is deliberately serializable: a value pushed over JSON transports must survive `JSON.stringify` losslessly, where an `undefined` field would be dropped and a stale identity would survive on the receiving side. The entry itself stays non-optional.'),
  'tokenUsage': z.object({
  'uncachedInputTokens': z.number(),
  'outputTokens': z.number(),
  'cacheReadTokens': z.number(),
  'cacheWriteTokens': z.number(),
}).optional().describe('Provider-reported usage accumulated across the complete durable log.'),
  'contextPressure': z.object({
  'pressureTokens': z.number().optional().describe('Provider-reported prompt size of the most recent request: uncached input plus cache reads and writes. Response output is excluded, so this does not grow as the current turn streams. Absent until a provider reports usage.'),
  'projectedTokens': z.number().optional().describe('What the NEXT request\'s prompt would cost: {@link pressureTokens} plus the heuristic repricing of everything the surface gained or lost since that sample. Only the delta is estimated, so the figure stays anchored to the provider while still reacting the moment a compaction shadows a span — which `pressureTokens` alone cannot do, since compaction reports no usage of its own. Absent until a provider reports usage.'),
  'contextWindow': z.number().optional().describe('Newest recorded route capacity; absent when no adapter advertised one.'),
}).optional().describe('Newest request pressure paired with the newest known route capacity.'),
  'contextBreakdown': z.object({
  'systemTokens': z.number().describe('Heuristic tokens of the last nonempty surviving system prompt in surface order; 0 when none exists.'),
  'toolsTokens': z.number().describe('Heuristic tokens of the newest request envelope\'s tool schemas; 0 before any request.'),
  'messageTokens': z.number().describe('Heuristic tokens of every other visible surface node, including superseded system prompts.'),
}).optional().describe('Heuristic system/tools/message composition of the next request.'),
  'agentTeam': z.object({
  'members': z.array(z.object({
  'id': z.string().readonly(),
  'name': z.string().readonly(),
  'role': z.union([z.literal("lead"), z.literal("teammate")]).readonly(),
  'phase': z.union([z.literal("failed"), z.literal("provisioning"), z.literal("active")]).readonly().describe('Durable lifecycle; the Lead row is always `active`. Turn activity comes from Session status.'),
  'error': z.string().readonly().optional(),
})).readonly(),
  'tasks': z.array(z.object({
  'id': z.string().readonly(),
  'revision': z.number().readonly(),
  'subject': z.string().readonly(),
  'description': z.string().readonly(),
  'status': z.union([z.literal("completed"), z.literal("pending"), z.literal("in_progress"), z.literal("deleted")]).readonly(),
  'blockedBy': z.array(z.string()).readonly(),
  'writeScopes': z.array(z.string()).readonly(),
  'ownerName': z.string().readonly().optional(),
  'ready': z.boolean().readonly(),
  'writeScopeWarnings': z.array(z.string()).readonly(),
})).readonly(),
  'failure': z.string().readonly().optional(),
}).optional().describe('Durable roster and non-deleted task board of the Team rooted at the projected Session.'),
  'userQuestions': z.object({
  'active': z.array(z.object({
  'callId': z.string().readonly(),
  'questions': z.array(z.object({
  'id': z.string().describe('Stable caller-provided question id, echoed in the answer.'),
  'question': z.string().describe('The question to display.'),
  'detail': z.string().optional().describe('Optional supporting detail rendered with the question but kept out of option labels.'),
  'header': z.string().optional().describe('Optional short heading/group label.'),
  'options': z.array(z.object({
  'label': z.string().describe('User-facing label.'),
  'description': z.string().optional().describe('Optional extra context rendered by capable UIs.'),
})).optional().describe('Optional choices the UI can render as a menu.'),
  'multiSelect': z.boolean().optional().describe('Whether more than one option may be selected. Defaults to single-select.'),
  'intent': z.object({
  'kind': z.literal("plan-review").describe('A plan submitted for review: `detail` is the plan markdown `ask()` requires, and the decision approves or declines it.'),
  'approve': z.string().describe('The option label that approves the plan; every other option declines it. Named rather than positional so no UI infers the verdict from option order. An `approve` naming no option of its own question is rejected at `ask()`.'),
  'callId': z.string().optional().describe('Logged tool invocation whose arguments contain the reviewed plan.'),
}).optional().describe('Optional presentation intent for capable UIs; absent asks for the generic option list.'),
})).readonly(),
  'state': z.union([z.literal("open"), z.literal("continued")]).readonly(),
})).readonly().describe('Calls that can still take an answer, in ask order.'),
  'settled': z.array(z.object({
  'callId': z.string().readonly().describe('The settled call.'),
  'answers': z.array(z.object({
  'id': z.string().describe('The answered question id.'),
  'selected': z.array(z.string()).describe('Selected option labels. May accompany custom text for a multi-select question.'),
  'custom': z.string().optional().describe('Optional free-text "Other" answer.'),
})).readonly().describe('The recorded batch, one entry per question; empty when the late reply carried none.'),
})).readonly().describe('Calls an answer settled, in settlement order.'),
}).optional().describe('Timed questions that remain answerable in this Session, and the ones a late reply settled.'),
  'goal': z.union([z.literal(null), z.object({
  'goal': z.object({
  'objective': z.string().readonly().describe('Human-requested completion objective.'),
  'phase': z.union([z.literal("active"), z.literal("paused"), z.literal("blocked"), z.literal("complete")]).readonly().describe('Durable lifecycle phase.'),
  'blockedReason': z.object({
  'code': z.string().readonly().describe('Stable lower-kebab-case classification chosen by the blocking policy.'),
  'message': z.string().readonly().describe('Non-empty explanation shown to humans and models.'),
}).readonly().optional().describe('Present exactly while `phase` is `blocked`.'),
  'maxGoalRounds': z.number().readonly().describe('Total admitted goal-round cap.'),
  'id': z.string().readonly().describe('Stable goal identity.'),
  'revision': z.number().readonly().describe('Positive revision; every durable mutation increments it.'),
}).readonly().describe('Current durable goal snapshot (the CAS ref for mutations rides on it).'),
  'roundsStarted': z.number().readonly().describe('Highest admitted round number for this goal.'),
  'createdAt': z.number().readonly().describe('Epoch milliseconds of the create mutation.'),
  'updatedAt': z.number().readonly().describe('Epoch milliseconds of the latest mutation.'),
})]).optional().describe('The session\'s current goal and admitted-round count, or `null` before the first create and after a clear tombstone. `goal/change` supplies the whole lifecycle value; matching admitted `user/message` events advance `roundsStarted`.'),
  'plan': z.object({
  'active': z.boolean(),
  'pending': z.boolean(),
}).optional().describe('Plan collaboration state folded from the plan command lifecycle and `plan/mode` events.'),
}), z.record(z.string(), z.json()).readonly()).readonly().describe('Provider-validated values present in the block; omitted keys remain unknown.'),
}).readonly().optional(),
})).readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_modelCatalog_result$schema$value
const _deepseek_ai_dsh_api_session_controller_session_modelCatalog_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_modelCatalog_result$schema$value ??= z.object({
  'default': z.object({
  'provider': z.string().readonly(),
  'model': z.string().readonly(),
  'reasoningEffort': z.string().readonly().optional(),
}).readonly(),
  'routableProviders': z.array(z.string()).readonly().describe('Provider routes with at least one currently available catalog model.'),
  'groups': z.array(z.object({
  'id': z.string().readonly(),
  'name': z.string().readonly(),
  'models': z.array(z.object({
  'id': z.string().readonly(),
  'name': z.string().readonly(),
  'description': z.string().readonly().optional(),
  'reasoning': z.object({
  'efforts': z.array(z.object({
  'id': z.string().readonly(),
  'name': z.string().readonly(),
  'description': z.string().readonly().optional(),
})).readonly(),
  'defaultEffort': z.string().readonly().optional(),
}).readonly().optional(),
})).readonly(),
})).readonly(),
  'failures': z.array(z.object({
  'id': z.string().readonly(),
  'name': z.string().readonly(),
  'message': z.string().readonly(),
})).readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_openWorkspacePath_parameter_0$schema$value
const _deepseek_ai_dsh_api_session_controller_session_openWorkspacePath_parameter_0$schema = () => (_deepseek_ai_dsh_api_session_controller_session_openWorkspacePath_parameter_0$schema$value ??= z.object({
  'action': z.literal("reveal").readonly().optional().describe('File-manager navigation when requested; omission uses the default application.'),
  'application': z.string().readonly().optional().describe('Registered application identifier; ignored for reveal. Omission preserves the operating system default.'),
  'path': z.string().readonly().describe('Path after best-effort Session workspace resolution, in Host filesystem syntax.'),
}))
let _deepseek_ai_dsh_api_session_controller_session_openWorkspacePath_result$schema$value
const _deepseek_ai_dsh_api_session_controller_session_openWorkspacePath_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_openWorkspacePath_result$schema$value ??= z.object({
  'opened': z.literal(true).readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_page_parameter_0$schema$value
const _deepseek_ai_dsh_api_session_controller_session_page_parameter_0$schema = () => (_deepseek_ai_dsh_api_session_controller_session_page_parameter_0$schema$value ??= z.object({
  'address': z.union([z.object({
  'kind': z.literal("session").readonly(),
  'sessionId': z.string().readonly(),
}), z.object({
  'kind': z.literal("subagent").readonly(),
  'parentSessionId': z.string().readonly(),
  'childSessionId': z.string().readonly(),
  'mode': z.union([z.literal("one-shot"), z.literal("continuable"), z.literal("unknown")]).readonly(),
})]).readonly(),
  'throughSeq': z.number().readonly().describe('Inclusive log cut obtained from the corresponding follow opening frame.'),
  'beforeSeq': z.number().readonly().optional(),
  'maxMessages': z.number().readonly().optional(),
  'turnWindow': z.object({
  'minMessages': z.number().readonly().describe('Minimum append-origin user/assistant messages; must not exceed maxMessages.'),
  'minTurns': z.number().readonly().describe('Minimum Turn starts crossed, including the partial Turn at beforeSeq.'),
}).readonly().optional().describe('Stop at a Turn start after both minima, unless maxMessages or history exhaustion wins.'),
}))
let _deepseek_ai_dsh_api_session_controller_session_page_result$schema$value
const _deepseek_ai_dsh_api_session_controller_session_page_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_page_result$schema$value ??= z.object({
  'records': z.array(z.object({
  'type': z.literal("event").readonly(),
  'event': z.object({
  'type': z.string().readonly(),
  'seq': z.number().readonly(),
  'time': z.number().readonly(),
  'data': z.json().readonly(),
  'ignorable': z.literal(true).readonly().optional(),
  'sourceEventSeqs': z.json().readonly().optional().describe('Earlier sources on current surface events; opaque JSON on unknown ignorable events.'),
  'surfaceOp': z.json().readonly().optional().describe('Canonical placement on current surface events; opaque JSON on unknown ignorable events.'),
}).readonly(),
})).readonly(),
  'hasMore': z.boolean().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_projections_parameter_0$schema$value
const _deepseek_ai_dsh_api_session_controller_session_projections_parameter_0$schema = () => (_deepseek_ai_dsh_api_session_controller_session_projections_parameter_0$schema$value ??= z.object({
  'sessionId': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_projections_result$schema$value
const _deepseek_ai_dsh_api_session_controller_session_projections_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_projections_result$schema$value ??= z.union([z.literal(null), z.object({
  'asOfSeq': z.number().readonly(),
  'values': z.intersection(z.object({
  'inbox': z.object({
  'next-turn': z.array(z.json()).readonly(),
  'next-step': z.array(z.json()).readonly(),
}).optional().describe('Pending agent input reconstructed from durable inbox splices.'),
  'workingDirectory': z.union([z.literal(null), z.string()]).optional().describe('Recorded current directory for Session observations, or null when none is recorded.'),
  'agentPreset': z.union([z.literal(null), z.string()]).optional().describe('Preset the Session runs, or null when the deployment composes none.'),
  'title': z.union([z.literal(null), z.string()]).optional().describe('The session\'s current normalized title — the latest `session/title` event\'s text (last-wins), or `null` before the first title lands. A plain string: the shape the client list rows consume.'),
  'todos': z.union([z.literal(null), z.array(z.object({
  'content': z.string().describe('What this task is — a short imperative line shown in the UI.'),
  'status': z.union([z.literal("completed"), z.literal("pending"), z.literal("in_progress")]).describe('Lifecycle state. `in_progress` marks a task being worked now; parallel work may mark several.'),
}))]).optional().describe('The agent\'s current whole todo list (the latest `todo/write` snapshot), or `null` before the first write. Whole-value rule: every `todo/write` carries the complete replacement list, so the fold is last-wins.'),
  'sessionListMetadata': z.object({
  'blank': z.boolean().readonly().describe('Whether the folded prefix contains no turn.'),
  'lastPromptAt': z.union([z.literal(null), z.number()]).readonly().describe('Latest human-authored prompt time in the folded prefix.'),
}).optional().describe('Persisted facts used to summarize a Session without activating it.'),
  'imageLimits': z.object({
  'maxImageBytes': z.number(),
  'maxImagesPerMessage': z.number(),
  'maxMessageImageBytes': z.number(),
  'maxImagePixels': z.number(),
  'maxImageDimension': z.number().describe('Maximum intrinsic width and maximum intrinsic height in pixels for one image.'),
  'mediaTypes': z.array(z.union([z.literal("image/png"), z.literal("image/jpeg"), z.literal("image/webp"), z.literal("image/gif")])),
}).optional().describe('Image-intake limits enforced by the Session prompt endpoint.'),
  'modelSelection': z.object({
  'lastUsed': z.union([z.literal(null), z.object({
  'provider': z.string().readonly(),
  'model': z.string().readonly(),
  'reasoningEffort': z.string().readonly().optional(),
})]).readonly().describe('Selection consumed by the latest recorded model request.'),
  'next': z.union([z.literal(null), z.object({
  'provider': z.string().readonly(),
  'model': z.string().readonly(),
  'reasoningEffort': z.string().readonly().optional(),
})]).readonly().describe('Selection the next request should use, falling back to {@link lastUsed}.'),
}).optional().describe('Durable model selection already used and selected for the next request.'),
  'permissions': z.object({
  'currentValue': z.string().describe('The effective current value: a configured preset key, `auto`, or `custom`.'),
}).optional().describe('The session\'s current permission, folded from the three whole-value knob events (`permission/preset`, `sandbox/mode`, `approval/policy`) over the composition defaults. Selectable options come from the process-level catalog Remote. Key absence means no permission service is composed — clients hide the control.'),
  'subagentCatalog': z.array(z.union([z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("one-shot").readonly(),
  'label': z.string().readonly().optional(),
}), z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("external").readonly(),
  'label': z.string().readonly().optional(),
}), z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("continuable").readonly(),
  'label': z.string().readonly(),
}), z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("unknown").readonly(),
  'label': z.string().readonly().optional(),
})])).optional().describe('Direct children in parent catalog event order, excluding fork-inherited facts.'),
  'subagentTiming': z.object({
  'settledMs': z.number().describe('Milliseconds accumulated across completed turns after the child\'s own descriptor.'),
  'active': z.object({
  'since': z.number().describe('Start of the open turn.'),
  'through': z.number().describe('Latest event time folded into this projection cut.'),
}).optional().describe('Same-cut bounds of the currently open turn, when one has not reached `turn/end`.'),
  'lastTurnCompleted': z.boolean().optional().describe('Whether the latest closed turn after the child\'s own descriptor completed normally; absent while a turn is open or before one closes.'),
}).optional().describe('Active-turn duration and latest closed-turn completion for a descriptor-backed subagent session.'),
  'subagent': z.union([z.literal(null), z.object({
  'mode': z.literal("one-shot").describe('A terminal one-shot child.'),
  'label': z.string().optional().describe('Optional durable creation label from the child\'s descriptor.'),
  'seq': z.number().describe('Seq of the `subagent/descriptor` event this identity was folded from. `session.isOwnSeq(seq)` proves the identity comes from the child\'s OWN log suffix — where a descriptor is immutable once appended — and not from a fork seed\'s replayed ancestor descriptor.'),
}), z.object({
  'mode': z.literal("continuable").describe('A resumable conversation.'),
  'label': z.string().describe('Durable creation label from the child\'s descriptor.'),
  'seq': z.number().describe('Seq of the folded descriptor event; see the one-shot arm for the own-suffix proof.'),
})]).optional().describe('Identity of a descriptor-backed subagent session. `null` ⟺ no valid descriptor (missing, malformed, or unrecognized-version — deliberately undistinguished). The sentinel is deliberately serializable: a value pushed over JSON transports must survive `JSON.stringify` losslessly, where an `undefined` field would be dropped and a stale identity would survive on the receiving side. The entry itself stays non-optional.'),
  'tokenUsage': z.object({
  'uncachedInputTokens': z.number(),
  'outputTokens': z.number(),
  'cacheReadTokens': z.number(),
  'cacheWriteTokens': z.number(),
}).optional().describe('Provider-reported usage accumulated across the complete durable log.'),
  'contextPressure': z.object({
  'pressureTokens': z.number().optional().describe('Provider-reported prompt size of the most recent request: uncached input plus cache reads and writes. Response output is excluded, so this does not grow as the current turn streams. Absent until a provider reports usage.'),
  'projectedTokens': z.number().optional().describe('What the NEXT request\'s prompt would cost: {@link pressureTokens} plus the heuristic repricing of everything the surface gained or lost since that sample. Only the delta is estimated, so the figure stays anchored to the provider while still reacting the moment a compaction shadows a span — which `pressureTokens` alone cannot do, since compaction reports no usage of its own. Absent until a provider reports usage.'),
  'contextWindow': z.number().optional().describe('Newest recorded route capacity; absent when no adapter advertised one.'),
}).optional().describe('Newest request pressure paired with the newest known route capacity.'),
  'contextBreakdown': z.object({
  'systemTokens': z.number().describe('Heuristic tokens of the last nonempty surviving system prompt in surface order; 0 when none exists.'),
  'toolsTokens': z.number().describe('Heuristic tokens of the newest request envelope\'s tool schemas; 0 before any request.'),
  'messageTokens': z.number().describe('Heuristic tokens of every other visible surface node, including superseded system prompts.'),
}).optional().describe('Heuristic system/tools/message composition of the next request.'),
  'agentTeam': z.object({
  'members': z.array(z.object({
  'id': z.string().readonly(),
  'name': z.string().readonly(),
  'role': z.union([z.literal("lead"), z.literal("teammate")]).readonly(),
  'phase': z.union([z.literal("failed"), z.literal("provisioning"), z.literal("active")]).readonly().describe('Durable lifecycle; the Lead row is always `active`. Turn activity comes from Session status.'),
  'error': z.string().readonly().optional(),
})).readonly(),
  'tasks': z.array(z.object({
  'id': z.string().readonly(),
  'revision': z.number().readonly(),
  'subject': z.string().readonly(),
  'description': z.string().readonly(),
  'status': z.union([z.literal("completed"), z.literal("pending"), z.literal("in_progress"), z.literal("deleted")]).readonly(),
  'blockedBy': z.array(z.string()).readonly(),
  'writeScopes': z.array(z.string()).readonly(),
  'ownerName': z.string().readonly().optional(),
  'ready': z.boolean().readonly(),
  'writeScopeWarnings': z.array(z.string()).readonly(),
})).readonly(),
  'failure': z.string().readonly().optional(),
}).optional().describe('Durable roster and non-deleted task board of the Team rooted at the projected Session.'),
  'userQuestions': z.object({
  'active': z.array(z.object({
  'callId': z.string().readonly(),
  'questions': z.array(z.object({
  'id': z.string().describe('Stable caller-provided question id, echoed in the answer.'),
  'question': z.string().describe('The question to display.'),
  'detail': z.string().optional().describe('Optional supporting detail rendered with the question but kept out of option labels.'),
  'header': z.string().optional().describe('Optional short heading/group label.'),
  'options': z.array(z.object({
  'label': z.string().describe('User-facing label.'),
  'description': z.string().optional().describe('Optional extra context rendered by capable UIs.'),
})).optional().describe('Optional choices the UI can render as a menu.'),
  'multiSelect': z.boolean().optional().describe('Whether more than one option may be selected. Defaults to single-select.'),
  'intent': z.object({
  'kind': z.literal("plan-review").describe('A plan submitted for review: `detail` is the plan markdown `ask()` requires, and the decision approves or declines it.'),
  'approve': z.string().describe('The option label that approves the plan; every other option declines it. Named rather than positional so no UI infers the verdict from option order. An `approve` naming no option of its own question is rejected at `ask()`.'),
  'callId': z.string().optional().describe('Logged tool invocation whose arguments contain the reviewed plan.'),
}).optional().describe('Optional presentation intent for capable UIs; absent asks for the generic option list.'),
})).readonly(),
  'state': z.union([z.literal("open"), z.literal("continued")]).readonly(),
})).readonly().describe('Calls that can still take an answer, in ask order.'),
  'settled': z.array(z.object({
  'callId': z.string().readonly().describe('The settled call.'),
  'answers': z.array(z.object({
  'id': z.string().describe('The answered question id.'),
  'selected': z.array(z.string()).describe('Selected option labels. May accompany custom text for a multi-select question.'),
  'custom': z.string().optional().describe('Optional free-text "Other" answer.'),
})).readonly().describe('The recorded batch, one entry per question; empty when the late reply carried none.'),
})).readonly().describe('Calls an answer settled, in settlement order.'),
}).optional().describe('Timed questions that remain answerable in this Session, and the ones a late reply settled.'),
  'goal': z.union([z.literal(null), z.object({
  'goal': z.object({
  'objective': z.string().readonly().describe('Human-requested completion objective.'),
  'phase': z.union([z.literal("active"), z.literal("paused"), z.literal("blocked"), z.literal("complete")]).readonly().describe('Durable lifecycle phase.'),
  'blockedReason': z.object({
  'code': z.string().readonly().describe('Stable lower-kebab-case classification chosen by the blocking policy.'),
  'message': z.string().readonly().describe('Non-empty explanation shown to humans and models.'),
}).readonly().optional().describe('Present exactly while `phase` is `blocked`.'),
  'maxGoalRounds': z.number().readonly().describe('Total admitted goal-round cap.'),
  'id': z.string().readonly().describe('Stable goal identity.'),
  'revision': z.number().readonly().describe('Positive revision; every durable mutation increments it.'),
}).readonly().describe('Current durable goal snapshot (the CAS ref for mutations rides on it).'),
  'roundsStarted': z.number().readonly().describe('Highest admitted round number for this goal.'),
  'createdAt': z.number().readonly().describe('Epoch milliseconds of the create mutation.'),
  'updatedAt': z.number().readonly().describe('Epoch milliseconds of the latest mutation.'),
})]).optional().describe('The session\'s current goal and admitted-round count, or `null` before the first create and after a clear tombstone. `goal/change` supplies the whole lifecycle value; matching admitted `user/message` events advance `roundsStarted`.'),
  'plan': z.object({
  'active': z.boolean(),
  'pending': z.boolean(),
}).optional().describe('Plan collaboration state folded from the plan command lifecycle and `plan/mode` events.'),
}), z.record(z.string(), z.json()).readonly()).readonly().describe('Provider-validated values; omitted keys are absent capabilities at this cut.'),
  'kind': z.literal("sequenced").readonly(),
}), z.object({
  'kind': z.literal("migration-required").readonly(),
  'values': z.intersection(z.object({
  'inbox': z.object({
  'next-turn': z.array(z.json()).readonly(),
  'next-step': z.array(z.json()).readonly(),
}).optional().describe('Pending agent input reconstructed from durable inbox splices.'),
  'workingDirectory': z.union([z.literal(null), z.string()]).optional().describe('Recorded current directory for Session observations, or null when none is recorded.'),
  'agentPreset': z.union([z.literal(null), z.string()]).optional().describe('Preset the Session runs, or null when the deployment composes none.'),
  'title': z.union([z.literal(null), z.string()]).optional().describe('The session\'s current normalized title — the latest `session/title` event\'s text (last-wins), or `null` before the first title lands. A plain string: the shape the client list rows consume.'),
  'todos': z.union([z.literal(null), z.array(z.object({
  'content': z.string().describe('What this task is — a short imperative line shown in the UI.'),
  'status': z.union([z.literal("completed"), z.literal("pending"), z.literal("in_progress")]).describe('Lifecycle state. `in_progress` marks a task being worked now; parallel work may mark several.'),
}))]).optional().describe('The agent\'s current whole todo list (the latest `todo/write` snapshot), or `null` before the first write. Whole-value rule: every `todo/write` carries the complete replacement list, so the fold is last-wins.'),
  'sessionListMetadata': z.object({
  'blank': z.boolean().readonly().describe('Whether the folded prefix contains no turn.'),
  'lastPromptAt': z.union([z.literal(null), z.number()]).readonly().describe('Latest human-authored prompt time in the folded prefix.'),
}).optional().describe('Persisted facts used to summarize a Session without activating it.'),
  'imageLimits': z.object({
  'maxImageBytes': z.number(),
  'maxImagesPerMessage': z.number(),
  'maxMessageImageBytes': z.number(),
  'maxImagePixels': z.number(),
  'maxImageDimension': z.number().describe('Maximum intrinsic width and maximum intrinsic height in pixels for one image.'),
  'mediaTypes': z.array(z.union([z.literal("image/png"), z.literal("image/jpeg"), z.literal("image/webp"), z.literal("image/gif")])),
}).optional().describe('Image-intake limits enforced by the Session prompt endpoint.'),
  'modelSelection': z.object({
  'lastUsed': z.union([z.literal(null), z.object({
  'provider': z.string().readonly(),
  'model': z.string().readonly(),
  'reasoningEffort': z.string().readonly().optional(),
})]).readonly().describe('Selection consumed by the latest recorded model request.'),
  'next': z.union([z.literal(null), z.object({
  'provider': z.string().readonly(),
  'model': z.string().readonly(),
  'reasoningEffort': z.string().readonly().optional(),
})]).readonly().describe('Selection the next request should use, falling back to {@link lastUsed}.'),
}).optional().describe('Durable model selection already used and selected for the next request.'),
  'permissions': z.object({
  'currentValue': z.string().describe('The effective current value: a configured preset key, `auto`, or `custom`.'),
}).optional().describe('The session\'s current permission, folded from the three whole-value knob events (`permission/preset`, `sandbox/mode`, `approval/policy`) over the composition defaults. Selectable options come from the process-level catalog Remote. Key absence means no permission service is composed — clients hide the control.'),
  'subagentCatalog': z.array(z.union([z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("one-shot").readonly(),
  'label': z.string().readonly().optional(),
}), z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("external").readonly(),
  'label': z.string().readonly().optional(),
}), z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("continuable").readonly(),
  'label': z.string().readonly(),
}), z.object({
  'id': z.string().readonly(),
  'createdAt': z.number().readonly(),
  'mode': z.literal("unknown").readonly(),
  'label': z.string().readonly().optional(),
})])).optional().describe('Direct children in parent catalog event order, excluding fork-inherited facts.'),
  'subagentTiming': z.object({
  'settledMs': z.number().describe('Milliseconds accumulated across completed turns after the child\'s own descriptor.'),
  'active': z.object({
  'since': z.number().describe('Start of the open turn.'),
  'through': z.number().describe('Latest event time folded into this projection cut.'),
}).optional().describe('Same-cut bounds of the currently open turn, when one has not reached `turn/end`.'),
  'lastTurnCompleted': z.boolean().optional().describe('Whether the latest closed turn after the child\'s own descriptor completed normally; absent while a turn is open or before one closes.'),
}).optional().describe('Active-turn duration and latest closed-turn completion for a descriptor-backed subagent session.'),
  'subagent': z.union([z.literal(null), z.object({
  'mode': z.literal("one-shot").describe('A terminal one-shot child.'),
  'label': z.string().optional().describe('Optional durable creation label from the child\'s descriptor.'),
  'seq': z.number().describe('Seq of the `subagent/descriptor` event this identity was folded from. `session.isOwnSeq(seq)` proves the identity comes from the child\'s OWN log suffix — where a descriptor is immutable once appended — and not from a fork seed\'s replayed ancestor descriptor.'),
}), z.object({
  'mode': z.literal("continuable").describe('A resumable conversation.'),
  'label': z.string().describe('Durable creation label from the child\'s descriptor.'),
  'seq': z.number().describe('Seq of the folded descriptor event; see the one-shot arm for the own-suffix proof.'),
})]).optional().describe('Identity of a descriptor-backed subagent session. `null` ⟺ no valid descriptor (missing, malformed, or unrecognized-version — deliberately undistinguished). The sentinel is deliberately serializable: a value pushed over JSON transports must survive `JSON.stringify` losslessly, where an `undefined` field would be dropped and a stale identity would survive on the receiving side. The entry itself stays non-optional.'),
  'tokenUsage': z.object({
  'uncachedInputTokens': z.number(),
  'outputTokens': z.number(),
  'cacheReadTokens': z.number(),
  'cacheWriteTokens': z.number(),
}).optional().describe('Provider-reported usage accumulated across the complete durable log.'),
  'contextPressure': z.object({
  'pressureTokens': z.number().optional().describe('Provider-reported prompt size of the most recent request: uncached input plus cache reads and writes. Response output is excluded, so this does not grow as the current turn streams. Absent until a provider reports usage.'),
  'projectedTokens': z.number().optional().describe('What the NEXT request\'s prompt would cost: {@link pressureTokens} plus the heuristic repricing of everything the surface gained or lost since that sample. Only the delta is estimated, so the figure stays anchored to the provider while still reacting the moment a compaction shadows a span — which `pressureTokens` alone cannot do, since compaction reports no usage of its own. Absent until a provider reports usage.'),
  'contextWindow': z.number().optional().describe('Newest recorded route capacity; absent when no adapter advertised one.'),
}).optional().describe('Newest request pressure paired with the newest known route capacity.'),
  'contextBreakdown': z.object({
  'systemTokens': z.number().describe('Heuristic tokens of the last nonempty surviving system prompt in surface order; 0 when none exists.'),
  'toolsTokens': z.number().describe('Heuristic tokens of the newest request envelope\'s tool schemas; 0 before any request.'),
  'messageTokens': z.number().describe('Heuristic tokens of every other visible surface node, including superseded system prompts.'),
}).optional().describe('Heuristic system/tools/message composition of the next request.'),
  'agentTeam': z.object({
  'members': z.array(z.object({
  'id': z.string().readonly(),
  'name': z.string().readonly(),
  'role': z.union([z.literal("lead"), z.literal("teammate")]).readonly(),
  'phase': z.union([z.literal("failed"), z.literal("provisioning"), z.literal("active")]).readonly().describe('Durable lifecycle; the Lead row is always `active`. Turn activity comes from Session status.'),
  'error': z.string().readonly().optional(),
})).readonly(),
  'tasks': z.array(z.object({
  'id': z.string().readonly(),
  'revision': z.number().readonly(),
  'subject': z.string().readonly(),
  'description': z.string().readonly(),
  'status': z.union([z.literal("completed"), z.literal("pending"), z.literal("in_progress"), z.literal("deleted")]).readonly(),
  'blockedBy': z.array(z.string()).readonly(),
  'writeScopes': z.array(z.string()).readonly(),
  'ownerName': z.string().readonly().optional(),
  'ready': z.boolean().readonly(),
  'writeScopeWarnings': z.array(z.string()).readonly(),
})).readonly(),
  'failure': z.string().readonly().optional(),
}).optional().describe('Durable roster and non-deleted task board of the Team rooted at the projected Session.'),
  'userQuestions': z.object({
  'active': z.array(z.object({
  'callId': z.string().readonly(),
  'questions': z.array(z.object({
  'id': z.string().describe('Stable caller-provided question id, echoed in the answer.'),
  'question': z.string().describe('The question to display.'),
  'detail': z.string().optional().describe('Optional supporting detail rendered with the question but kept out of option labels.'),
  'header': z.string().optional().describe('Optional short heading/group label.'),
  'options': z.array(z.object({
  'label': z.string().describe('User-facing label.'),
  'description': z.string().optional().describe('Optional extra context rendered by capable UIs.'),
})).optional().describe('Optional choices the UI can render as a menu.'),
  'multiSelect': z.boolean().optional().describe('Whether more than one option may be selected. Defaults to single-select.'),
  'intent': z.object({
  'kind': z.literal("plan-review").describe('A plan submitted for review: `detail` is the plan markdown `ask()` requires, and the decision approves or declines it.'),
  'approve': z.string().describe('The option label that approves the plan; every other option declines it. Named rather than positional so no UI infers the verdict from option order. An `approve` naming no option of its own question is rejected at `ask()`.'),
  'callId': z.string().optional().describe('Logged tool invocation whose arguments contain the reviewed plan.'),
}).optional().describe('Optional presentation intent for capable UIs; absent asks for the generic option list.'),
})).readonly(),
  'state': z.union([z.literal("open"), z.literal("continued")]).readonly(),
})).readonly().describe('Calls that can still take an answer, in ask order.'),
  'settled': z.array(z.object({
  'callId': z.string().readonly().describe('The settled call.'),
  'answers': z.array(z.object({
  'id': z.string().describe('The answered question id.'),
  'selected': z.array(z.string()).describe('Selected option labels. May accompany custom text for a multi-select question.'),
  'custom': z.string().optional().describe('Optional free-text "Other" answer.'),
})).readonly().describe('The recorded batch, one entry per question; empty when the late reply carried none.'),
})).readonly().describe('Calls an answer settled, in settlement order.'),
}).optional().describe('Timed questions that remain answerable in this Session, and the ones a late reply settled.'),
  'goal': z.union([z.literal(null), z.object({
  'goal': z.object({
  'objective': z.string().readonly().describe('Human-requested completion objective.'),
  'phase': z.union([z.literal("active"), z.literal("paused"), z.literal("blocked"), z.literal("complete")]).readonly().describe('Durable lifecycle phase.'),
  'blockedReason': z.object({
  'code': z.string().readonly().describe('Stable lower-kebab-case classification chosen by the blocking policy.'),
  'message': z.string().readonly().describe('Non-empty explanation shown to humans and models.'),
}).readonly().optional().describe('Present exactly while `phase` is `blocked`.'),
  'maxGoalRounds': z.number().readonly().describe('Total admitted goal-round cap.'),
  'id': z.string().readonly().describe('Stable goal identity.'),
  'revision': z.number().readonly().describe('Positive revision; every durable mutation increments it.'),
}).readonly().describe('Current durable goal snapshot (the CAS ref for mutations rides on it).'),
  'roundsStarted': z.number().readonly().describe('Highest admitted round number for this goal.'),
  'createdAt': z.number().readonly().describe('Epoch milliseconds of the create mutation.'),
  'updatedAt': z.number().readonly().describe('Epoch milliseconds of the latest mutation.'),
})]).optional().describe('The session\'s current goal and admitted-round count, or `null` before the first create and after a clear tombstone. `goal/change` supplies the whole lifecycle value; matching admitted `user/message` events advance `roundsStarted`.'),
  'plan': z.object({
  'active': z.boolean(),
  'pending': z.boolean(),
}).optional().describe('Plan collaboration state folded from the plan command lifecycle and `plan/mode` events.'),
}), z.record(z.string(), z.json()).readonly()).readonly(),
})]))
let _deepseek_ai_dsh_api_session_controller_session_prompt_parameter_0$schema$value
const _deepseek_ai_dsh_api_session_controller_session_prompt_parameter_0$schema = () => (_deepseek_ai_dsh_api_session_controller_session_prompt_parameter_0$schema$value ??= z.object({
  'requestId': z.string().readonly().describe('Client-minted identity persisted on the exact accepted user message.'),
  'sessionId': z.string().readonly(),
  'mode': z.union([z.literal("queue"), z.literal("steer")]).readonly(),
  'content': z.array(z.union([z.object({
  'type': z.literal("text").readonly(),
  'text': z.string().readonly(),
}), z.object({
  'type': z.literal("image").readonly(),
  'mediaType': z.union([z.literal("image/png"), z.literal("image/jpeg"), z.literal("image/webp"), z.literal("image/gif")]).readonly(),
  'data': z.string().readonly(),
  'name': z.string().readonly().optional(),
}), z.object({
  'type': z.literal("file").readonly(),
  'receiptId': z.string().readonly(),
})])).readonly().describe('At least one non-whitespace text part or attachment.'),
  'clientTimeZone': z.string().readonly().optional(),
}))
let _deepseek_ai_dsh_api_session_controller_session_prompt_result$schema$value
const _deepseek_ai_dsh_api_session_controller_session_prompt_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_prompt_result$schema$value ??= z.object({
  'accepted': z.literal(true).readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_rename_parameter_0$schema$value
const _deepseek_ai_dsh_api_session_controller_session_rename_parameter_0$schema = () => (_deepseek_ai_dsh_api_session_controller_session_rename_parameter_0$schema$value ??= z.object({
  'sessionId': z.string().readonly(),
  'title': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_rename_result$schema$value
const _deepseek_ai_dsh_api_session_controller_session_rename_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_rename_result$schema$value ??= z.object({
  'title': z.string().readonly(),
  'seq': z.number().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_search_parameter_0$schema$value
const _deepseek_ai_dsh_api_session_controller_session_search_parameter_0$schema = () => (_deepseek_ai_dsh_api_session_controller_session_search_parameter_0$schema$value ??= z.object({
  'query': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_search_result$schema$value
const _deepseek_ai_dsh_api_session_controller_session_search_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_search_result$schema$value ??= z.object({
  'items': z.array(z.object({
  'sessionId': z.string().readonly(),
  'snippet': z.string().readonly(),
})).readonly(),
  'hasMore': z.boolean().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_selectModel_parameter_0$schema$value

export {};
