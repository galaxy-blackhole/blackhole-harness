/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mặt vào của gói agent-loop: export ĐÚNG năm tên như bản gốc
 *      (AgentLoop · default · CONFIGURED_AGENT_IDENTITIES_KEY · DEFAULT_MAX_PARALLEL_TOOL_CALLS · turnBoundaryProjectionDefinition)
 */

export { AgentLoop, CONFIGURED_AGENT_IDENTITIES_KEY, turnBoundaryProjectionDefinition } from "./plugin.ts";
export { AgentLoop as default } from "./plugin.ts";
export { DEFAULT_MAX_PARALLEL_TOOL_CALLS } from "./constants.ts";
