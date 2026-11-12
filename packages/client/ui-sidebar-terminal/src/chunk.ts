/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Điểm vào của chunk lazy client.terminal.js: CHỈ xuất TerminalBody, để build.ts bọc thành script classic
 */

// Chunk KHÔNG được là ESM: bộ nạp tải nó bằng thẻ script classic (qua require.async), nên build.ts gói
// phần này ở dạng CJS rồi bọc trong lời gọi window.__ModuleLoader__.load({ id, chunk, factory }).
// File này chỉ xuất thân terminal; xterm được bundle ngay trong chunk (devDependency của gói).
export { createTerminalBody, ensureTerminalCss } from "./terminal/body.ts";
export type { TerminalBodyProps } from "./terminal/body.ts";
