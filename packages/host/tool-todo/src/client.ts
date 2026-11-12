/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nửa CLIENT của gói tool-todo — port 1:1 lib/types/types.js + lib/types/client.js (9 dòng) của @deepseek-ai/dsh-tool-todo: CHỈ kiểu thuần, không giá trị chạy, để client dùng CHUNG một nguồn với host.
 */

// Client chỉ được import namespace client (kỷ luật repo), nên đây là phép CHIẾU thuần của nguồn kiểu bên
// host: `export type` bị xoá hoàn toàn khi build ⇒ bundle trình duyệt KHÔNG kéo @deepseek-ai/dsh-tools.
export type { TodoItem, TodoStatus } from "./index.ts";
