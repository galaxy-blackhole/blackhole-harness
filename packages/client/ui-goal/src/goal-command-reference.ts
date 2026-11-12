/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chip tham chieu lenh /goal + rule nhan dien token lenh da xac nhan trong van ban nguoi dung
 */

/** Một dải lệnh đã xác nhận chạy trong văn bản người dùng. */
export interface CommandRange {
  /** Vị trí bắt đầu (đã tính cả dấu /). */
  readonly start: number;
  /** Vị trí kết thúc (không tính). */
  readonly end: number;
  /** Tên lệnh, không có dấu /. */
  readonly name: string;
}

/** Node chip mà rule sinh ra. */
export interface CommandReferenceMatch {
  /** Id của data. */
  readonly id: string;
  /** Vị trí bắt đầu. */
  readonly start: number;
  /** Vị trí kết thúc. */
  readonly end: number;
  /** Dữ liệu cho chip. */
  readonly data: { readonly name: string };
}

/** Ngữ cảnh mà renderer văn bản người dùng cấp cho rule. */
export interface UserTextRuleContext {
  /** Đọc dữ liệu đã phân tích của node đang xét. */
  readonly read: (key: string) => readonly CommandRange[] | undefined;
}

/**
 * Rule sở hữu chip lệnh: chỉ nhận token nằm ĐÚNG trong dải đã xác nhận chạy, và chỉ khi ranh giới hai
 * đầu là khoảng trắng (hoặc đầu/cuối chuỗi). Nhờ vậy chữ /goal xuất hiện lại trong objective vẫn là
 * văn bản thường.
 */
export const goalCommandReferenceRule = {
  /** Id của data mà rule sinh ra. */
  id: "command",
  /** Thứ tự trong sổ rule. */
  order: 20,
  /**
   * Tìm token lệnh gần nhất tính từ vị trí đang xét.
   * Nhận: văn bản gốc, vị trí bắt đầu tìm và ngữ cảnh đọc dữ liệu (facts.commands).
   * Trả: node chip, hoặc undefined khi không có token nào thoả.
   */
  match(text: string, from: number, context: UserTextRuleContext): CommandReferenceMatch | undefined {
    const slash = /(?<!\S)\//gu;
    slash.lastIndex = from;
    if (!slash.test(text)) return undefined;
    const commands = context.read("commands");
    let best: CommandReferenceMatch | undefined;
    for (const { start, end, name } of commands ?? []) {
      if (
        start < from ||
        end > text.length ||
        text.slice(start, end) !== "/" + name ||
        (start !== 0 && !/\s/u.test(text.slice(start - 1, start))) ||
        (end !== text.length && !/\s/u.test(text.slice(end, end + 1)))
      ) {
        continue;
      }
      if (best === undefined || start < best.start || (start === best.start && end > best.end)) {
        best = { id: "command", start, end, data: { name } };
      }
    }
    return best;
  },
};

/** React runtime tối thiểu mà chip dùng. */
export interface ReferenceReact {
  /** Dựng element một con. */
  jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
}

/**
 * Dựng chip lệnh không tương tác.
 * Nhận: React runtime và component ReferenceChip của bộ nguyên thuỷ.
 * Trả: component GoalCommandReference.
 */
export function createGoalCommandReference(
  react: ReferenceReact,
  primitives: { ReferenceChip: unknown },
): (props: { node: { readonly data: { readonly name: string } }; raw: string }) => unknown {
  /**
   * Vẽ một token lệnh đã xác nhận, không thêm hành động kích hoạt nào.
   * Nhận: node đã phân giải và cách viết gốc.
   * Trả: chip lệnh nội tuyến không tương tác.
   */
  function GoalCommandReference(props: { node: { readonly data: { readonly name: string } }; raw: string }): unknown {
    const { node, raw } = props;
    return react.jsx(primitives.ReferenceChip, {
      appearance: "command",
      label: "/" + node.data.name,
      title: raw,
    });
  }

  return GoalCommandReference;
}
