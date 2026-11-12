/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/parse.js' của @deepseek-ai/dsh-plugin-market (vùng worker.cjs dòng 1705–1753):
 *      giải mã UTF-8 nghiêm ngặt → JSON.parse → validate format 1 bằng parseMarketIndex của dep
 *      @deepseek-ai/dsh-plugin-market-index (dep KHÔNG port lại, import thẳng).
 */
import { MarketIndexError, parseMarketIndex, type MarketIndex } from "@deepseek-ai/dsh-plugin-market-index";

/** Index đã validate, hoặc JSON path + luật + chẩn đoán của vi phạm ĐẦU TIÊN; `$` phủ lỗi UTF-8 và JSON. */
export type IndexParseResult =
  | {
      readonly ok: true;
      readonly index: MarketIndex;
    }
  | {
      readonly ok: false;
      readonly path: string;
      readonly reason: string;
      readonly message: string;
    };

/** Yêu cầu một parse Worker nhận qua `workerData`. */
export interface IndexParseRequest {
  /** Toàn bộ thân phản hồi đã tải. */
  readonly body: Uint8Array;
  /** URL của index — icon tham chiếu tương đối phân giải theo URL này. */
  readonly url: string;
}

/**
 * Giải mã thân phản hồi thành UTF-8 nghiêm ngặt, parse JSON, rồi validate thành format 1.
 * Nhận: body — toàn bộ thân phản hồi; url — URL index để phân giải icon tương đối.
 * Trả: index đã validate, hoặc vi phạm đầu tiên (path/reason/message).
 */
export function parseIndexBody(body: Uint8Array, url: string): IndexParseResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    // TextDecoder chế độ fatal chỉ ném lỗi khi UTF-8 hỏng.
    return { ok: false, path: "$", reason: "must be UTF-8", message: "must be UTF-8" };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const reason = `must be JSON: ${(error as Error).message}`;
    return { ok: false, path: "$", reason, message: reason };
  }
  try {
    return { ok: true, index: parseMarketIndex(value, url) };
  } catch (error) {
    /* v8 ignore next -- parseMarketIndex chỉ ném đúng lỗi validate của chính nó */
    if (!(error instanceof MarketIndexError)) throw error;
    return { ok: false, path: error.path, reason: error.reason, message: error.message };
  }
}
