/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Điểm vào của package experimental-tool-agent-team: xuất ĐÚNG bề mặt bản gốc — `Config` · `apply` ·
 *      `inject` · `name` (4 tên, không `default`). Cài 9 tool agent-team gốc + 2 tool bổ sung
 *      `set_team_limits` · `reset_teammate` + khối TEAM_POLICY + ngữ cảnh TEAM_IDENTITY vào đúng phạm
 *      vi của từng agent.
 */

import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import z from "@deepseek-ai/schemastery";

import { install, type ResolvedConfig } from "./install.ts";

/** Tên plugin cordis — nguyên văn từ bundle gốc (không phải tên package của ta). */
export const name = "tool-agent-team";

/** Seam phải có trước khi apply chạy — nguyên văn thứ tự của bản gốc. */
export const inject: string[] = ["agents", "agentTeams", "tools", "systemPrompt"];

/** Cấu hình định tuyến tool của row tool-agent-team. */
export interface Config {
  /** Đăng ký `interrupt_agent` và phần chữ chính sách của nó. Mặc định true; false thì domain API vẫn còn. */
  readonly interrupt?: boolean;
  /** Provider subagent-continuable dùng cho teammate "tươi". */
  readonly freshProvider?: string;
  /** Provider subagent-continuable dùng cho teammate fork tiền tố lượt đã xong. */
  readonly forkProvider?: string;
}

/** Schema cấu hình — schemastery, để config-editor của kernel render được từng field. */
export const Config: z<Config> = z.object({
  interrupt: z.boolean().default(true),
  freshProvider: z.string().default("spawn"),
  forkProvider: z.string().default("fork"),
}) as unknown as z<Config>;

/**
 * Cài bộ tool Team vào MỌI phạm vi thành viên Team đang sống hoặc được công bố sau đó.
 * Nhận: `ctx` — context cordis có hai seam `agents` và `agentTeams`;
 *       `config` — cấu hình thô từ loader (mặc định điền theo schema).
 * Trả: không; mỗi agent thành viên nhận 2 mục prompt + 11 tool, gỡ đúng lúc agent bị giải phóng
 *      hoặc khi effect của lượt cài này xuống.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const resolved: ResolvedConfig = {
    interrupt: config.interrupt ?? true,
    freshProvider: config.freshProvider ?? "spawn",
    forkProvider: config.forkProvider ?? "fork",
  };
  const installed = new Map<Agent, () => void>();
  const maybeInstall = (agent: Agent): void => {
    if (installed.has(agent) || ctx.agentTeams.tryMembership(agent) === void 0) return;
    installed.set(agent, install(agent, ctx, resolved));
  };
  for (const agent of ctx.agents.list()) maybeInstall(agent);
  ctx.on("agent/created", ({ agent }) => {
    maybeInstall(agent);
    return undefined;
  });
  ctx.on("agent/disposed", ({ agent }) => {
    installed.get(agent)?.();
    installed.delete(agent);
  });
  ctx.effect(() => () => {
    for (const dispose of installed.values()) dispose();
    installed.clear();
  }, "tool-team.scopedTools()");
}
