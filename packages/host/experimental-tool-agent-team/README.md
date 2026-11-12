<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-experimental-tool-agent-team — bảng nguồn đối chiếu G4, lý do peer, 5 câu hỏi, bảng TRƯỚC/SAU và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-experimental-tool-agent-team

Bản viết lại của Galaxy Blackhole cho row **`tool-agent-team`** của DSH
(`@deepseek-ai/dsh-experimental-tool-agent-team`, bundle MỘT FILE **556 dòng** `lib/index.js` +
**20 dòng** `lib/types/index.d.ts`, đọc từ
`apps/host/node_modules/@deepseek-ai/dsh-experimental-tool-agent-team/` — CHỈ ĐỌC).

**Vai trò**: **9 tool agent-team GỐC** + **1 tool BỔ SUNG của ta** (`set_team_limits`, xem §8) + khối
prompt `TEAM_POLICY` + ngữ cảnh `TEAM_IDENTITY`, cài vào ĐÚNG phạm vi của từng agent thành viên Team trên
seam `ctx.agentTeams`.

> ⚠️ **`gbh.row` do LEAD khai NGOÀI phiên viết gói** — mtime `10:40:50` ngày 18/10/2026, giá trị:
> `id: tool-agent-team` · `config: { freshProvider: spawn, forkProvider: fork }` · `tests` (khớp **đúng** khối
> row của dump, không `inject`, không `disabled`). Gói **KHÔNG tự khai** — và **không được ghi đè**
> `package.json` nữa: bài học `bd9fbea` ghi rõ race ghi cùng `package.json` đã làm **MẤT** `gbh.row` của hai row
> (auto-review · skill). Test của gói đã **đổi chiều** theo công thức §7: row đã khai thì khẳng định khai
> **đúng id + đúng config** của dump.

## 0. BƯỚC 0 — đo trên dump `2026-10-18T01-31-57`

| Điều phải kiểm | Kết quả đo |
|---|---|
| cặp `- id: tool-agent-team` + `name: @deepseek-ai/dsh-experimental-tool-agent-team` | **CÓ THẬT** — `ours.yml` dòng **1421–1425** (bản tham chiếu `oracleA.yml` dòng **1301–1305**, cũng đang BẬT) |
| `disabled` | **KHÔNG** (khối row kết thúc ngay sau `config`; row kế tiếp là `ui-agent-team`) ⇒ row **ĐANG BẬT** |
| `config` | **ĐÚNG** `{ freshProvider: spawn, forkProvider: fork }` (thiếu `interrupt` ⇒ schema mặc định `true`) |
| `inject` | **KHÔNG** trong row (danh sách inject nằm ở **export `inject` của gói**: `agents` · `agentTeams` · `tools` · `systemPrompt`) |
| `dsh.client` trong `package.json` gốc | **KHÔNG** (không có khoá `dsh`) |
| `lib/client.js` trong gói gốc | **KHÔNG** (chỉ `lib/index.js` + `lib/types/`) ⇒ **MỘT MẶT** |
| chuỗi `dsh-tool-agent-team` (KHÔNG `experimental-`) | **0 lần** trong `ours.yml` · `oracleA.yml` · `stock.yml` — tên thật có `experimental-` |

## 1. Năm câu hỏi bắt buộc

