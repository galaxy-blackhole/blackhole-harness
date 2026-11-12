<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 24/10/2026
 desc Gói host gbh-session-delete — xoá vĩnh viễn nhật ký một phiên đã lưu (ADR 0016)
-->

# @galaxy-blackhole/gbh-session-delete

Dịch vụ Remote `sessionDelete.delete({ sessionId })`: xoá **vĩnh viễn** một phiên đã lưu.

## Vì sao tồn tại

Trước 24/10/2026 app chỉ có **Lưu trữ** (ẩn khỏi danh sách, khôi phục được); nhật ký phiên vẫn nằm trên đĩa.
Người dùng cần dọn hẳn phiên rác (phiên nháp, phiên thử, phiên lỗi).

## Hợp đồng

| Hạng mục | Nội dung |
|---|---|
| Service Cordis | `sessionDelete` (một lớp `TypertRemoteService`, tự lộ qua Gateway ở chế độ source-mode) |
| Endpoint | `sessionDelete/delete` — tham số `{ sessionId }`, kết quả `{ deleted: true, path }` |
| Seam cần | `sessionPersistence` (bắt buộc), `sessions` + `sessionQuery` (tuỳ chọn, chỉ đọc) |
| Mã lỗi | `session/delete-invalid` · `delete-live` · `delete-unavailable` · `delete-not-found` · `delete-ambiguous` · `delete-unsafe` · `delete-failed` |

## Ba bước xoá

1. **Chặn khi phiên còn sống** trong tiến trình (`sessions.get(id)`) — trả `session/delete-live` để UI bảo người dùng dừng phiên trước.
2. **Gỡ đúng thư mục nhật ký**: dò `<root>/<project>/<id>` (không đoán tên đã mã hoá), giải symlink rồi khẳng định
   đường dẫn thật vẫn **nằm trong** `<root>` và thư mục **trông như nhật ký** (có tệp `events*`). Sai một điều
   kiện là từ chối, không xoá.
3. **Đối soát chỉ mục**: gọi một lượt `sessionQuery.listSessions()`; bộ đếm SQLite tự gỡ dòng đã mất tệp
   (`persistentDeletes` trong `_reconcile`), nên không cần API xoá riêng cho chỉ mục.

## Kiểm thử

`tests/host/session-delete.test.ts` — id có an toàn làm tên thư mục, dò đúng thư mục, **không đi theo symlink**,
từ chối thư mục ngoài gốc và thư mục không có nhật ký. Test dùng thư mục tạm, không chạm dữ liệu thật.
