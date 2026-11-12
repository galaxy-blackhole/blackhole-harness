/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Mô tả ĐÚNG NGHĨA + ĐA NGÔN NGỮ cho các gói của ta trong màn Plugins (en · zh · vi); gộp 2 nửa A/B
 */

import { PLUGIN_DESCRIPTIONS_A } from "./plugin-descriptions-a.ts";
import { PLUGIN_DESCRIPTIONS_B } from "./plugin-descriptions-b.ts";

/** Một mô tả đa ngôn ngữ: đủ ba ngôn ngữ UI đang phục vụ. */
export interface PluginDescription {
  readonly en: string;
  readonly zh?: string;
  readonly vi: string;
}

export const PLUGIN_DESCRIPTIONS: Record<string, PluginDescription> = {
  ...PLUGIN_DESCRIPTIONS_A,
  ...PLUGIN_DESCRIPTIONS_B,
};
