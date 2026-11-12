<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo chuyển đổi row agent-team — roster Agent Team implicit-root, nhắn trực tiếp, bảng việc DAG;
      tách vendor (activity/journal/lifecycle/task-graph/task-view/validation…) khỏi projection/roster/task-board/service
-->

# @galaxy-blackhole/gbh-experimental-agent-team — row `agent-team`

Bản viết lại 1:1 của `@deepseek-ai/dsh-experimental-agent-team` (1.640 dòng bundle host + `lib/types/*.js` không bundle):
**roster Agent Team implicit-root**, **nhắn trực tiếp giữa thành viên**, **bảng việc chia sẻ (DAG)**, projection
`agentTeam` trên Session Lead, và service `agentTeams`.

## 0. Năm câu hỏi bắt buộc (§4f)

1. **Row này làm gì?** Cấp service `agentTeams`: giữ roster thành viên bền trong log Session Lead (implicit root),
   spawn teammate continuable, nhắn trực tiếp vào inbox agent đích, bảng việc chia sẻ có revision + blocker +
   advisory write-scope, projection `agentTeam` cho client, và chờ hoạt động Team (`wait_agent`).
2. **Row nằm ở đâu?** TOP-LEVEL · `- id: agent-team` · name `@deepseek-ai/dsh-experimental-agent-team` ·
   config `{maxMembers:8, maxTasks:256, maxMessageBytes:65536, disposalTimeoutMs:5000}` (dumps 1413–1420).
3. **Hai mặt?** **KHÔNG**: không khoá `dsh`; `./client` là module RỖNG — nửa browser là package RIÊNG
   `dsh-experimental-client-ui-agent-team`, ta đã convert thành `packages/client/ui-agent-team` (row `ui-agent-team`).
4. **Trùng service/event?** Service `agentTeams` do CHÍNH row này cấp; gói ta đã mount `tool-agent-team` đang **tiêu thụ**
   seam này (inject `agentTeams`) ⇒ mount là THAY lớp cấp. Quét repo: **0** gói GBH khác cấp `agentTeams`;
   **0** chỗ emit/listen `agent-team/*`; projection key `agentTeam` duy nhất do row này đăng ký.
5. **Khai `gbh.row`?** CHƯA — **PARKED**: `gbh.row_unmounted_ly_do = { ly_do, row: { id: 'agent-team', tests } }`.
   Chỉ flip sau (1) test A/B xanh, (2) Lead `boot-smoke agent-team` ĐẠT, (3) Lead thêm dòng `packages/README.md` §4.

## 1. Tách VENDOR khỏi code thật

| Lớp | Tệp (dòng) | Nguồn gốc | Nội dung |
|---|---|---|---|
| VENDOR | types 283 · error 32 · activity 85 · journal 69 · lifecycle 102 · persisted 45 · session-message 45 · validation 38 · task-graph 60 · task-view 58 · team-seams 23 | `lib/types/*.js` + `.d.ts` | danh tính brand, snapshot, lỗi, waiter, giao dịch log, cắt nhận việc, đọc persistence, kiểm nhận tin, chuẩn hoá input, kiểm DAG, suy diễn task view |
| CODE THẬT | projection 500 · roster 606 · task-board 234 · service ~236 · index ~54 | `projection.js` · `roster.js` · `task-board.js` · `index.js` | projection `agentTeam`, roster/spawn/nhắn/chờ, bảng việc, class `TeamService` + barrel |

**Export runtime đo trên ARTIFACT = gốc**: **6/6** (`TeamError` · `TeamId` · `TeamMessageId` · `TeamService` · `default` · `TeamTaskId`),
`default === TeamService`, `static inject ['agents','sessions','sessionPersistence','sessionProjections','subagents']`,
`String(Config)` khớp từng ký tự.

## 2. Peer + phụ thuộc

`peerDependencies` = 7 gói kernel runtime: `cordis` · `dsh-agent` · `dsh-llm` · `dsh-session` · `dsh-session-persistence` ·
`dsh-session-projection` · `dsh-subagent` (`gbh.peers` = đúng tập này). `dependencies`: `dsh-brand` · `schemastery` · `zod` 4.4.3
(import `zod/v4`). Locale `en`/`zh` **byte-for-byte** (sha 937f84b… / f33a0ea…).

