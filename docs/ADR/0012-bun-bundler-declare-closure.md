# ADR 0012 — CẤM đặt tên closure `declare` trong gói build bằng Bun 1.3.14

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc ADR 0012: Bun bundler nuốt lời gọi closure tên 'declare' (âm thầm, không lỗi build) — cấm dùng tên này
-->

**Trạng thái**: CHẤP NHẬN · **Ngày**: 19/10/2026 · **Phạm vi**: mọi gói build bằng Bun trong repo

## Bối cảnh

Khi port `@deepseek-ai/dsh-llm-pi-ai` (task-113), closure nội bộ đặt tên **`declare`** bị **Bun bundler 1.3.14**
coi là **từ khoá TypeScript** ⇒ bundler **XOÁ lời gọi** `declare(...)` trong vòng lặp, **im lặng, KHÔNG báo lỗi build**.
Hệ quả: `directoryEntries()` trả `[]` ⇒ **thư mục provider rỗng 100%** (41 provider biến mất) dù build “thành công” và test kiểu vẫn xanh.

Đã xác định bằng A/B offline với bundle gốc; sau khi đổi tên thành `declareProvider`, A/B về **0 khác biệt**.

## Quyết định

1. **CẤM** đặt tên hàm/closure/biến cục bộ là `declare` trong mọi tệp thuộc gói build bằng Bun.
2. Cổng hậu-build `tests/host/build-sanity.test.ts` quét `lib/index.js` của các gói host: **hard-fail** khi thấy dòng đúng khuôn
   `for (...) ;` (thân rỗng bất thường) — dấu hiệu trực tiếp của mã bị nuốt.
   **Metric tỉ lệ `lib/src` số lời gọi KHÔNG dùng để fail** vì `src/` chứa **JSDoc rất dày** (luật repo bắt mô tả mọi hàm) ⇒ tỉ lệ thấp là hợp lý;
   metric này chỉ để **audit/cảnh báo** (đo thực tế: 74 gói cảnh báo oan, ví dụ `session-stats` src 386 dòng → lib 142, `agent-preset` 70 → 28 — KHÔNG phải mã bị nuốt).
3. Khi port bất kỳ gói nào, **A/B offline với bundle gốc** là bắt buộc để phát hiện lớp lỗi “mất mã mà không lỗi build”.

## Hệ quả

- Không đổi runtime của bất kỳ gói nào (chỉ là quy ước đặt tên + 1 test).
- Test `build-sanity` là lưới an toàn cho mọi gói build bằng Bun về sau.
