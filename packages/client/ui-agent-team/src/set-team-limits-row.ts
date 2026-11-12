/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 23/10/2026
 * desc Hàng toolview RIÊNG cho tool BỔ SUNG `set_team_limits` (ADR 0013): đăng ký một keyed hit trên slot
 *      `tool.call.toolview` (key = tên tool) ⇒ THAY hàng generic của ui-tool, đúng cơ chế mà `list_agents` dùng,
 *      nhưng HOÀN TOÀN nằm trong gói của ta (không sửa gói port nguyên văn).
 */

import { SET_LIMITS_CLASS as css } from "./class-names.ts";
import type { TeamComponentRuntime, TeamTranslate } from "./team-types.ts";

/** Trần triển khai đọc được từ một lượt gọi `set_team_limits` (tham số hoặc kết quả). */
export interface TeamLimitsReading {
  /** Trần thành viên, khi đọc được. */
  readonly maxMembers?: number;
  /** Trần task, khi đọc được. */
  readonly maxTasks?: number;
}

/** Props mà slot keyed `tool.call.toolview` truyền cho occupant của nó. */
export interface SetTeamLimitsRowProps {
  /** Tên tool của lượt gọi (kỳ vọng `set_team_limits`). */
  readonly toolName?: string;
  /** Khối tool: đang chạy (`phase`) hoặc đã kết thúc (`kind`). */
  readonly block?: unknown;
  /** Hàm dịch của namespace `agent-team` do slot cấp. */
  readonly t?: TeamTranslate;
}

/** Một đối tượng mang khoá chuỗi, hoặc undefined khi giá trị không phải đối tượng. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** Parse JSON KHÔNG ném — trả undefined khi văn bản chưa phải JSON hợp lệ. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Đọc hai trần của Team từ một lượt gọi tool: ưu tiên tham số, sau đó tới văn bản kết quả ghi nhận.
 * Nhận: `block` — khối tool (đang chạy hoặc đã kết thúc) do slot truyền.
 * Trả: `{ maxMembers?, maxTasks? }` — trường nào không đọc được thì vắng mặt.
 */
export function readTeamLimits(block: unknown): TeamLimitsReading {
  const reading: { maxMembers?: number; maxTasks?: number } = {};
  const absorb = (value: unknown): void => {
    const record = asRecord(value);
    if (record === undefined) return;
    if (typeof record.maxMembers === "number") reading.maxMembers = record.maxMembers;
    if (typeof record.maxTasks === "number") reading.maxTasks = record.maxTasks;
  };
  const node = asRecord(block);
  if (node === undefined) return reading;
  absorb(node.args);
  if (typeof node.argsRaw === "string") absorb(parseJson(node.argsRaw));
  const call = asRecord(node.call);
  if (call !== undefined) {
    absorb(call.args);
    if (typeof call.argsRaw === "string") absorb(parseJson(call.argsRaw));
  }
  if (Array.isArray(node.content)) {
    for (const part of node.content) {
      const piece = asRecord(part);
      if (piece !== undefined && piece.type === "text" && typeof piece.text === "string") absorb(parseJson(piece.text));
    }
  }
  return reading;
}

/** Component hàng `set_team_limits` do factory sinh ra trên một runtime cụ thể. */
export type SetTeamLimitsRowComponent = (props: SetTeamLimitsRowProps) => unknown;

/** Dịch dự phòng khi slot không cấp `t` (chỉ xảy ra ngoài renderer thật). */
const FALLBACK_TITLE = "Set team limits";
/** Khuôn tóm tắt dự phòng khi slot không cấp `t`. */
const FALLBACK_SUMMARY = "{members} members · {tasks} tasks";

/**
 * Dựng component hàng toolview cho `set_team_limits` trên một runtime React/primitive cụ thể.
 * Nhận: `runtime` — react/jsx + primitive do loader cấp (xem `createPlugin`).
 * Trả: component nhận props của slot keyed và vẽ MỘT hàng ngang: icon hai người · tiêu đề · tóm tắt.
 */
export function createSetTeamLimitsRow(runtime: TeamComponentRuntime): SetTeamLimitsRowComponent {
  const { jsx, jsxs, primitives } = runtime;

  /**
   * Một hàng toolview cho `set_team_limits`.
   * Nhận: `props` — khối tool + hàm dịch của `agent-team` do slot cấp.
   * Trả: element hàng ngang (icon · tiêu đề · tóm tắt hai trần).
   */
  function SetTeamLimitsRow(props: SetTeamLimitsRowProps): unknown {
    const { t, block } = props;
    const reading = readTeamLimits(block);
    const title = t === undefined ? FALLBACK_TITLE : t("limits.title");
    const bothKnown = reading.maxMembers !== undefined && reading.maxTasks !== undefined;
    const summary =
      bothKnown
        ? t === undefined
          ? FALLBACK_SUMMARY.replace("{members}", String(reading.maxMembers)).replace("{tasks}", String(reading.maxTasks))
          : t("limits.summary", { members: String(reading.maxMembers), tasks: String(reading.maxTasks) })
        : undefined;
    return jsxs("div", {
      className: css.row,
      "data-tool": "set_team_limits",
      children: [
        jsx("span", {
          className: css.icon,
          children: jsx(primitives.IconUsersOutlineRegular, { size: 14 }),
        }),
        jsx("span", { className: css.title, children: title }),
        // Dấu chấm + tóm tắt: CÙNG khuôn row ui-tool (`.o3BgMG_sep` + `.o3BgMG_summary`) để hai hàng
        // đứng cạnh nhau không lệch nhịp.
        ...(summary === undefined ? [] : [
          jsx("span", { className: css.sep, "aria-hidden": true }),
          // KHÔNG bọc TextShimmer: bảng primitives của ta không export thành phần đó (đo 23/10/2026 —
          // dùng nó làm React ném "Element type is invalid" ⇒ UI trắng).
          jsx("span", { className: css.summary, children: summary }),
        ]),
      ],
    });
  }

  return SetTeamLimitsRow;
}
