/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-time-context — port 1:1 nửa host của @deepseek-ai/dsh-time-context
 *      (stock lib/index.js dòng 94–249, region lib/types/index.js): plugin cordis tên `time-context`,
 *      `inject ['agents','sessionProjections']`, đăng ký unit projection `timeContext` và listener
 *      `agent/pre-step` prepend chèn một tin nhắn nguồn `time-context` (form `snapshot`).
 */

// Nạp augmentation của `@deepseek-ai/cordis` (service `agents`, service `sessionProjections`, sự kiện
// `agent/pre-step`): `Agent` từ dsh-agent, registry từ dsh-session-projection — cả hai chỉ để lấy kiểu.
import type { Agent } from "@galaxy-blackhole/gbh-agent";
import type { ProjectionDefinition } from "@deepseek-ai/dsh-session-projection";

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { z as zod } from "zod";
import { createUserMessage } from "@galaxy-blackhole/gbh-llm";
import type { ContextFormed, UserMessage } from "@galaxy-blackhole/gbh-llm";
import { SessionSeq } from "@galaxy-blackhole/gbh-session";
import { assertNever } from "@galaxy-blackhole/gbh-util-values";
import { deriveBrowserTimeZoneContext, renderBrowserTimeZoneContext } from "./request-zone.ts";
import type { BrowserTimeZoneContext } from "./request-zone.ts";
import { createTimestampFormatter, formatTimestamp } from "./timestamp.ts";

/**
 * Bề mặt SESSION mà row này chạm tới (ADR 000d, 08/11/2026 dev-1).
 * Bản port `gbh-agent` chỉ khai `seq`/`snapshotEvents` trên `AgentSession`, KHÔNG khai `eventAt`; còn hợp sự kiện
 * `SessionEventMap` của kernel chưa có các loại do gói khác khai bằng augmentation ⇒ đọc qua mặt CẤU TRÚC tại biên.
 */
interface SessionLogLike {
  /** Số thứ tự sự kiện hiện tại của phiên. */
  readonly seq: number;
  /** Sự kiện tại một mốc, hoặc `undefined` ngoài khoảng. */
  eventAt(seq: unknown): { readonly type: string; readonly data: any } | undefined;
}

/**
 * Đọc bề mặt log của phiên một agent, ép MỘT chỗ tại biên.
 * Nhận: `agent` — agent có `session`. Trả: bề mặt log cấu trúc của phiên đó.
 */
function sessionLogOf(agent: { readonly session: unknown }): SessionLogLike {
  return agent.session as unknown as SessionLogLike;
}

/** Mặt cấu trúc của kênh `agent/pre-step` (bản gốc khai bằng augmentation `Events`). */
interface AgentPreStepSeamLike {
  /** Nghe bước trước khi chạy; `next()` cho phép chạy tiếp và trả quyết định. */
  on(event: 'agent/pre-step', listener: (payload: any, next: () => Promise<any>) => Promise<any> | any, options?: { readonly prepend?: boolean }): () => void;
}


// Nguồn `time-context` là một khoá của bảng nguồn tin nhắn (stock index.d.ts dòng 11–16).
declare module "@galaxy-blackhole/gbh-llm" {
  interface MessageSourceMap {
    "time-context": {
      kind: "time-context";
    } & ContextFormed;
  }
}

/**
 * Plugin cordis bật ngữ cảnh đồng hồ theo yêu cầu: các bước hợp lệ thêm những lần đọc thời gian bền,
 * có nguồn gốc vào lịch sử yêu cầu.
 *
 * @module @galaxy-blackhole/gbh-time-context
 */

/** Tên plugin cordis dùng cho chẩn đoán của Loader (nguyên văn của bản gốc). */
export const name = "time-context";

/** Schema trạng thái projection `timeContext` (zod, đúng ba trường của bản gốc). */
const timeContextStateSchema = zod.object({
  /** Thời điểm sự kiện mới nhất mà model thấy (tin người dùng/trợ lý, kết quả tool), hoặc null. */
  lastMessageTime: zod.number().nullable(),
  /** Thời điểm lần chèn bền mới nhất của chính plugin này, hoặc null. */
  lastInjectionTime: zod.number().nullable(),
  /** Thời điểm chèn mới nhất trong lượt đang mở, hoặc null trước khi lượt đó nhận được một lần. */
  lastTurnInjectionTime: zod.number().nullable(),
});

/** Trạng thái projection `timeContext` đã gấp (fold) — suy ra từ schema ở trên, y bản gốc. */
type TimeContextProjection = zod.infer<typeof timeContextStateSchema>;

// Bảng trạng thái projection của host nhận thêm khoá của plugin này (stock index.d.ts dòng 20–25).
declare module "@deepseek-ai/dsh-session-projection/types" {
  interface SessionProjectionStateMap {
    /** Những lần đọc time-context mới nhất. */
    timeContext: TimeContextProjection;
  }
}

