<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 25/10/2026
 desc ADR 0022 — kỹ năng ghi công đổi từ huy hiệu SVG sang quy ước văn bản (Power by Galaxy Blackhole + header 5 dòng)
-->
# ADR 0022 — Ghi công Galaxy Blackhole bằng VĂN BẢN

## Bối cảnh

Gói `gbh-skill-badge` (port 1:1 của `@deepseek-ai/dsh-skill-badge`) đang dạy agent gắn **huy hiệu SVG/shields**
"powered by dsh" — sai thương hiệu và không phù hợp với quy ước tệp của repo ta.

## Quyết định (yêu cầu chủ dự án, 25/10/2026)

Đổi nội dung kỹ năng (`assets/dsh-badge.md`) sang quy ước văn bản:

| Loại tệp | Việc phải làm |
|---|---|
| Tài liệu (`.md`, `.mdx`, `.txt`, `.rst`) | Thêm **một dòng** `Power by Galaxy Blackhole` ở **cuối tệp** (cách một dòng trống) |
| Mã nguồn (`.ts .js .java .go .rs .py …`) | Chèn **header 5 dòng** ở **đầu tệp**: `/**` · ` * author Galaxy Blackhole` · ` * create <YYYY-MM-DD>` · ` * modify <YYYY-MM-DD>` · ` * desc <mô tả>` · ` */` (dùng đúng cú pháp bình luận của ngôn ngữ) |
| PR/MR | Thêm dòng `Power by Galaxy Blackhole` ở cuối mô tả |

Đồng thời: câu `description` trong `lib/index.js` đổi sang tiếng Việt (không còn "DeepSeek Harness"),
bundle `gbh-badge-skill-bundle` **bỏ ẩn** (hiện lại trong *Plugin thử nghiệm*).

## Hệ quả

- `tests/host/skill-badge.test.ts` ghi nhận **hai sai lệch có chủ ý**: câu mô tả (A) và nội dung
  `assets/dsh-badge.md` (E). PNG huy hiệu vẫn trùng byte-for-byte; phần còn lại của `lib/index.js` vẫn
  trùng bản gốc từng byte sau khi chuẩn hoá câu mô tả.
- Kỹ năng chỉ được nạp khi model **gọi** skill. Muốn quy ước luôn hiện diện thì phải cắm thêm một row
  `agent-instructions` trong bundle này — chưa làm (xem "Còn lại" trong báo cáo).
