/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Thư do mô hình NHÌN THẤY mà điều phối subagent continuable sở hữu: thư giữa hai Agent liền kề,
 *      chỉ dẫn trả kết quả gắn vào việc ban đầu của con continuable, và thông báo kết toán do runtime
 *      dựng từ văn bản đóng của con. Port 1:1 lib/types/continuation-messages.js của
 *      @deepseek-ai/dsh-subagent; hai hình nguồn thư khai theo CẤU TRÚC (không augment module).
 */

import type { Agent } from "@galaxy-blackhole/gbh-agent";
import { boundContextSummary, createUserMessage } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, MessageSource, UserMessage } from "@deepseek-ai/dsh-llm";
import type { SessionId } from "@galaxy-blackhole/gbh-session";
import type { SubagentResult } from "./types.ts";

/** Nguồn gốc BỀN cho một thư do mô hình viết giữa hai Agent. */
export interface AgentMessageSource {
    readonly kind: 'agent-message';
    /** Thư một agent gửi cho agent này (hình ngữ cảnh `relay`). */
    readonly form: 'relay';
    /** Danh tính phiên của Agent mà lời gọi công cụ của nó sinh ra thư này. */
    readonly senderSessionId: SessionId;
}

/**
 * Nguồn gốc BỀN cho bản tường thuật của CHÍNH runtime về việc một con continuable kết toán.
 * Cố ý KHÁC `kind` với {@link AgentMessageSource}: thư Agent là nội dung do bên gửi CHỌN, còn thư
 * này là manager nói điều gì đã xảy ra với con — một bản ghi gộp hai loại sẽ gán cho con những lời
 * nó chưa từng viết.
 */
export interface SubagentSettledMessageSource {
    readonly kind: 'subagent-settled';
    /** Bản tường thuật của runtime, hiện KHÔNG cần mở rộng dòng (hình ngữ cảnh `notice`). */
    readonly form: 'notice';
    /** Bản tường thuật MỘT DÒNG về cách con kết thúc. */
    readonly summary: string;
    /** Danh tính phiên của ĐỨA CON đã kết toán. */
    readonly senderSessionId: SessionId;
}

/**
 * Dựng phần gán nguồn BỀN cho MỘT thư giữa hai Agent liền kề.
 * Nhận: `sender` — đúng Agent sống đã viết thư.
 * Trả: hình nguồn `agent-message`/`relay` trỏ tới phiên của bên gửi.
 */
function agentMessageSource(sender: Agent): AgentMessageSource {
    return {
        kind: 'agent-message',
        form: 'relay',
        // sender.id là chuỗi id của gói GBH; trường này brand SessionId ⇒ ép tại biên.
        senderSessionId: sender.id as unknown as SessionId,
    };
}

/**
 * Dựng hình mô hình-nhìn-thấy VÀ bền của MỘT thư giữa hai Agent liền kề.
 * Nhận: `sender` — đúng Agent sống đã viết thư; `content` — các khối thư do bên gửi cung cấp.
 * Trả: thư người dùng bền để giao cho bên nhận.
 */
export function createAgentMessage(sender: Agent, content: ContentBlock[]): UserMessage {
    // MỘT phép ép tại đúng biên dựng thư: bản gốc augment `MessageSourceMap` của kernel, bản viết
    // lại KHÔNG augment module (luật 000d) nên hình nguồn được khai theo CẤU TRÚC ở trên và chỉ
    // cần đi qua đúng một lần ép; hình dạng lúc chạy y hệt bản gốc.
    return createUserMessage({
        content: [
            { type: 'text', text: `Agent ${sender.id} sent a message: ` },
            ...content,
        ],
        source: agentMessageSource(sender) as unknown as MessageSource,
    });
}

/**
 * Gắn chỉ dẫn trả kết quả giữa hai Agent liền kề vào việc BAN ĐẦU của một con continuable.
 * Nhận: `parentId` — danh tính phiên cha bền được nêu trong chỉ dẫn; `prompt` — các khối việc
 *   ban đầu mà mô hình nhìn thấy.
 * Trả: các khối việc đó, nối thêm chỉ dẫn trả kết quả của con continuable.
 */
