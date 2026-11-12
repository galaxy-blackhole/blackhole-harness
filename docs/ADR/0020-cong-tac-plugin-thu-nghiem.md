<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 24/10/2026
 desc ADR 0020 — sửa lỗi công tắc "Plugin thử nghiệm" luôn TẮT (so tên bundle gốc thay vì tên đã quy)
-->

# ADR 0020 — Công tắc plugin thử nghiệm luôn hiện TẮT

## Triệu chứng (Lead báo 24/10/2026)

Trang **Plugin → Plugin thử nghiệm**: mọi công tắc đều TẮT; bấm thì không bật được. Ví dụ "Nhóm agent"
đang **chạy thật** trong app mà công tắc vẫn TẮT.

## Truy vết

1. Bấm công tắc → trình duyệt gửi `POST /api/pluginManager/setBundleEnabled`.
2. Phản hồi: `{ ok: true, value: { target: "@galaxy-blackhole/gbh-agent-team-profile", enabled: true,
   changed: false, application: "applied" } }` — tức **profile đã bật từ trước**, không có gì đổi.
3. `listBundles()` tính `enabled` bằng `selected.includes(name)` với `name` là **tên bundle trong danh mục
   chính thức** (`@deepseek-ai/dsh-experimental-…`), trong khi hồ sơ của ta chọn bundle bằng **tên đã quy**
   (`@galaxy-blackhole/gbh-…`). Hai tập không giao nhau ⇒ mọi bundle đã bật đều bị báo `enabled:false`.

## Quyết định

`packages/host/plugin-manager/src/manager.ts`: `enabled = selected.includes(name) || selected.includes(quyTen(name))`.

## Hệ quả

- Đo lại: "Nhóm agent" hiện **BẬT** đúng trạng thái thật; bật "Nhập bằng giọng nói" → RPC `changed: true,
  enabled: true, application: "applied"` (đã thử rồi trả lại trạng thái cũ).
- Danh sách vẫn có **hai mục trùng tên** cho cùng một bundle (một từ `profile`, một từ `installation`).
  UI hiện chỉ vẽ một thẻ nên không lộ ra, nhưng đây là việc còn lại: gộp theo tên đã quy trước khi trả về.
- Công tắc có thể **chưa đổi màu ngay** sau khi bật: client chỉ cập nhật danh sách ở lượt nạp sau. Việc còn
  lại: gọi nạp lại danh sách ngay khi `setBundleEnabled` trả `changed: true`.