## 3. Tác động nếu mount

Row cấp service `agentTeams` ⇒ **toàn bộ 9 tool của row `tool-agent-team` (đã mount) chạy trên provider của ta**
(spawn_teammate · send_message · list_agents · wait_agent · interrupt_agent · team_task_*). Projection `agentTeam`
đổi nguồn ⇒ client `ui-agent-team` (slot `conversation.session.header.actions`) hiển thị roster/bảng việc từ đây.
Vì vậy row PARKED tới khi test xanh + boot-smoke ĐẠT + README §4.

## 4. Số đo TRƯỚC → SAU

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| gói GBH cho row `agent-team` | 0 | **1** (15 tệp, 2.591 dòng src) |
| export runtime artifact | — | **6/6 khớp gốc**, `default===class`, inject + String(Config) khớp |
| tsc strict toàn gói + build | — | **0 lỗi** |
| test A/B trên Context cordis THẬT + seam giả | 0 ca | **20 ca · 20 pass · 61 expect** (370 dòng, <1s) |
| gate lint vùng này | — | **header/file-length/jsdoc/dep-guard XANH** |
| `gbh.row` | — | **PARKED** — chờ boot-smoke + README §4 |

## 5. Nợ kỹ thuật (nói thẳng)

- Bản gốc augment 3 bảng của kernel (`SessionEventMap` · `MessageSourceMap` · `SessionProjectionMap`); luật 000d cấm
  augment ⇒ khai CẤU TRÚC: `TeamSessionEventMap` (types) · `TeamMessageSource` (giữ nguyên hình dạng) ·
  `TeamProjection` không augment; roster/journal nhìn kernel qua seam cấu trúc + MỘT cast mỗi ranh giới.
- `TeamMemberView` (runtime roster) khác `TeamMemberProjection` (wire) đúng như bản gốc: wire chỉ `{id,name,role,phase,error?}`
  (client `ui-agent-team` đọc đúng hình dạng này), roster runtime thêm `status/description/provider/context/model/diagnostics`.
- Chưa ship `./client` (module rỗng), `./types` (chỉ kiểu) — không consumer runtime.

## 6. API BỔ SUNG của ta: `TeamService.setLimits` (ADR 0013)

Bản gốc **không có** phương thức này. Trần `maxMembers` / `maxTasks` vốn là config của row nên muốn đổi phải
sửa patch + restart; Lead Team không tự nâng được trần khi đội đã đầy 8/8.

| Hạng mục | Nội dung |
|---|---|
| Chữ ký | `setLimits(caller: Agent, request: { maxMembers?: number; maxTasks?: number }): { maxMembers: number; maxTasks: number }` |
| Thẩm quyền | chỉ Lead Team (`membership(caller).role === "lead"`), ngược lại `TEAM_LEAD_REQUIRED` |
| Kiểm giá trị | số nguyên an toàn ≥ 1 (`TEAM_INVALID_CONFIG`); không đổi trần nào ⇒ `TEAM_INVALID_ARGUMENT`; **không cho hạ** dưới số thành viên/task đang có ⇒ `TEAM_INVALID_ARGUMENT` |
| Hiệu lực | đổi `TeamRoster.setLimit` / `TeamTaskBoard.setLimit` ⇒ mọi lượt spawn/tạo task SAU đó đọc trần mới |
| Thời gian sống | **đời service** — không ghi vào profile patch; restart host thì trần theo config trở lại |
| Bề mặt model | tool `set_team_limits` ở gói `gbh-experimental-tool-agent-team` (mặt mỏng, gọi seam `ctx.agentTeams`) |
| Test canh | `tests/host/experimental-agent-team.test.ts` — **đối chứng âm** (bundle gốc không có `setLimits`), đổi một phần, không-đổi-gì, trần không hợp lệ, hạ dưới mức đang dùng |

Vì sao đặt ở đây (không ở gói tool): luật nghiệp vụ (đếm thành viên/task hiện có, mã lỗi, thẩm quyền) thuộc
tầng service; gói tool chỉ được biết *bề mặt model*.