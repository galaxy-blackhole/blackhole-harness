/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Dựng lại có trạng thái các định nghĩa công cụ lịch sử cho phép chiếu yêu cầu: gộp header đã
 *      commit và thông điệp developer độc lập với năng lực model. Port 1:1 vùng
 *      `lib/types/tool-history.js` (75 dòng) của `@deepseek-ai/dsh-session`.
 */

/**
 * Dựng lại có trạng thái các định nghĩa công cụ lịch sử dùng cho phép chiếu yêu cầu.
 *
 * @module @galaxy-blackhole/gbh-session/tool-history
 */

import type { ContentBlock, ToolHistory, ToolSchema } from '@galaxy-blackhole/gbh-llm';
import { deepFreeze } from '@galaxy-blackhole/gbh-util-values';

import type { SessionEvent, SessionSeq } from './types.ts';

/**
 * Gộp header đã commit và thông điệp developer, độc lập với năng lực model.
 */
export class ToolHistoryProjection {
  /** Các khai báo lịch sử, tra theo seq của header mà phần bổ sung tham chiếu. */
  private readonly headers = new Map<SessionSeq, readonly ToolSchema[]>();
  /** Các định nghĩa được giữ trong chuỗi khai báo hiện tại, kể cả công cụ đã bị gỡ. */
  private declared = new Map<string, ToolSchema>();
  /** Các định nghĩa đang hoạt động từ header yêu cầu mới nhất. */
  private active: readonly ToolSchema[] = [];
  /** Các tên đang hoạt động, dựng lại từ mốc gốc và các cập nhật đã ghi. */
  private available = new Set<string>();
  /** Header mở đầu chuỗi khai báo hiện tại; vắng mặt trước header đầu tiên. */
  private baselineSeq: SessionSeq | undefined;
  /** Ảnh chụp yêu cầu bất biến của mốc gốc hiện tại và các cập nhật đã phân giải. */
  private history: ToolHistory = deepFreeze({ tools: [], updates: [] });

  /**
   * Tiêu thụ sự kiện đã commit tiếp theo theo thứ tự log.
   *
   * Nhận: event — một sự kiện phiên, kể cả sự kiện thừa kế khi khôi phục.
   * Trả: không trả về giá trị; cập nhật các bản đồ khai báo, tên hoạt động và ảnh chụp lịch sử.
   *
   * @param event - một sự kiện phiên, kể cả sự kiện thừa kế khi khôi phục.
   */
  apply(event: SessionEvent): void {
    if (event.type === 'request/header') {
      const tools = event.data.header.tools ?? [];
      this.headers.set(event.seq, tools);
      // Một tên được giữ lại không thể nhận định nghĩa khác mà vẫn tái dùng tiền tố; một tên khôi
      // phục không đổi vẫn được chào lại bằng đúng phần bổ sung đã ghi của nó.
      const redeclared = tools.some((tool: ToolSchema) => {
        const before = this.declared.get(tool.name);
        return before !== undefined && JSON.stringify(before) !== JSON.stringify(tool);
      });
      if (this.baselineSeq === undefined || event.data.reason === 'series' || event.data.startsSeries || redeclared) {
        this.baselineSeq = event.seq;
        this.declared = new Map(tools.map((tool: ToolSchema): [string, ToolSchema] => [tool.name, tool]));
        this.history = deepFreeze({ tools, updates: [] });
        this.available = new Set(tools.map((tool: ToolSchema) => tool.name));
      }
      this.active = tools;
    } else if (event.type === 'developer/message') {
      const { message, headerSeq } = event.data;
      const definitions = headerSeq === undefined ? [] : this.headers.get(headerSeq);
      const additions = message.content.flatMap((block: ContentBlock) => {
        if (block.type !== 'tool-addition') return [];
        const tool = definitions?.find((tool) => tool.name === block.toolName);
        if (tool === undefined) throw new Error(`tool history: missing definition for ${block.toolName}`);
        return [tool];
      });
      for (const tool of additions)
        this.declared.set(tool.name, tool);
      for (const block of message.content) {
        if (block.type === 'tool-addition')
          this.available.add(block.toolName);
        else if (block.type === 'tool-removal')
          this.available.delete(block.toolName);
      }
      this.history = deepFreeze({
        tools: this.history.tools,
        updates: [...this.history.updates, { messageId: message.id, additions }],
      });
    }
  }

  /**
   * Đọc một ảnh chụp bất biến; các sự kiện về sau không làm nó thay đổi.
   *
   * Nhận: không.
   * Trả: các khai báo ban đầu và phần bổ sung đã phân giải theo lịch sử cho chuỗi hiện tại.
   *
   * @returns các khai báo ban đầu và phần bổ sung đã phân giải theo lịch sử cho chuỗi hiện tại.
   */
  snapshot(): ToolHistory {
    // Các phiên ghi trước khi có phát tool-update có header không kèm cập nhật tương ứng.
    if (this.active.length !== this.available.size || this.active.some((tool) => !this.available.has(tool.name))) {
      return deepFreeze({ tools: this.active, updates: [] });
    }
    return this.history;
  }
}
