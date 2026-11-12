/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hàm render dùng chung của seam shell: tách marker trạng thái thoát ([exit code: N] /
 *      [killed by signal: X]) khỏi thân kết quả đã render — port 1:1 lib/types/render.d.ts của
 *      @deepseek-ai/dsh-shell.
 */

/**
 * Hàm render dùng chung cho các tool shell (`dsh-tool-bash`, `dsh-tool-pwsh`): hợp đồng marker
 * trạng thái thoát mà renderer của các tool phát ra, `presentResult` phía Host phân tích ở đây, và
 * model thẻ terminal phía Web phản chiếu mà không import mã Host.
 * @module @galaxy-blackhole/gbh-shell/render
 */

/**
 * Trạng thái thoát thu được từ một kết quả đã render, cùng thân output mà trạng thái đó được tách ra.
 */
export type ParsedExitStatus = {
  /** Phần output còn lại sau khi bỏ marker trạng thái thoát ở cuối chuỗi. */
  body: string;
} & (
  | {
      /** Mã thoát của tiến trình khi marker `[exit code: N]` xuất hiện. */
      exitCode: number;
    }
  | {
      /** Tên tín hiệu đã kết liễu tiến trình khi marker `[killed by signal: X]` xuất hiện. */
      signal: string;
    }
);

/**
 * Tách một chuỗi kết quả tool shell đã render thành thân output và trạng thái thoát có cấu trúc —
 * phép nghịch đảo của các marker `[exit code: N]` / `[killed by signal: X]` mà renderer của tool
 * shell nối vào cuối. Marker bị giết cho `signal`; ngược lại marker khác 0 cho `exitCode`; vắng cả
 * hai nghĩa là thoát sạch 0.
 *
 * Marker đã tiêu thụ được bỏ khỏi `body` vì phần trình bày terminal hiển thị trạng thái thoát thành
 * một pill riêng: giữ marker trong output sẽ render trạng thái thoát hai lần. Các marker khác
 * (timeout, sandbox từ chối) mang sự thật mà không pill nào hiển thị, nên chúng ở lại trong body.
 *
 * Replay chỉ giữ nội dung đã render, không giữ `ShellRunResult` gốc, nên phần trình bày terminal phải
 * khôi phục pill thoát ở đây. Yêu cầu có newline đứng trước và khớp ở cuối chuỗi giữ cho output bình
 * thường chỉ tình cờ kết thúc bằng văn bản giống marker không bị khớp — trừ khi dòng cuối thật sự
 * không phân biệt được với marker thật.
 *
 * @param text Kết quả tool shell đã render, hướng tới model.
 * @returns Thân output không còn marker, kèm mã thoát hoặc tên tín hiệu terminal đã khôi phục.
 */
export function parseExitStatus(text: string): ParsedExitStatus {
  const signal = /\n\[killed by signal: ([^\]\n]+)\]$/.exec(text);
  if (signal?.[1] !== undefined) {
    return {
      body: text.slice(0, signal.index),
      signal: signal[1],
    };
  }
  const exit = /\n\[exit code: (\d+)\]$/.exec(text);
  if (exit?.[1] !== undefined) {
    return {
      body: text.slice(0, exit.index),
      exitCode: Number(exit[1]),
    };
  }
  return {
    body: text,
    exitCode: 0,
  };
}
