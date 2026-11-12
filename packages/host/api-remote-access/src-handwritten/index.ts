/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc NỬA HOST của row remote-access: điều khiển truy cập mức PHƯƠNG THỨC cho Gateway — quyết định
 *      allow/deny theo chính sách của từng loại principal, lọc mục danh sách qua allows(), và ảnh chụp
 *      quyền theo Peer. Nguồn đối chiếu: README.md của package (G4).
 */

export { REMOTE_ACCESS_SNAPSHOT_KEY } from "./snapshot.ts";
export { RemoteAccessService } from "./service.ts";
export { RemoteAccessService as default } from "./service.ts";
export type * from "./types.ts";
