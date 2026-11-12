<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc Kế hoạch migrate log khi đổi tên row/namespace session-log-deepseek -> session-log-gbh: đọc cả hai loại sự kiện, ghi loại mới, log cũ vẫn đọc được, test watermark.
-->

# KẾ HOẠCH MIGRATE LOG — đổi tên `session-log-deepseek` → `session-log-gbh`

> Ngày: 08/11/2026 · Người lập: dev-3 · Quyết định: **chủ dự án** (đổi tên gói/row/namespace, kèm migrate log)
> Phạm vi: gói `@galaxy-blackhole/gbh-session-log` (trước là `...-session-log-deepseek`) + client `ui-settings-session-log`.

## 0. Vì sao KHÔNG đổi cứng loại sự kiện

`ACCEPTED_EVENT_TYPE` cũ là `session-log-deepseek/delivery-accepted` và **đã được ghi vào log phiên của người dùng**.
Đổi cứng ⇒ log cũ mất mốc `acceptedThrough` ⇒ lần gửi kế tiếp gửi lại toàn bộ lịch sử (phình request) hoặc tính sai watermark.
Vì vậy: **giữ khả năng ĐỌC loại cũ**, chỉ **GHI loại mới**.

## 1. Hành vi sau migrate (mã đã áp)

| phần | loại sự kiện | ghi chú |
|---|---|---|
| Đọc khi tính `acceptedThrough` | **CẢ HAI**: `session-log-deepseek/delivery-accepted` (cũ) + `session-log-gbh/delivery-accepted` (mới) | `packages/host/session-log/src/acceptance.ts`: `LEGACY_ACCEPTED_EVENT_TYPE` + `NEW_EVENT_TYPE`, gom trong `ACCEPTED_EVENT_TYPES` |
| Ghi sự kiện mốc mới | **loại MỚI** `session-log-gbh/delivery-accepted` | `src/index.ts` — `append(NEW_EVENT_TYPE, …)` |
| Log cũ | **vẫn đọc được**, không cần chuyển đổi, không cần backfill | mọi bản ghi cũ nằm nguyên trong log phiên |

## 2. (a) Đọc cả hai loại khi tính watermark

`acceptedThrough(session)` duyệt sự kiện của phiên và bỏ qua sự kiện **không thuộc** `ACCEPTED_EVENT_TYPES`.
Trước: so sánh bằng một literal duy nhất ⇒ sau khi đổi tên sẽ **bỏ qua** sự kiện cũ ⇒ watermark về 0.
Sau: so với **mảng hai phần tử** ⇒ sự kiện cũ và mới đều được tính.

## 3. (b) Ghi loại mới từ nay

`index.ts` ghi `NEW_EVENT_TYPE` ⇒ log mới mang tên mới; không sinh thêm bản ghi cũ.

## 4. (c) Log cũ vẫn đọc được

Không có bước chuyển đổi dữ liệu: bộ đọc chấp nhận **cả hai** loại, nên phiên cũ mở ra vẫn thấy mốc đã accepted.
Điều kiện để gỡ hẳn loại cũ (tương lai): khi **không còn phiên nào** chứa sự kiện loại cũ — kiểm bằng cách quét log phiên; ghi lại quyết định trước khi xoá nhánh legacy.

## 5. (d) Test chứng minh phiên có sự kiện loại CŨ vẫn tính đúng

`tests/host/session-log.test.ts` dựng **sự kiện giả loại CŨ** (`session-log-deepseek/delivery-accepted`, xem hàm tạo sự kiện giả) và khẳng định:
- `acceptedThrough` trả đúng `throughSeq`;
- envelope gửi đi có `afterSeq` tương ứng ⇒ **không gửi lại** phần đã accepted.

Kết quả lượt này: **29 pass · 0 fail** (bao gồm các ca dùng sự kiện loại cũ).

## 6. Bằng chứng & thu hồi

- Artefact: `packages/host/session-log/lib/index.js` — sha256 `a47b1591cd5bee190ee819b948f747379078d13867c0a339c181c51c6645f4ca`.
- Đổi tên hiển thị/namespace: `export const name = "session-log-gbh"`, client `FORM_NAMESPACE = "session-log-gbh"`.
- Nếu cần quay lui: đổi `NEW_EVENT_TYPE` về loại cũ **chỉ khi** đã chấp nhận mất phân biệt log cũ/mới; KHÔNG xoá nhánh đọc legacy.
