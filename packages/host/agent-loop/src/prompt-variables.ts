/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Đăng ký ba biến prompt mà vòng lặp agent đóng góp: `provider`, `model` (id trên dây) và `model_label`
 *      (nhãn hiển thị của route — route `auto` đọc là "Galaxy Blackhole"). Tách khỏi plugin.ts (ngưỡng 1000 dòng).
 */

import { modelLabel } from "./model-label.ts";

/** Bề mặt sổ prompt mà ba biến này cần (khai theo CẤU TRÚC, đúng như plugin.ts vẫn làm). */
export interface PromptVariablesSeam {
  /**
   * Đăng ký một biến nội suy được.
   * @param name - tên biến (chữ thường, chữ số, gạch dưới).
   * @param provider - hàm trả giá trị cho ngữ cảnh lắp prompt hiện tại.
   * @returns hàm gỡ đăng ký.
   */
  variable(name: string, provider: (context: { readonly agent?: { readonly options: { readonly provider?: string; readonly model?: string } } }) => string | undefined): () => void;
}

/**
 * Đăng ký `provider`, `model` và `model_label` trên sổ system prompt.
 * @param systemPrompt - sổ prompt của deployment.
 * @returns không; cả ba biến sống cùng vòng đời của sổ.
 */
export function registerPromptVariables(systemPrompt: PromptVariablesSeam): void {
  systemPrompt.variable("provider", (context) => context.agent?.options.provider);
  systemPrompt.variable("model", (context) => context.agent?.options.model);
  // 11/11/2026 — nhãn HIỂN THỊ của route: `{{model}}` là id trên dây, nên persona của preset in ra
  // "…deepseek-v4.1-flash model" dù người dùng chọn "Auto". `{{model_label}}` trả "Galaxy Blackhole" cho
  // route quản lý `auto` và giữ id model thật cho mọi route khác (xem model-label.ts).
  systemPrompt.variable("model_label", (context) => modelLabel(context.agent?.options.provider, context.agent?.options.model));
}