| # | Câu hỏi | Trả lời (đo được) |
|---|---|---|
| 1 | Row có đang **BẬT** không? | **BẬT** — `ours.yml` 1421–1425 không có `disabled`; `oracleA.yml` 1301–1305 y hệt; `app.patch.yml` đang chạy **không** có row này (chưa ai thay) |
| 2 | Thuần host hay có mount surface client? | **Thuần host MỘT MẶT** — `dsh.client` không có, `lib/client.js` không tồn tại |
| 3 | Cần **seam** nào? | `agents` (liệt kê agent sống) · `agentTeams` (hợp đồng Team) · `tools` (`ctx.tools.register`) · `systemPrompt` (`section`/`context` + `getSectionOrder`/`getContextOrder`); vòng đời bằng `ctx.on` + `ctx.effect` của cordis. Ngoài bảng §3b: **không** |
| 4 | **Hành vi đo được** là gì? | Mỗi agent thành viên nhận **2 mục prompt** (khối `team:policy` order **600** · ngữ cảnh `team:identity` order **125**, `required: true`) và **9 tool**; `agent/created` cài cho thành viên mới, `agent/disposed` gỡ đúng agent đó. Đo bằng cách **chạy CẢ HAI bản** trên Context cordis thật rồi so ảnh chụp |
| 5 | Gói gốc có **`dsh.client`** không? | **KHÔNG** ⇒ không bị chặn bởi bài toán hai mặt |

## 2. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `name` = ``tool-agent-team`` · `inject` = 4 seam | `lib/index.js` dòng 7–14 | `src/index.ts` | so **nguyên văn** tên + **thứ tự** inject trên artifact |
| `Config` (schemastery: `interrupt` default true · `freshProvider` "spawn" · `forkProvider` "fork") | dòng 15–20 | `src/index.ts` | `String(Config)` **trùng từng chữ**; `Config({})` cho **cùng** giá trị mặc định; `Config({interrupt: 5})` ném **cùng** thông điệp |
| `teamPolicy(interrupt)` (chữ chính sách, đổi đúng MỘT cụm) | dòng 21–30 | `src/policy.ts` | so từng ký tự với chữ **bản gốc đăng ký** (cả `interrupt` true/false); đã thử ĐỘT BIẾN 1 ký tự ⇒ test đỏ |
| `ACTIVE_WAIT_STATUSES` · `NO_ACTIVE_PEER_MESSAGE` | dòng 31–32 | `src/policy.ts` | so qua kết quả `wait_agent` (thân `noProgress` trùng nguyên văn) |
| 8 schema (`MEMBER_VIEW_SCHEMA` … `TASK_LIST_VALUE_SCHEMA`) | dòng 33–203 | `src/schemas.ts` | so **schema ĐÃ BIÊN DỊCH** của `defineTool` (tham số + đầu ra) + thân `render` mẫu — khớp nhau |
| `jsonOutput(schema)` | dòng 204–219 | `src/schemas.ts` | thân render `[{type:"text", text:JSON.stringify(value)}]` trùng ở cả 9 tool |
| `callingAgent(agent, toolName)` | dòng 220–225 | `src/install.ts` | gọi tool **không có** `exec.agent` ⇒ ném `"<tên tool> requires a calling Agent"` (so chuỗi) |
| `install(agent, ctx, config)` — 2 mục prompt + 9 tool + dọn NGƯỢC khi hỏng | dòng 226–529 | `src/install.ts` | ma trận 23 kết cục + **toàn bộ vết gọi seam** trùng nhau; số hàm dọn gọi được sau `agent/disposed` = **11** |
| `apply(ctx, config)` — `installed` Map · `tryMembership` · `agent/created` · `agent/disposed` · `ctx.effect(…, "tool-team.scopedTools()")` | dòng 530–554 | `src/index.ts` | vòng đời: chỉ cài cho **thành viên Team**, agent ngoài Team = **0 tool**, gỡ đúng agent, effect gỡ phần còn lại |
| `modelMember(member)` (bỏ `id`, đổi `name` → `target`) | dòng 75–82 | `src/view.ts` | `list_agents` trả **không** có `id`, có `target` = tên |
| tập export | `export { Config, apply, inject, name }` | `lib/index.js` | **đo trên ARTIFACT**: **4 = 4**, 0 thiếu · 0 thừa, **không** `default` |
| `locale/{en,zh}.json` | `locale/*.json` | `locale/*.json` | chép **byte-for-byte** — `shasum` khớp (`32b3e04f…` · `df70e6ba…`) |

## 3. Cấu trúc gói

