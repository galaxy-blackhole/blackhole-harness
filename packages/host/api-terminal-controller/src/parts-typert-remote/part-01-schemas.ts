/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-terminal-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

let _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_0$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_0$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_0$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_1$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_1$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_1$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_attach_uplink$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_attach_uplink$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_attach_uplink$schema$value ??= z.union([z.object({
  'type': z.literal("write").readonly(),
  'sequence': z.number().readonly(),
  'data': z.string().readonly(),
}), z.object({
  'type': z.literal("resize").readonly(),
  'sequence': z.number().readonly(),
  'cols': z.number().readonly(),
  'rows': z.number().readonly(),
})]))
let _deepseek_ai_dsh_api_terminal_controller_terminal_attach_result$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_attach_result$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_attach_result$schema$value ??= z.union([z.object({
  'type': z.literal("snapshot").readonly(),
  'sequence': z.number().readonly(),
  'screen': z.string().readonly(),
  'info': z.object({
  'id': z.string().readonly(),
  'title': z.string().readonly(),
  'shell': z.object({
  'path': z.string().readonly(),
  'args': z.array(z.string()).readonly(),
  'name': z.string().readonly(),
}).readonly(),
  'cwd': z.string().readonly().describe('Initial working directory; shell directory changes do not update this field.'),
  'cols': z.number().readonly(),
  'rows': z.number().readonly(),
  'state': z.union([z.literal("failed"), z.literal("running"), z.literal("exited")]).readonly(),
  'exitCode': z.union([z.literal(null), z.number()]).readonly(),
  'error': z.string().readonly().optional(),
}).readonly(),
  'writable': z.boolean().readonly(),
  'inputWindow': z.object({
  'maxBytes': z.number().readonly().describe('Maximum complete encoded frame bytes waiting for the Host consumer.'),
  'frameOverheadBytes': z.number().readonly().describe('UTF-8 envelope bytes added to a compact JSON item with a present value field.'),
}).readonly().optional(),
}), z.object({
  'type': z.literal("output").readonly(),
  'sequence': z.number().readonly(),
  'data': z.string().readonly(),
}), z.object({
  'type': z.literal("state").readonly(),
  'info': z.object({
  'id': z.string().readonly(),
  'title': z.string().readonly(),
  'shell': z.object({
  'path': z.string().readonly(),
  'args': z.array(z.string()).readonly(),
  'name': z.string().readonly(),
}).readonly(),
  'cwd': z.string().readonly().describe('Initial working directory; shell directory changes do not update this field.'),
  'cols': z.number().readonly(),
  'rows': z.number().readonly(),
  'state': z.union([z.literal("failed"), z.literal("running"), z.literal("exited")]).readonly(),
  'exitCode': z.union([z.literal(null), z.number()]).readonly(),
  'error': z.string().readonly().optional(),
}).readonly(),
  'writable': z.boolean().readonly(),
}), z.object({
  'type': z.literal("ack").readonly(),
  'sequence': z.number().readonly(),
  'refusal': z.union([z.literal("read-only"), z.literal("not-running")]).readonly().optional(),
})]))
let _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_0$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_0$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_0$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_1$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_1$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_1$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_close_result$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_close_result$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_close_result$schema$value ??= z.void())
let _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_0$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_0$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_0$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_1$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_1$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_1$schema$value ??= z.object({
  'shellPath': z.string().readonly().optional().describe('A path returned by shell discovery; absent selects the execution default.'),
  'id': z.string().readonly(),
  'cols': z.number().readonly(),
  'rows': z.number().readonly(),
}))
let _deepseek_ai_dsh_api_terminal_controller_terminal_create_result$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_create_result$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_create_result$schema$value ??= z.object({
  'id': z.string().readonly(),
  'title': z.string().readonly(),
  'shell': z.object({
  'path': z.string().readonly(),
  'args': z.array(z.string()).readonly(),
  'name': z.string().readonly(),
}).readonly(),
  'cwd': z.string().readonly().describe('Initial working directory; shell directory changes do not update this field.'),
  'cols': z.number().readonly(),
  'rows': z.number().readonly(),
  'state': z.union([z.literal("failed"), z.literal("running"), z.literal("exited")]).readonly(),
  'exitCode': z.union([z.literal(null), z.number()]).readonly(),
  'error': z.string().readonly().optional(),
}))
let _deepseek_ai_dsh_api_terminal_controller_terminal_environment_parameter_0$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_environment_parameter_0$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_environment_parameter_0$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_environment_result$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_environment_result$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_environment_result$schema$value ??= z.object({
  'cwd': z.string().readonly().describe('Logged current directory, read without filesystem validation.'),
  'maxInputBytes': z.number().readonly(),
  'maxBufferedBytes': z.number().readonly().describe('Maximum complete encoded Client input bytes retained until acknowledgement.'),
  'maxCols': z.number().readonly(),
  'maxRows': z.number().readonly(),
  'scrollback': z.number().readonly(),
}))
let _deepseek_ai_dsh_api_terminal_controller_terminal_list_parameter_0$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_list_parameter_0$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_list_parameter_0$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_list_result$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_list_result$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_list_result$schema$value ??= z.array(z.object({
  'id': z.string().readonly(),
  'title': z.string().readonly(),
  'shell': z.object({
  'path': z.string().readonly(),
  'args': z.array(z.string()).readonly(),
  'name': z.string().readonly(),
}).readonly(),
  'cwd': z.string().readonly().describe('Initial working directory; shell directory changes do not update this field.'),
  'cols': z.number().readonly(),
  'rows': z.number().readonly(),
  'state': z.union([z.literal("failed"), z.literal("running"), z.literal("exited")]).readonly(),
  'exitCode': z.union([z.literal(null), z.number()]).readonly(),
  'error': z.string().readonly().optional(),
})))
let _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_0$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_0$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_0$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_1$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_1$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_1$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_2$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_2$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_2$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_rename_result$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_rename_result$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_rename_result$schema$value ??= z.void())
let _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_0$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_0$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_0$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_1$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_1$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_1$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_retain_result$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_retain_result$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_retain_result$schema$value ??= z.object({
  'type': z.literal("retained").readonly(),
}))
let _deepseek_ai_dsh_api_terminal_controller_terminal_shells_parameter_0$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_shells_parameter_0$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_shells_parameter_0$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_shells_result$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_shells_result$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_shells_result$schema$value ??= z.array(z.object({
  'path': z.string().readonly(),
  'args': z.array(z.string()).readonly(),
  'name': z.string().readonly(),
})))
let _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_0_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_1_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_1_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_1_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_0_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_1_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_1_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_1_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_0_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_1_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_1_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_1_strict$schema$value ??= z.strictObject({
  'shellPath': z.string().readonly().optional().describe('A path returned by shell discovery; absent selects the execution default.'),
  'id': z.string().readonly(),
  'cols': z.number().readonly(),
  'rows': z.number().readonly(),
}))
let _deepseek_ai_dsh_api_terminal_controller_terminal_environment_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_environment_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_environment_parameter_0_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_list_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_list_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_list_parameter_0_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_0_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_1_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_1_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_1_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_2_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_2_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_2_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_0_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_1_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_1_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_1_strict$schema$value ??= z.string())
let _deepseek_ai_dsh_api_terminal_controller_terminal_shells_parameter_0_strict$schema$value
const _deepseek_ai_dsh_api_terminal_controller_terminal_shells_parameter_0_strict$schema = () => (_deepseek_ai_dsh_api_terminal_controller_terminal_shells_parameter_0_strict$schema$value ??= z.string())


export {};
