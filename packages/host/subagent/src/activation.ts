/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hồ sơ MỘT lượt thực thi con: khe công suất dùng chung, tuần tự hoá theo từng con bền, giữ lỗi
 *      cục bộ chưa có `turn/end` đã cam kết, và thu hoạch đầu ra cục bộ (kèm giá trị có cấu trúc đã
 *      cam kết). Port 1:1 lib/types/activation.js của @deepseek-ai/dsh-subagent; seam kernel khai
 *      theo CẤU TRÚC (không augment module).
 */

import type { Agent, AgentHandle } from "@galaxy-blackhole/gbh-agent";
import type { SessionEvent, SessionId, SessionLogOffset } from "@galaxy-blackhole/gbh-session";
import { assertNever } from "@deepseek-ai/dsh-util-values";
import { finalAssistantOutput } from "./assistant-output.ts";
import { SubagentError } from "./error.ts";

/**
 * Bề mặt SESSION mà bộ thu hoạch chạm tới — khai theo CẤU TRÚC (ADR 000d, 08/11/2026 dev-1, Lead chỉ định):
 * bản port `gbh-agent` không khai `session.seq`/`session.snapshotEvents` trên kiểu `AgentSession`, trong khi
 * phiên THẬT của kernel CÓ hai thành viên đó.
 */
interface SessionLogLike {
  /** Số thứ tự sự kiện hiện tại của phiên. */
  readonly seq: number;
  /** Ảnh chụp sự kiện của log phiên từ một mốc. */
  snapshotEvents(from?: SessionLogOffset): readonly SessionEvent[];
}

/**
 * Đọc bề mặt log của phiên một agent, ép MỘT chỗ tại biên (không nới kiểu toàn cục).
 * Nhận: `agent` — agent có `session`. Trả: bề mặt log cấu trúc của phiên đó.
 */
function sessionLogOf(agent: { readonly session: unknown }): SessionLogLike {
  return agent.session as unknown as SessionLogLike;
}
import { epochStopReason } from "./lifecycle.ts";
import type { ActivationObserver } from "./lifecycle.ts";
import type { StructuredAttachment } from "./structured.ts";
import type { SubagentResult, SubagentRun } from "./types.ts";

/**
 * Bộ ba promise/định-vị.
 * Nhận: `T` — kiểu giá trị sẽ giải quyết.
 * Trả: hình của `Promise.withResolvers()` (lib ES2023 mà cổng dùng CHƯA khai kiểu toàn cục này).
 */
interface PromiseWithResolvers<T> {
    readonly promise: Promise<T>;
    readonly resolve: (value: T) => void;
    readonly reject: (reason?: unknown) => void;
}

/** Khe tiến trình CỤC BỘ dùng chung qua các liên kết continuable không bị ngắt. */
export class ActivationPool {
    /** Tập khe đang giữ; mỗi khe là một `Symbol` nên nhả khe cũ không đụng khe mới. */
    private readonly slots = new Set<symbol>();

    /**
     * Giữ một khe TRƯỚC khi dựng lại; nhả khe cũng chịu được lượt quay lui chưa công bố.
     * Nhận: `capacity` — số lượt thực thi đồng thời tối đa của bể này.
     * Trả: hàm nhả khe IDEMPOTENT (gọi lại nhiều lần vẫn chỉ nhả một khe).
     * Ném: `SubagentError` mã `ACTIVATION_LIMIT_REACHED` khi bể đã đầy.
     */
    reserve(capacity: number): () => void {
        if (this.slots.size >= capacity) {
            throw new SubagentError(`subagent limit reached (active child limit: ${capacity}); wait for an existing child to finish `
                + 'or complete this work with the current agents', 'ACTIVATION_LIMIT_REACHED');
        }
        const slot = Symbol();
        this.slots.add(slot);
        return () => { this.slots.delete(slot); };
    }
}