| Tệp | Dòng | Nội dung |
|---|---|---|
| `src/index.ts` | 71 | `name` · `inject` · `Config` (schemastery) · `apply` + vòng đời `installed` |
| `src/install.ts` | 383 | `install` — 2 mục prompt + **9 tool gốc** (`spawn_teammate` · `send_message` · `list_agents` · `wait_agent` · `interrupt_agent` · `team_task_create` · `team_task_list` · `team_task_get` · `team_task_update`) + **1 tool bổ sung** `set_team_limits` (đăng ký CUỐI, xem §8) |
| `src/schemas.ts` | 199 | 8 schema nguyên văn + schema đầu ra của tool bổ sung + `jsonOutput` |
| `src/policy.ts` | 29 | `teamPolicy` + `ACTIVE_WAIT_STATUSES` + `NO_ACTIVE_PEER_MESSAGE` |
| `src/view.ts` | 22 | `modelMember` |
| `build.ts` | 36 | build ESM → `lib/index.js`, nhận thư mục đích qua **`process.argv[2]`** |
| `locale/{en,zh}.json` | — | chép byte-for-byte (luật **000e**) |

Artifact: `lib/index.js` **550 dòng** · `grep -c 'id: @deepseek-ai' lib/index.js` = **0** · không có
`__ModuleLoader__` (row host-only, không đăng ký id module nào).

## 4. Peer — vì sao, và thuộc seam nào

| Peer | Vì sao (đo được) | Ghi chú |
|---|---|---|
| `@deepseek-ai/cordis` | vòng đời plugin: `ctx.on("agent/created"/"agent/disposed")` + `ctx.effect(…, label)` + lớp `Context`/`Agent` | bảng §3b **bậc 1** |
| `@deepseek-ai/schemastery` | `Config` là **schema sống** mà `config-editor` của kernel dùng để render field; `String(Config)` phải trùng gốc | §3b **bậc 1**. Bản gốc khai ở `dependencies`; ta khai **peer** theo luật *peer luôn là `peerDependencies`* |
| `@deepseek-ai/dsh-tools` | `defineTool` là **import RUNTIME**: thiếu gói ⇒ plugin không nạp được; và tool PHẢI vào sổ `ctx.tools` của kernel | §3b bậc 2 (`tool-*`) |
| `@deepseek-ai/dsh-system-prompt` | `ctx.systemPrompt.section`/`context` + hai hàm tra cứu thứ tự (`TEAM_POLICY` 600 · `TEAM_IDENTITY` 125) — thứ tự do **trung tâm** cấp | §3b bậc 2 |
| `@deepseek-ai/dsh-agent` | seam `ctx.agents.list()` + kiểu `Agent` (có `ctx` phạm vi riêng — **vật mang** quyết định tool cài vào đâu) | §3b bậc 2 |
| `@deepseek-ai/dsh-experimental-agent-team` | **`TeamTaskId` là import RUNTIME** (bundle gốc import ở dòng 2) ⇒ thiếu gói là **module not found**; seam `ctx.agentTeams` cũng thuộc gói này. Row stock **chưa viết lại** ⇒ đang bật ⇒ peer hợp lệ | Lead đã duyệt |

**KHÔNG khai `@deepseek-ai/dsh-session`** (dù Lead cho phép): gói này **không import** và **không chạm**
seam phiên — `exec.signal` do sổ tool cấp, không phải seam session. Khai thừa peer là nói dối về hợp đồng.
`dependencies` **RỖNG** (một thể hiện do kernel cấp — xem `M6-MOUNT-PLAN.md` mục `1d`).

## 5. Test — 17 ca / 101 expect / 0 fail

Chạy **CẢ HAI** bản (ta + bundle gốc) trên **Context cordis THẬT** của mỗi lượt cài:

