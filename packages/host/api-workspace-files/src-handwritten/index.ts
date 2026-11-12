/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc NỬA HOST của row workspace-files: dịch vụ `workspaceFiles` — đọc trước tệp theo dòng/byte, thống kê,
 *      liệt kê thư mục workspace, và dòng thay đổi của đích, trên seam filesystem của kernel. Nguồn đối
 *      chiếu: README.md của package (G4).
 */

// Bề mặt export GIÁ TRỊ phải BẰNG bản gốc: chỉ `WorkspaceFiles` + `default`. `WorkspaceChangeFeed`/`ChangeFollower`
// là ruột của `changes` (bản gốc cũng KHÔNG xuất chúng) ⇒ giữ nội bộ, nếu không `check:rows` sẽ thấy thừa.
export { WorkspaceFiles } from "./service.ts";
export { WorkspaceFiles as default } from "./service.ts";
export type * from "./types.ts";