export function withContinuableReturnGuidance(parentId: SessionId, prompt: ContentBlock[]): ContentBlock[] {
    const encodedParentId = JSON.stringify(parentId);
    return [
        ...prompt,
        {
            type: 'text',
            text: `Your parent agent id is ${encodedParentId}. Before you finish, send your result to that agent with `
                + `send_message({ agent_id: ${encodedParentId}, message: "<self-contained result>" }). The parent shares `
                + 'your workspace but does not automatically receive your transcript, tool output, or reasoning. Send '
                + 'earlier messages as well when a finding changes what the parent should do next; sending a message '
                + 'does not end your turn.',
        },
    ];
}

/**
 * MỘT dòng nói cho cha biết con nền đã xong và vì sao, bằng chính từ vựng việc của cha.
 * Nhận: `childId` — con bền mà cha biết theo id; `stopReason` — lượt thường cuối của con đã kết
 *   thúc thế nào; `continuable` — con có nhận thêm thư về sau hay không.
 * Trả: dòng mở đầu hướng mô hình của thông báo kết toán.
 */
function settlementSummary(childId: SessionId, stopReason: SubagentResult['stopReason'], continuable: boolean): string {
    const subject = `Background subagent ${childId}`;
    switch (stopReason) {
        case 'completed':
            return continuable
                ? `${subject} finished and will do no further work unless you send it more.`
                : `${subject} finished. It cannot receive follow-up messages.`;
        case 'aborted':
            return `${subject} was stopped before it finished.`;
        case 'max-tokens':
            return `${subject} ran out of room before it finished.`;
        // Một lần từ chối TRƯỚC bước — hook từ chối, plugin chính sách — đã bỏ đầu vào mà con đã
        // nhận, nên cha KHÔNG được coi việc là xong.
        case 'refusal':
            return `${subject} declined the task.`;
        case 'error':
            return `${subject} failed before it finished.`;
        /* v8 ignore next 4 -- `SubagentResult['stopReason']` is merge-extensible, so this arm
         * needs a backend that adds a variant; an unnameable ending is reported as unfinished
         * rather than silently as success. */
        default:
            return `${subject} ended abnormally (${String(stopReason)}) before it finished.`;
    }
}

/**
 * Dựng thông báo kết toán do runtime sở hữu từ văn bản đóng KHÁC RỖNG của con.
 * Nhận: `childId` — danh tính phiên con bền được nêu trong thông báo; `terminal` — trạng thái kết
 *   thúc đã ghi của Activation đã kết toán; `continuable` — con còn nhận việc khác hay không
 *   (mặc định `true`).
 * Trả: thư người dùng bền để giao cho cha.
 */
export function createSettlementMessage(childId: SessionId, terminal: SubagentResult, continuable = true): UserMessage {
    const summary = settlementSummary(childId, terminal.stopReason, continuable);
    // Provider của cha nhận thông báo này như thư người dùng và có thể từ chối khối assistant phi
    // văn bản. Giữ phép chuyển CỤC BỘ để consumer SDK/UI vẫn nhận đủ đầu ra của con.
    const closingText = terminal.output.flatMap(block => block.type === 'text' && block.text.length > 0 ? [block] : []);
    const closingBlocks: ContentBlock[] = closingText.length === 0
        ? [{ type: 'text', text: 'It left no closing message.' }]
        : [{ type: 'text', text: 'Its closing message:' }, ...closingText];
    const structuredBlocks: ContentBlock[] = terminal.structured !== undefined
        ? [{ type: 'text', text: `Structured result: ${JSON.stringify(terminal.structured)}` }]
        : [];
    const diagnosticBlocks: ContentBlock[] = terminal.diagnostic !== undefined
        ? [{ type: 'text', text: terminal.diagnostic }]
        : [];
    const content: ContentBlock[] = [
        { type: 'text', text: summary },
        ...closingBlocks,
        ...structuredBlocks,
        ...diagnosticBlocks,
    ];
    return createUserMessage({
        content,
        source: {
            kind: 'subagent-settled',
            form: 'notice',
            summary: boundContextSummary(summary),
            senderSessionId: childId,
        } as unknown as MessageSource,
    });
}