1. **tập export đo trên ARTIFACT** = **4 = 4** (`Config` · `apply` · `inject` · `name`), không `default`.
2. **`Config`**: `String()` trùng từng chữ · mặc định trùng · lỗi kiểu trùng thông điệp.
3. **prompt**: cùng thứ tự tra cứu (`["TEAM_POLICY","TEAM_IDENTITY"]`), cùng `kind`/`name`/`order`, chữ
   `TEAM_POLICY` trùng **từng ký tự** cho cả `interrupt` true/false, chữ `TEAM_IDENTITY` trùng cho **cả hai vai**
   (Lead và teammate "helper").
4. **9 tool**: tên · mô tả · **schema tham số đã biên dịch** · **schema đầu ra** · thân `render` — khớp nhau.
5. **tắt `interrupt`** ⇒ 8 tool, không `interrupt_agent`, chữ chính sách đổi đúng một cụm.
6. **ma trận hành vi 23 kết cục** + **toàn bộ vết gọi seam**: spawn (fresh/fork/thiếu agent) · send ·
   list · wait (noProgress · timeout ngoài khoảng ⇒ uỷ quyền seam · chờ thật) · interrupt · task
   create/list (4 bộ lọc + 2 đường lỗi `cursor`/`limit`) / get (có + không có) / update (claim · edit có
   đủ trường · delete · **thiếu `expected_revision`** ⇒ lỗi kiểm tham số) — **trùng nhau từng phần tử**,
   chạy cho cả hai cấu hình `interrupt`.
7. **vòng đời**: agent ngoài Team = **0 tool**; `agent/disposed` gọi đúng **11** hàm dọn; `fiber.dispose()`
   dọn phần còn lại — **số đếm trùng** giữa hai bản.
8. **C6 — DANH TÍNH**: hai agent ⇒ hai bộ spec + tool **RIÊNG** (`not.toBe`); ngữ cảnh định danh đọc
   **đúng** thành viên của chính nó (đổi tên teammate chỉ đổi chữ của teammate); hai lần cài ⇒ hai vòng
   đời riêng (dọn A không lan sang B).
9. **ca flaky dùng `waitFor` CÓ TRẦN**: `wait_agent` chờ seam thật (20 ms) rồi trả `{timedOut:true}`;
   và ca chứng minh `waitFor` **luôn kết thúc** đúng trần 40 ms khi điều kiện không bao giờ đạt.
10. **`gbh.peers ⊆ peerDependencies` 6/6 so PHẦN TỬ + ĐỐI CHỨNG ÂM** (xoá-một-tên · xoá-sạch ·
    thừa-tên · cùng-độ-dài-mà-lệch), `dependencies` RỖNG, mọi peer có thật trong kernel, **`gbh.row`
    vắng mặt**.
11. **000e**: `locale/{en,zh}.json` trùng **từng byte** + có trong `exports`.
12. **artifact**: 0 lần `id: @deepseek-ai`, 0 lần `__ModuleLoader__`.

**Đối chứng âm của chính bộ test** (đã chạy thật): sửa **1 ký tự** trong chữ chính sách và **1 từ** trong
mô tả tham số ⇒ đúng **2 ca đỏ** (ca 3 và ca 4), 15 ca còn lại xanh; phục hồi ⇒ **17/17 xanh** lại.

## 6. TRƯỚC / SAU

| Phép đo | TRƯỚC (bản gốc đang bật) | SAU |
|---|---|---|
| Row trong `app.patch.yml` | **không có** (row stock đang bật) | `gbh.row` **đã khai** (Lead) ⇒ lượt boot kế tiếp sinh cặp `disable tool-agent-team` + `insert tool-agent-team-ours`; **chưa boot** — thuộc lượt boot của Lead |
| Số tool mỗi phạm vi thành viên | 9 (đo trên Context cordis thật) | 9 — **bằng nhau** (đo trong test) |
| `TEAM_POLICY` / `TEAM_IDENTITY` | order 600 / 125, required | **bằng nhau** (đo trong test) |
| `bun test tests/host/experimental-tool-agent-team.test.ts` | — | **17 pass / 0 fail / 101 expect** |
| `bun run check:rows` | 109 package có `gbh.row`, **0 `chan`** | **109 / 0 `chan`** (gói này không khai `gbh.row` ⇒ không vào phép kiểm) |
| `bun run gate --no-tests` | 7/7 XANH | **7/7 XANH** (typecheck 1502 file · 0 vi phạm) |

