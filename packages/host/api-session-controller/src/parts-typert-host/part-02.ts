/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua artefact typert.host.js @deepseek-ai/dsh-api-session-controller — khong sua tay
 */
// @ts-nocheck

const _deepseek_ai_dsh_api_session_controller_session_selectModel_parameter_0$schema = () => (_deepseek_ai_dsh_api_session_controller_session_selectModel_parameter_0$schema$value ??= z.object({
  'sessionId': z.string().readonly(),
  'provider': z.string().readonly(),
  'model': z.string().readonly(),
  'reasoningEffort': z.string().readonly().optional(),
}))
let _deepseek_ai_dsh_api_session_controller_session_selectModel_result$schema$value
const _deepseek_ai_dsh_api_session_controller_session_selectModel_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_selectModel_result$schema$value ??= z.object({
  'selected': z.object({
  'provider': z.string().readonly(),
  'model': z.string().readonly(),
  'reasoningEffort': z.string().readonly().optional(),
}).readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_updateQueue_parameter_0$schema$value
const _deepseek_ai_dsh_api_session_controller_session_updateQueue_parameter_0$schema = () => (_deepseek_ai_dsh_api_session_controller_session_updateQueue_parameter_0$schema$value ??= z.object({
  'sessionId': z.string().readonly(),
  'itemId': z.string().readonly(),
  'action': z.union([z.object({
  'kind': z.literal("edit").readonly(),
  'content': z.array(z.object({
  'type': z.literal("text"),
  'text': z.string(),
})).readonly().describe('Non-empty text-only replacement content.'),
}), z.object({
  'kind': z.literal("remove").readonly(),
}), z.object({
  'kind': z.literal("steer").readonly(),
})]).readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_updateQueue_result$schema$value
const _deepseek_ai_dsh_api_session_controller_session_updateQueue_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_updateQueue_result$schema$value ??= z.object({
  'accepted': z.literal(true).readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_workspacePathApplications_parameter_0$schema$value
const _deepseek_ai_dsh_api_session_controller_session_workspacePathApplications_parameter_0$schema = () => (_deepseek_ai_dsh_api_session_controller_session_workspacePathApplications_parameter_0$schema$value ??= z.object({
  'path': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_workspacePathApplications_result$schema$value
const _deepseek_ai_dsh_api_session_controller_session_workspacePathApplications_result$schema = () => (_deepseek_ai_dsh_api_session_controller_session_workspacePathApplications_result$schema$value ??= z.array(z.object({
  'id': z.string().readonly().describe('OS application identifier; callers must revalidate it against the file\'s current handlers before opening.'),
  'name': z.string().readonly(),
  'default': z.boolean().readonly(),
  'icon': z.union([z.literal(null), z.string()]).readonly().describe('PNG or SVG data URL, or null when the desktop supplies no icon.'),
})))
let _deepseek_ai_dsh_api_session_controller_skills_list_parameter_0$schema$value
const _deepseek_ai_dsh_api_session_controller_skills_list_parameter_0$schema = () => (_deepseek_ai_dsh_api_session_controller_skills_list_parameter_0$schema$value ??= z.object({
  'sessionId': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_skills_list_result$schema$value
const _deepseek_ai_dsh_api_session_controller_skills_list_result$schema = () => (_deepseek_ai_dsh_api_session_controller_skills_list_result$schema$value ??= z.object({
  'skills': z.array(z.object({
  'path': z.string().readonly().optional().describe('Absolute SKILL.md path when supplied by a filesystem provider.'),
  'name': z.string().readonly().describe('Kebab-case identifier referenced as `/name`.'),
  'description': z.string().readonly().describe('Short routing description.'),
  'whenToUse': z.string().readonly().optional().describe('Optional extra routing guidance.'),
  'modelInvocable': z.boolean().readonly().describe('Whether the same skill is also advertised to the model.'),
})).readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_fileReferences_list_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_fileReferences_list_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_fileReferences_list_parameter_0_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_session_controller_fileReferences_list_parameter_1_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_fileReferences_list_parameter_1_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_fileReferences_list_parameter_1_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_session_controller_session_attachment_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_attachment_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_attachment_parameter_0_strict$schema$value ??= z.strictObject({
  'sessionId': z.string().readonly(),
  'attachmentId': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_cancel_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_cancel_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_cancel_parameter_0_strict$schema$value ??= z.strictObject({
  'sessionId': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_create_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_create_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_create_parameter_0_strict$schema$value ??= z.strictObject({
  'workspaceId': z.string().readonly().optional().describe('Workspace the Session joins; exclusive with `cwd`.'),
  'cwd': z.string().readonly().optional().describe('Directory the Session owns when no Workspace is named.'),
  'sessionId': z.string().readonly().optional().describe('Blank Session to reuse while it is reusable, or the identity of a new Session when none is stored under it.'),
  'agentPreset': z.string().readonly().optional().describe('Preset the Session runs, replacing a reused Session\'s recorded preset; the configured default when omitted.'),
}))
let _deepseek_ai_dsh_api_session_controller_session_follow_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_follow_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_follow_parameter_0_strict$schema$value ??= z.strictObject({
  'address': z.union([z.strictObject({
  'kind': z.literal("session").readonly(),
  'sessionId': z.string().readonly(),
}), z.strictObject({
  'kind': z.literal("subagent").readonly(),
  'parentSessionId': z.string().readonly(),
  'childSessionId': z.string().readonly(),
  'mode': z.union([z.literal("one-shot"), z.literal("continuable"), z.literal("unknown")]).readonly(),
})]).readonly(),
  'assistantStream': z.literal(true).readonly().optional().describe('Include process-local assistant presentation frames for the Web client.'),
  'maxMessages': z.number().readonly().optional(),
  'turnWindow': z.strictObject({
  'minMessages': z.number().readonly().describe('Minimum append-origin user/assistant messages; must not exceed maxMessages.'),
  'minTurns': z.number().readonly().describe('Minimum Turn starts crossed, including the partial Turn at beforeSeq.'),
}).readonly().optional().describe('Stop at a Turn start after both minima, unless maxMessages or history exhaustion wins.'),
}))
let _deepseek_ai_dsh_api_session_controller_session_fork_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_fork_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_fork_parameter_0_strict$schema$value ??= z.strictObject({
  'sessionId': z.string().readonly(),
  'atSeq': z.number().readonly().optional().describe('Exact inclusive source event seq; omission selects the latest completed-turn prefix.'),
  'allowMigration': z.boolean().readonly().optional().describe('False asks the Host to check for required migration before forking. Defaults to true.'),
}))
let _deepseek_ai_dsh_api_session_controller_session_list_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_list_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_list_parameter_0_strict$schema$value ??= z.strictObject({
  'cursor': z.string().readonly().optional(),
}))
let _deepseek_ai_dsh_api_session_controller_session_openWorkspacePath_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_openWorkspacePath_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_openWorkspacePath_parameter_0_strict$schema$value ??= z.strictObject({
  'action': z.literal("reveal").readonly().optional().describe('File-manager navigation when requested; omission uses the default application.'),
  'application': z.string().readonly().optional().describe('Registered application identifier; ignored for reveal. Omission preserves the operating system default.'),
  'path': z.string().readonly().describe('Path after best-effort Session workspace resolution, in Host filesystem syntax.'),
}))
let _deepseek_ai_dsh_api_session_controller_session_page_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_page_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_page_parameter_0_strict$schema$value ??= z.strictObject({
  'address': z.union([z.strictObject({
  'kind': z.literal("session").readonly(),
  'sessionId': z.string().readonly(),
}), z.strictObject({
  'kind': z.literal("subagent").readonly(),
  'parentSessionId': z.string().readonly(),
  'childSessionId': z.string().readonly(),
  'mode': z.union([z.literal("one-shot"), z.literal("continuable"), z.literal("unknown")]).readonly(),
})]).readonly(),
  'throughSeq': z.number().readonly().describe('Inclusive log cut obtained from the corresponding follow opening frame.'),
  'beforeSeq': z.number().readonly().optional(),
  'maxMessages': z.number().readonly().optional(),
  'turnWindow': z.strictObject({
  'minMessages': z.number().readonly().describe('Minimum append-origin user/assistant messages; must not exceed maxMessages.'),
  'minTurns': z.number().readonly().describe('Minimum Turn starts crossed, including the partial Turn at beforeSeq.'),
}).readonly().optional().describe('Stop at a Turn start after both minima, unless maxMessages or history exhaustion wins.'),
}))
let _deepseek_ai_dsh_api_session_controller_session_projections_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_projections_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_projections_parameter_0_strict$schema$value ??= z.strictObject({
  'sessionId': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_prompt_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_prompt_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_prompt_parameter_0_strict$schema$value ??= z.strictObject({
  'requestId': z.string().readonly().describe('Client-minted identity persisted on the exact accepted user message.'),
  'sessionId': z.string().readonly(),
  'mode': z.union([z.literal("queue"), z.literal("steer")]).readonly(),
  'content': z.array(z.union([z.strictObject({
  'type': z.literal("text").readonly(),
  'text': z.string().readonly(),
}), z.strictObject({
  'type': z.literal("image").readonly(),
  'mediaType': z.union([z.literal("image/png"), z.literal("image/jpeg"), z.literal("image/webp"), z.literal("image/gif")]).readonly(),
  'data': z.string().readonly(),
  'name': z.string().readonly().optional(),
}), z.strictObject({
  'type': z.literal("file").readonly(),
  'receiptId': z.string().readonly(),
})])).readonly().describe('At least one non-whitespace text part or attachment.'),
  'clientTimeZone': z.string().readonly().optional(),
}))
let _deepseek_ai_dsh_api_session_controller_session_rename_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_rename_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_rename_parameter_0_strict$schema$value ??= z.strictObject({
  'sessionId': z.string().readonly(),
  'title': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_search_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_search_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_search_parameter_0_strict$schema$value ??= z.strictObject({
  'query': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_selectModel_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_selectModel_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_selectModel_parameter_0_strict$schema$value ??= z.strictObject({
  'sessionId': z.string().readonly(),
  'provider': z.string().readonly(),
  'model': z.string().readonly(),
  'reasoningEffort': z.string().readonly().optional(),
}))
let _deepseek_ai_dsh_api_session_controller_session_updateQueue_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_updateQueue_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_updateQueue_parameter_0_strict$schema$value ??= z.strictObject({
  'sessionId': z.string().readonly(),
  'itemId': z.string().readonly(),
  'action': z.union([z.strictObject({
  'kind': z.literal("edit").readonly(),
  'content': z.array(z.strictObject({
  'type': z.literal("text"),
  'text': z.string(),
})).readonly().describe('Non-empty text-only replacement content.'),
}), z.strictObject({
  'kind': z.literal("remove").readonly(),
}), z.strictObject({
  'kind': z.literal("steer").readonly(),
})]).readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_session_workspacePathApplications_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_session_workspacePathApplications_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_session_workspacePathApplications_parameter_0_strict$schema$value ??= z.strictObject({
  'path': z.string().readonly(),
}))
let _deepseek_ai_dsh_api_session_controller_skills_list_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_session_controller_skills_list_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_session_controller_skills_list_parameter_0_strict$schema$value ??= z.strictObject({
  'sessionId': z.string().readonly(),
}))


export {};
