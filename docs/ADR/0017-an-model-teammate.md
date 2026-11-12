<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 24/10/2026
 desc ADR 0017 — ẩn hậu tố "Model: …" trong thẻ thành viên Agent Teams (sai lệch có chủ ý so với gói gốc)
-->

# ADR 0017 — Ẩn " · Model: …" trong thẻ thành viên Agent Teams

## Bối cảnh

Thẻ thành viên trong bảng "Nhóm agent" in dòng phụ: `<trạng thái> · Model: <id>`. Với model id dài
(`deepseek-v…`) dòng này bị cắt cụt, gây nhiễu khi người dùng rê chuột/đọc nhanh trạng thái. Yêu cầu của
Lead (24/10/2026): bỏ hẳn phần model khỏi thẻ.

## Quyết định

Bỏ `<span class="VoX2oq_memberModel">` khỏi `TeamMemberRow`; dòng phụ còn **đúng trạng thái**
(`memberStatus.*`). Đây là **sai lệch có chủ ý** so với `@deepseek-ai/dsh-experimental-client-ui-agent-team`.

## Hệ quả

- `tests/client/ui-agent-team.test.ts` chuẩn hoá cây element: bỏ hậu tố ` · Model: …` ở **cả hai phía**
  trước khi so, nên phép đối chiếu với component gốc vẫn bắt được mọi khác biệt khác.
- CSS verbatim `VoX2oq_memberModel` giữ nguyên trong artefact (không sửa CSS của gói gốc); lớp đó chỉ
  không còn được dùng.
- Từ điển `model` vẫn giữ (dùng cho chỗ khác/nếu khôi phục).
