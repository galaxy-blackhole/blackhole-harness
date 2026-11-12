<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 24/10/2026
 desc ADR 0014 — đổi thứ tự action "Nhóm agent" trong header phiên để nằm cạnh danh mục subagent
-->

# ADR 0014 — Thứ tự action "Nhóm agent" trong header phiên

## Bối cảnh

Header phiên hội thoại là slot `conversation.session.header.actions`; mỗi gói chiếm một occupant với
`order` tăng dần. Số đo thật (24/10/2026):

| Người ngồi | Gói | Order |
|---|---|---|
| Nhóm agent (Agent Teams) | `gbh-client-ui-agent-team` | **-20** (nguyên văn gói gốc) |
| Nhãn chế độ | `gbh-client-ui-agent-preset` | **-10** |
| Danh mục subagent | `gbh-client-ui-subagent` | **+10** |
| Tác vụ nền | `gbh-client-ui-jobs` | **+20** |

Vì `-10` chen giữa, hai thứ liên quan trực tiếp tới nhau — "Nhóm agent" và "N subagent" — bị tách rời,
người dùng phải quét qua nhãn chế độ mới thấy danh mục subagent.

## Quyết định

Đổi `TEAM_ACTION_ORDER` của gói ta: **-20 → 9**.

Kết quả thứ tự hiển thị: **Chế độ Standard · Nhóm agent · N subagent · tác vụ nền** — "Nhóm agent" và
danh mục subagent đứng liền nhau.

Đây là **sai lệch có chủ ý** so với bundle gốc (gốc dùng `-20`). Các test của gói đã cập nhật
(`tests/client/ui-agent-team.test.ts` khẳng định `9` và nêu rõ lý do), README §"Slot" ghi kèm tham chiếu ADR này.

## Phương án đã cân nhắc

- **(B) Đổi `CATALOG_ORDER` của `ui-subagent` từ 10 → -15** ⇒ thứ tự "Nhóm agent · N subagent · Chế độ
  Standard · tác vụ nền" (sát ý "cạnh nhau" nhất). **Không chọn**: gói `ui-subagent` đang có thay đổi dở
  của task khác (build.ts · package.json · ids.ts · sidebar-chat.ts), sửa vào sẽ giẫm vùng ghi.
- **(C) Giữ nguyên**: loại, vì tiếp tục tách rời hai action cùng chủ đề.

## Hệ quả

- Sai lệch so với gói gốc nằm ở **một hằng số trình bày**; không đổi hành vi nghiệp vụ.
- Nếu sau này `ui-subagent` chốt phương án B, chỉ cần trả `TEAM_ACTION_ORDER` về `-20` và xoá ADR này.
