/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Schema cau hinh cua row shortcuts o nua host (schemastery cua kernel)
 */

import z from "@deepseek-ai/schemastery";
import { DEFAULT_STOP_SEQUENCE_MS, MAX_STOP_SEQUENCE_MS } from "./ids.ts";

/** Cấu hình chuỗi phím cố định. */
export interface Config {
  /** Khoảng cách tối đa giữa hai lần Escape liên tiếp để dừng trả lời (ms). */
  stopSequenceMs: number;
}

/** Cấu hình triển khai đã kiểm cho chuỗi bàn phím cố định. */
export const Config = z.object({
  stopSequenceMs: z.natural().min(1).max(MAX_STOP_SEQUENCE_MS).default(DEFAULT_STOP_SEQUENCE_MS),
});
