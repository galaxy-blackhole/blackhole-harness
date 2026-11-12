/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cau hinh cua row hmr (HmrConfig) + schema schemastery — giu nguyen hinh dang ban goc.
 */
import { type ChokidarOptions } from "chokidar";
import z from "@deepseek-ai/schemastery";

/** Module roots va nhip watcher, kem tuy chon trien khai cua Chokidar (y ban goc). */
export interface HmrConfig extends ChokidarOptions {
  /** Thu muc duoc giai theo base URL cua context so huu. */
  base?: string;
  /** Goc theo doi module; danh sach rong thi chi con cac watch cau hinh tuong minh. */
  root: string[];
  /** Milisecond de gop cac thay doi module. */
  debounce: number;
  /** Mau glob bi loai khoi theo doi module. */
  ignored: string[];
}

/** Schema cau hinh Hmr — dung mac dinh va thu tu truong y ban goc (base · root · ignored · debounce). */
export const Config: z<HmrConfig> = z.object({
  base: z.string(),
  root: z.array(String).role("table").default(["."]),
  ignored: z.array(String).role("table").default(["**/node_modules", "**/.*", "cache", "data"]),
  debounce: z.natural().role("ms").default(100),
}) as unknown as z<HmrConfig>;
