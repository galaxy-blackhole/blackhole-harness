<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 24/10/2026
 desc ADR 0019 — trả lại nút "Sửa" cho provider Galaxy Blackhole (route `auto`) trên trang Model
-->

# ADR 0019 — Trả lại nút "Sửa" cho provider Galaxy Blackhole

## Bối cảnh

Ngày 22/10/2026 bản build của `ui-settings-models` được vá để **ẩn nút "Sửa"** (và nhãn "Tuỳ chỉnh") cho
provider `auto` — lý do khi đó: route này khai trong `app.patch.yml` nên "không có gì để người dùng tự sửa".

Thực tế ngược lại: provider `auto` **giữ API key** của Galaxy Blackhole (trang Model hiện dấu "Đã cấu hình
API key"). Ẩn nút "Sửa" ⇒ người dùng không có đường nào đổi khoá.

## Quyết định

Bỏ lời gọi `anNutSua()` trong `packages/client/ui-settings-models/build.ts` (giữ `anNhanTuyChinh()`).
Kết quả: thẻ provider có nút **Sửa**; bấm vào mở bảng soạn đúng khuôn DSH gốc — "Khoá API" (password,
"Để trống để dùng thông tin đã lưu"), "Tên hiển thị", "URL gốc", "Cài đặt tuỳ chỉnh", Huỷ / **Áp dụng**.

## Hệ quả

- Đo thật 24/10/2026 (probe trình duyệt): thẻ có `Sửa`; bấm mở `input[type=password][aria-label="Khoá API"]`
  + `Áp dụng`; không lỗi console.
- Nhãn "Tuỳ chỉnh" **vẫn ẩn** cho route `auto`: provider này dựng sẵn, không phải người dùng tự khai.
- Test parity của gói vẫn so cây với bản gốc; `anNutSua` không tham gia nên không có ngoại lệ mới.
