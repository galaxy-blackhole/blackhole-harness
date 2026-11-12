/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào NỬA HOST của row api-remotes (port 1:1 `lib/types/index.js`): đúng BA export runtime
 *      (`API_REMOTE_FORWARDED_EVENTS` · `apply` · `inject`) + mặt kiểu của allowlist.
 */

import { homedir } from "node:os";

import { carrierKeyOf } from "@deepseek-ai/dsh-scope";

import { API_REMOTE_FORWARDED_EVENTS } from "./events.ts";
import { RemoteEventQueue, assertJsonArgs, forwardWaterfall, type AgentLike, type ForwardedFrame } from "./queue.ts";

export { API_REMOTE_FORWARDED_EVENTS } from "./events.ts";
export type { ApiRemoteForwardedEvent } from "./events.ts";

/** Seam `typertGateway`: chủ sở hữu đường truyền Remote (Gateway giữ mux stream vật lý). */
export interface TypertGatewaySeam {
  /**
   * Đăng ký MỘT nguồn sự kiện chuyển tiếp; Gateway tự kéo nguồn theo nhu cầu Peer.
   * Nhận: `source` — hàm dựng AsyncIterable theo `signal`; `host` — thông tin máy chạy (`home`).
   * Trả: hàm dọn bất đồng bộ của lượt đăng ký.
   */
  registerRemoteEvents(source: (signal: AbortSignal) => AsyncIterable<ForwardedFrame>, host: { readonly home: string }): () => Promise<void>;
}

/** Context tối thiểu mà nửa host của row này dùng, khai theo CẤU TRÚC (luật 000d). */
export interface ApiRemotesContext {
  /** Seam Gateway đang chạy. */
  readonly typertGateway: TypertGatewaySeam;
  /** Đăng ký một effect thuộc vòng đời plugin. */
  effect(callback: () => () => unknown, label: string): unknown;
  /** Nghe một sự kiện Cordis; trả hàm dọn. */
  on(event: string, listener: (this: unknown, ...args: never[]) => unknown): () => void;
}

/** Dịch vụ Host bắt buộc: Gateway sở hữu mux stream Remote vật lý. */
export const inject: string[] = ["typertGateway"];

/**
 * Thân plugin Host: đăng ký nguồn sự kiện Cordis đã chọn của ứng dụng với Gateway.
 * Nhận: `ctx` — context cordis có đủ `typertGateway`.
 * Trả: không; effect bị dọn cùng plugin.
 */
export function apply(ctx: ApiRemotesContext): void {
  ctx.effect(() => ctx.typertGateway.registerRemoteEvents(remoteEventSource(ctx), { home: homedir() }), "api-remotes: forwarded Cordis event source");
}

/**
 * Dựng hàng đợi DUY NHẤT và bộ listener mà Gateway đã đăng ký sẽ tiêu thụ.
 * Nhận: `ctx` — context cordis dùng seam nghe sự kiện.
 * Trả: hàm dựng AsyncIterable theo `signal`.
 */
function remoteEventSource(ctx: ApiRemotesContext): (signal: AbortSignal) => AsyncIterable<ForwardedFrame> {
  return (signal) => {
    const queue = new RemoteEventQueue();
    const disposers = API_REMOTE_FORWARDED_EVENTS.map((entry) => {
      const { event, mode } = entry;
      if (mode === "emit") {
        const resources = "resources" in entry ? entry.resources : undefined;
        return ctx.on(event, (...args: unknown[]) => {
          queue.push({
            event,
            args: assertJsonArgs(event, args),
            ...(resources === undefined ? {} : { resources }),
          });
        });
      }
      return ctx.on(event, function (this: unknown, request: unknown, next: () => unknown) {
        const carrierAgent = carrierKeyOf(this);
        if (carrierAgent === undefined) return next();
        const agent = (request as { readonly agent?: AgentLike }).agent;
        if (agent === undefined || agent !== carrierAgent) throw new TypeError(`forwarded scoped event ${JSON.stringify(event)} must carry its Agent directly`);
        return forwardWaterfall(queue, event, { agent }, { value: agent.ctx, subject: agent, agentId: agent.id }, next);
      });
    });
    return queue.iterate(signal, () => {
      for (const dispose of disposers) dispose();
    });
  };
}