Lệnh tái lập:

    bun run packages/host/experimental-tool-agent-team/build.ts
    bun test tests/host/experimental-tool-agent-team.test.ts
    bun run check:rows && bun run gate --no-tests

## 7. CHƯA làm (nói thẳng)

1. **`gbh.row` do LEAD khai** (ngoài phiên này) — gói **không tự khai** và **không ghi đè** `package.json`.
   `check:rows` đã tính gói này: **111 package có `gbh.row` — TẤT CẢ đạt, 0 `chan`**, gói này **0 vấn đề**.
2. **Chưa chạy `lab:row`** (nó đòi `gbh.row`) ⇒ **chưa có phép đo TRƯỚC/SAU trên app 5439**; cũng
   **không** boot cổng 5439 và **không** commit — thuộc lượt boot của Lead.
3. **3 khác biệt CÓ Ý, đã kiểm là không đổi hành vi**:
   - schema viết lại bằng `as const` (chỉ để **kiểu suy ra** khớp `defineTool`; giá trị ĐÃ BIÊN DỊCH
     trùng bản gốc — chính là phép so ở ca test 4);
   - `schemastery` khai ở `peerDependencies` (gốc khai `dependencies`) theo luật peer của repo;
   - `dsh-session` **không** khai (không dùng).
4. **Chưa đo A/B pixel / phần tử lạ**: row này **không có nửa UI** (9 tool là bề mặt model, không render),
   nên hai lớp đo UI không áp dụng. Bề mặt model được đo bằng ma trận hành vi ở §5.

## 8. Tool BỔ SUNG của ta: `set_team_limits` (VƯỢT parity — ADR 0013)

Bản gốc **không có** tool này. Lý do thêm: trần `maxMembers` / `maxTasks` của Team nằm trong config của row
(`bundle-agent-team-profile/cordis.patch.yml`), muốn đổi phải sửa patch + restart — Lead Team không tự nâng
được trần khi đội đã đầy. Tool này cho **Lead Team** đổi hai trần **trong lúc chạy**.

| Hạng mục | Nội dung |
|---|---|
| Vị trí đăng ký | `src/install.ts`, **SAU** 9 tool gốc ⇒ 9 mục đầu vẫn 1:1 với bản gốc |
| Tham số | `max_members` · `max_tasks` (đều **tuỳ chọn**, kiểu `integer`) — snake_case ở bề mặt model |
| Đầu ra | `{ maxMembers, maxTasks }` — trần ĐANG có hiệu lực sau lượt đổi |
| Thẩm quyền | chỉ Lead Team; teammate gọi ⇒ `TEAM_LEAD_REQUIRED` |
| Kiểm giá trị | số nguyên an toàn ≥ 1 (`TEAM_INVALID_CONFIG`); không đổi trần nào ⇒ `TEAM_INVALID_ARGUMENT`; **không cho hạ** dưới số thành viên/task đang có |
| Thời gian sống | **chỉ trong đời service** — restart host thì profile patch quyết định lại trần (ghi rõ trong mô tả tool) |
| Logic domain | `TeamService.setLimits` + `TeamRoster.setLimit` / `TeamTaskBoard.setLimit` (gói `gbh-experimental-agent-team`) — tool chỉ là mặt mỏng gọi seam |
| Test canh | `tests/host/experimental-tool-agent-team.test.ts` (tool: tham số/thẩm quyền/đầu ra) + `tests/host/experimental-agent-team.test.ts` (domain: đối chứng âm "bản gốc không có", hạ trần dưới mức đang dùng) |

**Không đổi**: chữ `TEAM_POLICY` / `TEAM_IDENTITY` (so từng ký tự với bản gốc ở §5 ca 3), `Config` của row,
tập export `{Config, apply, inject, name}`, và 9 tool gốc.