/**
 * Phần hồ sơ CHUNG của một epoch: bể khe, danh tính con bền, cha, kiểu giao kết quả, và quan sát vòng đời.
 * Manager sở hữu việc thu nạp, handle thực thi, và giải phóng tài nguyên.
 */
interface ActivationBase {
    /** Công suất DÙNG CHUNG cho Activation này và mọi con do nó quản. */
    readonly pool: ActivationPool;
    /** Nhả khe của epoch này SAU khi handle đã dọn xong. */
    readonly releaseSlot: () => void;
    /** Con bền mà Activation này là một epoch của nó. */
    readonly childId: SessionId;
    /** Agent cha sở hữu epoch này. */
    readonly parent: Agent;
    /** Bên nhận kết quả: cha (`parent`) hay bên gọi (`caller`). */
    readonly delivery: 'parent' | 'caller';
    /** Lời hứa kết quả, do manager giải quyết khi epoch kết thúc. */
    readonly result: PromiseWithResolvers<SubagentResult>;
    /** Công bố ĐỒNG BỘ trước khi dọn; bên gọi sau đó dùng chung giao dịch này. */
    closing: Promise<void> | undefined;
    /**
     * Tổ tiên Agent SỐNG đúng tại lúc Activation này hiện thực.
     * Thành viên yếu giữ danh tính cấp host dù một tổ tiên trung gian rời sổ đăng ký.
     */
    readonly ancestry: WeakSet<Agent>;
    /**
     * Danh tính phiên của các Activation CON do epoch này sở hữu. Một phiên có tối đa một
     * Activation sống, nên id là đủ để nhận ra con đang sống. Khác rỗng thì CHẶN kết toán.
     */
    readonly ownedChildren: Set<SessionId>;
    /** Quan sát vòng đời phát cạnh bắt đầu và cạnh kết thúc của epoch này. */
    readonly observer: ActivationObserver;
    /**
     * Đã từng nhận được giao phẩm nào chưa. Lượt hiện thực bị quay lui trước lần nhận đầu là con
     * mà bên gọi đã được báo là KHÔNG tồn tại, nên việc dọn của nó không nợ cha bản kết toán nào.
     */
    announced: boolean;
}

/** Tài nguyên chỉ giữ cho ĐÚNG một loại thực thi đã chọn. */
export type ActivationResource = {
    readonly kind: 'local';
    readonly handle: AgentHandle;
    readonly outputStart: SessionLogOffset;
    readonly structured: StructuredAttachment | undefined;
    /** Lỗi sống gần nhất CHƯA bị một `turn/end` cam kết sau đó vượt qua. */
    failureAt: SessionLogOffset | undefined;
    /** Đổi mới khi kết toán cục bộ phải soát lại đầu vào hoặc con đang sở hữu. */
    poke: PromiseWithResolvers<void>;
} | {
    readonly kind: 'external';
    readonly run: SubagentRun;
    readonly controller: AbortController;
};

/** MỘT lượt thực thi được quản, kèm tài nguyên riêng của nhà cung cấp. */
export type Activation = ActivationBase & ActivationResource;

/** Lượt SỐNG CỤC BỘ: nhận thêm đầu vào và thu hoạch kết quả từ log Session. */
export type LocalActivation = Extract<Activation, {
    kind: 'local';
}>;

/**
 * Đọc Agent sống mà lượt thực thi cục bộ đang giữ.
 * Nhận: `activation` — lượt thực thi cục bộ hoặc ngoài đang được quản.
 * Trả: Agent cục bộ, `undefined` với lượt chạy ngoài.
 */
export function activationAgent(activation: Activation): Agent | undefined {
    return activation.kind === 'local' ? activation.handle.agent : undefined;
}

/**
 * Đòi lượt SỐNG CỤC BỘ trước khi nhận thêm đầu vào.
 * Nhận: `activation` — lượt thực thi mà giao phẩm nhắm tới.
 * Trả: đúng lượt thực thi cục bộ đó.
 * Ném: `SubagentError` mã `NOT_CONTINUABLE` khi backend ngoài không nhận thêm giao phẩm.
 */
