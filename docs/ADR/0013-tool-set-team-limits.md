# ADR 0013 — Tool bổ sung `set_team_limits` cho Agent Teams (vượt parity có chủ ý)

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 23/10/2026
 desc ADR 0013: thêm tool set_team_limits để Lead Team tự đổi trần maxMembers/maxTasks lúc chạy — vượt parity với bundle gốc, có đối chứng âm và giới hạn thời gian sống
-->

**Trạng thái**: CHẤP NHẬN · **Ngày**: 23/10/2026 · **Phạm vi**: row `tool-agent-team` + `agent-team` của Agent Teams

## Bối cảnh

Trần của một Team (`maxMembers`, `maxTasks`) là **config của row** `agent-team` khai trong
`packages/host/bundle-agent-team-profile/cordis.patch.yml`. Muốn đổi phải sửa patch rồi reload/restart host.
Hệ quả đo được (23/10/2026): một phiên đã dùng hết 8/8 thành viên thì **mọi lần tạo teammate đều trả
`Team member limit 8 reached`**, và Lead Team **không có công cụ nào** để tự nâng trần hay gỡ thành viên —
chỉ còn hai lối: mở phiên mới (Team mới) hoặc sửa YAML bằng tay.

Bản gốc DSH **không có** tool này (`tool-agent-team` gốc = đúng 9 tool), nên đây là điểm **vượt parity** và
phải được ghi nhận minh bạch thay vì lặng lẽ thêm vào.

## Quyết định

1. Thêm **MỘT** tool `set_team_limits` vào `packages/host/experimental-tool-agent-team`, đăng ký **SAU**
   9 tool gốc ⇒ 9 mục đầu vẫn 1:1 từng ký tự với bundle gốc (test `TOOL_ORDER` canh).
2. Tham số bề mặt model: `max_members` · `max_tasks` (đều tuỳ chọn, `integer`); đầu ra
   `{ maxMembers, maxTasks }` = trần **đang có hiệu lực** sau lượt đổi.
3. **Chỉ Lead Team** gọi được (`TEAM_LEAD_REQUIRED` cho teammate) — cùng quy ước với `spawn_teammate`,
   `interrupt_agent`, và `team_task_update/reassign`.
4. Logic domain nằm ở gói `gbh-experimental-agent-team`: `TeamService.setLimits` +
   `TeamRoster.setLimit` / `TeamTaskBoard.setLimit`. Tool chỉ là **mặt mỏng** gọi seam `ctx.agentTeams`
   (đúng ranh giới service ↔ tool của bản gốc).
5. Kiểm giá trị: số nguyên an toàn ≥ 1 (`TEAM_INVALID_CONFIG`); không đổi trần nào ⇒
   `TEAM_INVALID_ARGUMENT`; **không cho hạ** trần dưới số thành viên/task **đang có** (hạ xuống dưới là
   trạng thái không biểu diễn được).
6. **Thời gian sống = đời service.** Thay đổi **không ghi vào profile patch**; restart host thì trần theo
   config trở lại. Điều này được ghi **ngay trong mô tả tool** để model không hứa sai với người dùng.
7. **Không đổi**: chữ `TEAM_POLICY`/`TEAM_IDENTITY`, `Config` của row, tập export của gói, và 9 tool gốc.

## Trình bày trong giao diện (bổ sung 23/10/2026)

Row toolview của `list_agents` nằm trong gói **port de-bundle nguyên văn** `ui-tool` / `ui-conversation`
(build từ chối ghi đè khi có `src/parts/`; artefact có cổng byte hai chiều với bundle gốc; từ điển
`conversation` KHÔNG đăng ký thêm được vì `locale.register` ném khi namespace đã có ngôn ngữ đó).

⇒ Không sửa hai gói đó. Thay vào đó, **gói của ta** `gbh-client-ui-agent-team` đăng ký thêm **MỘT keyed hit**
vào slot `tool.call.toolview` với `key: "set_team_limits"`; theo cơ chế của chính ui-tool, keyed hit **THAY**
hàng generic. Lượt đăng ký đi qua `ctx.slots.inject("tool.call.toolview", …)` — **không** đăng ký trực tiếp
lúc apply: slot con này do node hội thoại của ui-tool khai trong bảng `children`, nên đăng ký trực tiếp sẽ ném
`slot "tool.call.toolview" is not declared` khi gói ta được nạp trước ui-tool (đo thật 23/10/2026: `#root` còn
354 ký tự, UI trắng). Component `SetTeamLimitsRow` vẽ icon hai người + tiêu đề + tóm tắt `{members} members ·
{tasks} tasks`; hai khoá từ điển `limits.title` / `limits.summary` nằm trong namespace `agent-team` của ta
(25 → 27 khoá). CSS của hàng là tệp RIÊNG `set-team-limits.module.css`, không đụng CSS verbatim.

## Hệ quả

- Test canh hai tầng: tool (`tests/host/experimental-tool-agent-team.test.ts`: tham số · thẩm quyền · đầu
  ra · thân render · bản gốc KHÔNG có) và domain (`tests/host/experimental-agent-team.test.ts`: đối chứng
  âm "stock không có `setLimits`" · không-đổi-gì · trần không hợp lệ · hạ dưới mức đang dùng · đổi một phần).
- Số mục đăng ký mỗi agent đổi **11 → 12** khi bật `interrupt` (**10 → 11** khi tắt); test vòng đời đã
  cập nhật theo hiệu số 1 thay vì so bằng tuyệt đối giữa hai bản.
- **Chưa làm (cố ý)**: (a) `remove_teammate` — cần pha `gone` + bảng chuyển pha + xử lý `ownerId` treo của
  task + panel UI, tốn hơn và phải sửa nhiều bất biến của roster; (b) ghi trần vào settings document để
  sống qua restart — cần đường `configEditor`, không thuộc phạm vi ADR này.
