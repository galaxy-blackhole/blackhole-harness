/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-agent-instructions — phơi ĐÚNG bề mặt stock
 *      (stock lib/index.js:1447 export cuối + lib/types/index.d.ts:14–21).
 */
export { Config } from "./config.ts";
export { name } from "./state.ts";
export { apply, inject } from "./service.ts";
export { discoverBaselineInstructionFiles, loadBaselineInstructions } from "./files.ts";
export type { InstructionFile, LoadedInstructionFile } from "./files.ts";
export { renderAgentInstructions } from "./render.ts";
export type { RenderedAgentInstructions, TruncatedInstruction } from "./render.ts";