/** Sổ đăng ký agent sở hữu bước xử lý trước bước kế tiếp. */
export const inject: string[] = ["agents", "sessionProjections"];

/** Cấu hình của row: định dạng đồng hồ lúc chuẩn bị yêu cầu và lịch chèn bền. Giá trị sai làm plugin ném lúc nạp. */
export interface Config {
  /** Múi giờ hiển thị dự phòng khi lượt đang mở không có múi giờ trình duyệt duy nhất. Vắng ⇒ múi giờ tiến trình. */
  timeZone?: string;
  /** Số mili giây tối thiểu giữa hai lần chèn bền trong một phiên. Mặc định 600000 (10 phút); 0 = chèn mọi bước hợp lệ. */
  refreshIntervalMs?: number;
}

/** Kiểm chứng schemastery cho {@link Config} — hai trường tuỳ chọn, đúng như bản gốc. */
export const Config: z<Config> = z.object({
  timeZone: z.string(),
  refreshIntervalMs: z.number(),
}) as unknown as z<Config>;

/**
 * Định dạng một số mili giây đã trôi (không âm) thành đơn vị giây nguyên gọn.
 * Nhận: elapsedMs — số mili giây đã trôi.
 * Trả: chuỗi dạng `1d 2h 3m 4s` (chỉ các đơn vị khác 0 mới xuất hiện, giây luôn xuất hiện).
 */
