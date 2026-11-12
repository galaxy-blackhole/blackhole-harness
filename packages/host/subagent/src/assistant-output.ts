/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Phép CHỌN CHUẨN đầu ra assistant cuối của một con: kết quả lượt chạy của backend và
 *      `subagent/end.lastAssistantMessage` áp CÙNG một luật — lấy message assistant KHÁC RỖNG cuối
 *      cùng; message rỗng chỉ ghi usage (lượt max-tokens không có khối thi hành được) nên KHÔNG thay
 *      đầu ra trước đó; không có message khác rỗng thì lấy văn bản assistant đã tích luỹ. Phép chọn
 *      độc lập với lý do dừng của lượt chạy. Port 1:1 lib/types/assistant-output.js của
 *      @deepseek-ai/dsh-subagent.
 */

import { joinAssistantStreamText } from "@deepseek-ai/dsh-llm";
import type { ContentBlock } from "@deepseek-ai/dsh-llm";
import type { SessionEvent } from "@galaxy-blackhole/gbh-session";

/**
 * Phép gộp TĂNG DẦN của luật chọn, cho backend quan sát đầu ra của con lúc nó đang chảy:
 * backend có sự kiện phiên đẩy từng sự kiện qua {@link push}, transport KHÔNG có sự kiện phiên
 * (khối nội dung ACP) đẩy văn bản thô qua {@link pushText} vào CÙNG dự phòng đã chảy.
 */
export class AssistantOutputFold {
    /** Message assistant KHÁC RỖNG gần nhất — ứng viên cho câu trả lời cuối. */
    private message: readonly ContentBlock[] | undefined;
    /** Các mảnh văn bản đã chảy, dùng làm dự phòng khi không có message nào khác rỗng. */
    private readonly partial: string[] = [];

    /**
     * Gộp MỘT sự kiện phiên: message assistant khác rỗng thành ứng viên câu trả lời cuối, còn
     * stream nhúng trong nó và mọi attempt chỉ-có-log thì nối vào dự phòng đã chảy; sự kiện khác
     * không đóng góp gì.
     * Nhận: `event` — sự kiện phiên kế tiếp được quan sát.
     * Trả: không (chỉ cập nhật trạng thái gộp của đối tượng).
     */
    push(event: SessionEvent): void {
        if (event.type === 'assistant/message') {
            const content = event.data.message.content;
            if (content.length > 0)
                this.message = content;
        }
        if (event.type === 'assistant/message' || event.type === 'assistant/attempt') {
            this.pushText(joinAssistantStreamText(event.data.stream));
        }
    }

    /**
     * Nối thêm văn bản quan sát được NGOÀI sự kiện phiên vào dự phòng đã chảy.
     * Nhận: `text` — mảnh văn bản đã chảy kế tiếp (mảnh rỗng là không làm gì).
     * Trả: không (chỉ cập nhật dự phòng của đối tượng).
     */
    pushText(text: string): void {
        if (text.length > 0)
            this.partial.push(text);
    }

    /**
     * Chọn đầu ra cuối từ những gì đã gộp tới lúc này.
     * Nhận: không.
     * Trả: message assistant khác rỗng cuối cùng, nếu không có thì văn bản đã chảy tích luỹ,
     *   hoặc `undefined` khi con không sinh ra cái nào.
     */
    collect(): readonly ContentBlock[] | undefined {
        if (this.message !== undefined)
            return this.message;
        const text = this.partial.join('');
        return text.length > 0 ? [{ type: 'text', text }] : undefined;
    }
}

/**
 * Áp luật chọn lên MỘT đoạn sự kiện do con sở hữu, trọn vẹn.
 * Nhận: `events` — sự kiện do con sở hữu (sau mọi mốc seed hoặc mốc epoch).
 * Trả: đầu ra đã chọn, hoặc `undefined` khi con không sinh ra đầu ra nào.
 */
export function finalAssistantOutput(events: readonly SessionEvent[]): readonly ContentBlock[] | undefined {
    // TODO: chỗ này gộp TRỌN đoạn một lần cho mỗi lần kết toán lượt chạy/epoch. Nếu một epoch
    // continuable dài về sau nóng ở đây thì quét NGƯỢC, thoát sớm khi gặp message khác rỗng cuối,
    // và chỉ gộp delta văn bản ở nhánh dự phòng không-có-message.
    const fold = new AssistantOutputFold();
    for (const event of events)
        fold.push(event);
    return fold.collect();
}