export function requireLocalActivation(activation: Activation): LocalActivation {
    switch (activation.kind) {
        case 'local': return activation;
        case 'external':
            throw new SubagentError(`subagent "${activation.childId}" does not accept follow-up input`, 'NOT_CONTINUABLE');
        /* v8 ignore next 2 -- Both execution kinds are handled above. */
        default: return assertNever(activation);
    }
}

/**
 * Giữ lại lỗi cục bộ mà `turn/end` của nó KHÔNG cam kết được.
 * Nhận: `activation` — đúng Agent cục bộ và epoch nhận các quan sát có phạm vi;
 *   `wake` — đánh thức bộ theo dõi kết toán khi tình trạng sẵn sàng đổi.
 * Trả: không (chỉ đăng ký hai quan sát trên `ctx` của con).
 */
export function observeLocalFailure(activation: LocalActivation, wake: () => void): void {
    const child = activation.handle.agent;
    child.ctx.on('agent/error', ({ agent }) => {
        // So sánh qua `unknown`: payload `agent/error` mang kiểu `Agent` của kernel, còn `child` là `Agent` của gói GBH.
        if ((agent as unknown) !== (child as unknown))
            return;
        activation.failureAt = sessionLogOf(child).seq as unknown as SessionLogOffset;
        wake();
    });
    child.ctx.on('session/event', (session, event) => {
        // So sánh qua `unknown`: kiểu `Session` của kernel khác danh tính với `AgentSession` của gói GBH.
        if ((session as unknown) === (child.session as unknown) && event.type === 'turn/end'
            && activation.failureAt !== undefined && event.seq >= activation.failureAt) {
            activation.failureAt = undefined;
        }
    });
}

/**
 * Thu hoạch đầu ra cục bộ và giữ lỗi chưa có `turn/end` cam kết sau đó.
 * Nhận: `activation` — lượt thực thi cục bộ ĐÃ kết toán, kèm kết quả có cấu trúc nếu có.
 * Trả: đầu ra cuối, lý do dừng, và giá trị có cấu trúc đã cam kết (nếu đã cam kết).
 */
export function captureLocalResult(activation: LocalActivation): SubagentResult {
    // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
    const events = sessionLogOf(activation.handle.agent).snapshotEvents(activation.outputStart);
    const output = finalAssistantOutput(events) ?? [];
    const stopReason = activation.failureAt === undefined ? epochStopReason(events) : 'error';
    const structured = activation.structured;
    if (structured !== undefined) {
        const captured = structured.captured();
        if (captured !== undefined)
            return { output, stopReason, structured: captured.value };
        if (stopReason === 'completed')
            return { output, stopReason: 'error' };
    }
    return { output, stopReason };
}

/** Tuần tự hoá giao phẩm, nhả, và dọn của TỪNG con bền. */
export class ChildLock {
    /** Đuôi chuỗi thao tác của mỗi con; xoá khi đuôi đã cạn để không giữ promise chết. */
    private readonly tails = new Map<SessionId, Promise<void>>();

    /**
     * Chạy `operation` SAU mọi thao tác đã xếp trước đó của `childId`.
     * Nhận: `childId` — con bền có các thao tác cần tuần tự hoá; `operation` — vùng tới hạn chạy đúng thứ tự.
     * Trả: chính lời hứa kết toán của `operation` (KHÔNG phải đuôi hấp thụ lỗi).
     */
    run<T>(childId: SessionId, operation: () => Promise<T>): Promise<T> {
        const previous = this.tails.get(childId) ?? Promise.resolve();
        const result = previous.then(operation, operation);
        // Nuốt lỗi ngay trong đuôi chuỗi để một vùng tới hạn hỏng không làm hỏng bên gọi sau không liên quan.
        const tail = result.then(() => undefined, () => undefined);
        this.tails.set(childId, tail);
        void tail.then(() => {
            if (this.tails.get(childId) === tail)
                this.tails.delete(childId);
        });
        return result;
    }
}