function formatDuration(elapsedMs: number): string {
  let seconds = Math.floor(Math.max(0, elapsedMs) / 1e3);
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

/**
 * Gom những tin nhắn người dùng đã vào và đang đề nghị thuộc một lượt đang mở.
 * Nhận: agent — agent có sổ phiên; turn — số lượt đang mở; proposed — tin nhắn do bước kế tiếp đề nghị.
 * Trả: tin nhắn của lượt theo thứ tự thời gian (tin đã vào rồi tới tin đề nghị).
 */
function requestMessages(agent: Agent, turn: number, proposed: readonly UserMessage[]): readonly UserMessage[] {
  const entered: UserMessage[] = [];
  for (let seq = agent.session.seq - 1; seq >= 0; seq -= 1) {
    const event = sessionLogOf(agent).eventAt(SessionSeq(seq));
    if (event?.type === "turn/start" && event.data.turn === turn) return [...entered.reverse(), ...proposed];
    if (event?.type === "user/message") entered.push(event.data);
  }
  return [...proposed];
}

/**
 * Dựng văn bản model thấy của một lần đọc đồng hồ.
 * Nhận: now — mốc hiện tại; turn/step — vị trí trong lượt; previous — mốc so sánh (vắng ⇒ `unavailable`);
 *       formatter + timeZone — cách hiển thị; browserContext — sự thật múi giờ trình duyệt của lượt.
 * Trả: ba dòng — mốc thời gian, chỉ dẫn múi giờ, và độ trôi kể từ mốc so sánh.
 */
function renderText(
  now: number,
  turn: number,
  step: number,
  previous: number | undefined,
  formatter: Intl.DateTimeFormat,
  timeZone: string,
  browserContext: BrowserTimeZoneContext,
): string {
  const elapsed = previous === undefined ? "unavailable" : formatDuration(now - previous);
  const baseline = step === 1 ? "model-visible message" : "step context";
  const browserText = renderBrowserTimeZoneContext(browserContext);
  return `Time sampled while preparing turn ${turn}, step ${step}: ${formatTimestamp(now, formatter, timeZone)}\n${browserText}\nElapsed since the preceding ${baseline}: ${elapsed}.`;
}

/**
 * Từ chối những khoảng làm mới không biểu diễn được đúng ngưỡng mili giây đã trôi.
 * Nhận: refreshIntervalMs — khoảng làm mới cần kiểm.
 * Trả: không; ném TypeError khi giá trị không phải số nguyên an toàn không âm.
 */
function validateRefreshInterval(refreshIntervalMs: number): void {
  if (!Number.isSafeInteger(refreshIntervalMs) || refreshIntervalMs < 0) throw new TypeError(`time-context: refreshIntervalMs must be a non-negative safe integer, got ${String(refreshIntervalMs)}`);
}

/**
 * Đăng ký listener trước bước kế tiếp (prepend) cho vòng đời của `ctx`.
 * Nhận: ctx — context plugin, listener bị huỷ cùng nó; config — múi giờ và lịch chèn bền.
 * Trả: không; đăng ký unit projection `timeContext` (stateVersion 2) và listener `agent/pre-step`.
 * Ném: khi khoảng làm mới không hợp lệ, hoặc múi giờ cấu hình / múi giờ tiến trình không giải được.
 */
export function apply(ctx: Context, config: Config): void {
  const timeZone = config.timeZone;
  const refreshIntervalMs = config.refreshIntervalMs ?? 600000;
  validateRefreshInterval(refreshIntervalMs);
  let fallbackFormatter: Intl.DateTimeFormat;
  try {
    fallbackFormatter = createTimestampFormatter(timeZone);
  } catch (error) {
    const message = timeZone === undefined ? "time-context: failed to resolve the system time zone" : `time-context: invalid IANA timeZone ${JSON.stringify(timeZone)}`;
    throw new Error(message, { cause: error });
  }
  const fallbackTimeZone = fallbackFormatter.resolvedOptions().timeZone;
  const formatters = new Map<string, Intl.DateTimeFormat>([[fallbackTimeZone, fallbackFormatter]]);
  /**
   * Giải và nhớ một formatter timestamp theo từng yêu cầu.
   * Nhận: selectedTimeZone — nhãn múi giờ cần hiển thị.
   * Trả: formatter đã có trong bộ nhớ đệm, hoặc formatter mới được tạo và ghi vào bộ nhớ đệm.
   */
  const formatterFor = (selectedTimeZone: string): Intl.DateTimeFormat => {
    const existing = formatters.get(selectedTimeZone);
    if (existing !== undefined) return existing;
    const created = createTimestampFormatter(selectedTimeZone);
    formatters.set(selectedTimeZone, created);
    return created;
  };
  // zod của ta (workspace) và zod trong d.ts của seam (kernel) là HAI thể hiện khác nhau ⇒ `ZodType` của ta không
  // gán thẳng được, và suy luận kiểu xuyên hai bản cài còn làm tsc báo TS2589 (quá sâu). Khai định nghĩa theo
  // ĐÚNG kiểu của seam (chỉ ép ở trường schema) — hành vi runtime y nguyên.
  const definition: ProjectionDefinition<"timeContext", TimeContextProjection> = {
    key: "timeContext",
    stateVersion: 2,
    stateSchema: timeContextStateSchema as unknown as ProjectionDefinition<"timeContext", TimeContextProjection>["stateSchema"],
    init: () => ({
      lastMessageTime: null,
      lastInjectionTime: null,
      lastTurnInjectionTime: null,
    }),
    apply: (state, event) => {
      if (event.type === "turn/start" || event.type === "turn/end")
        return state.lastTurnInjectionTime === null
          ? state
          : {
              ...state,
              lastTurnInjectionTime: null,
            };
      if (event.type === "user/message") {
        // `event.data.source.kind` la nguon tin nhan do goi khac khai bang augmentation; ban port doc qua cau truc.
        const injected = (event.data as { readonly source?: { readonly kind?: string } }).source?.kind === name;
        const withMessage =
          state.lastMessageTime === event.time
            ? state
            : {
                ...state,
                lastMessageTime: event.time,
              };
        if (!injected) return withMessage;
        return {
          ...withMessage,
          lastInjectionTime: event.time,
          lastTurnInjectionTime: event.time,
        };
      }
      if (event.type === "assistant/message" || event.type === "tool/result")
        return state.lastMessageTime === event.time
          ? state
          : {
              ...state,
              lastMessageTime: event.time,
            };
      return state;
    },
  };
  ctx.sessionProjections.register(definition);
  (ctx as unknown as AgentPreStepSeamLike).on(
    "agent/pre-step",
    async ({ agent, turn, step, signal }, next) => {
      const decision = await next();
      if (decision.kind === "reject" || signal.aborted) return decision;
      const now = Date.now();
      // Unit `timeContext` vừa đăng ký ngay trên ⇒ luôn có trạng thái; bản gốc đọc thẳng, không kiểm undefined.
      const state = ctx.sessionProjections.stateOf(agent.session, "timeContext")!;
      if (refreshIntervalMs > 0) {
        const lastInjection = state.lastInjectionTime;
        if (lastInjection != null && now >= lastInjection && now - lastInjection < refreshIntervalMs) return decision;
      }
      // Bước đầu so với tin nhắn model thấy gần nhất; các bước sau so với lần chèn của lượt.
      const previous = step === 1 ? (state.lastMessageTime ?? undefined) : (state.lastTurnInjectionTime ?? undefined);
      const browser = deriveBrowserTimeZoneContext(requestMessages(agent, turn, decision.messages));
      const selectedTimeZone = browser.kind === "resolved" ? browser.timeZone : fallbackTimeZone;
      const text = renderText(now, turn, step, previous, formatterFor(selectedTimeZone), selectedTimeZone, browser);
      return {
        ...decision,
        messages: [
          ...decision.messages,
          createUserMessage({
            content: [
              {
                type: "text",
                text,
              },
            ],
            source: {
              kind: name,
              form: "snapshot",
              sections: [
                {
                  name,
                  text,
                },
              ],
            },
          }),
        ],
      };
    },
    { prepend: true },
  );
}
