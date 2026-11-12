<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-plan-mode — port 1:1 host-only cua @deepseek-ai/dsh-plan-mode
      (stock lib/index.js 418 dong + lib/types/*.d.ts); khai gbh.row TOP-LEVEL va gbh.nested trong 3 preset
-->

# @galaxy-blackhole/gbh-plan-mode

Bản viết lại Galaxy Blackhole của **@deepseek-ai/dsh-plan-mode 0.2.1-alpha.4** — row Cordis tên
`plan-mode`, plugin **host-only, một mặt** (stock chỉ có `lib/index.js` 418 dòng và `lib/types/*.d.ts`;
manifest gốc không có `dsh.client`, không có `lib/client.js`).

Row giữ **trạng thái cộng tác plan theo từng agent** trên log phiên: section prompt `plan:policy` khi
plan mode bật, chiếu `plan` gấp vòng đời lệnh `/plan`, lệnh `/plan` (vào/thoát + steer), và công cụ
`exit_plan_mode` trình kế hoạch cho người dùng duyệt qua `ctx.userQuestions`.

## 0. Nguồn đối chiếu (CHỈ ĐỌC)

Nguồn duy nhất: `apps/host/node_modules/@deepseek-ai/dsh-plan-mode/` — không sửa, không copy nguyên bundle.

| nguồn stock | dòng | nội dung | đích trong gói |
|---|---:|---|---|
| `lib/index.js` | 1–6 | import `Service`, `brandString`, `z`, `createUserMessage`, `defineTool`, `UserQuestionError` | `src/index.ts` 36–46 |
| `lib/index.js` | 8–29 | module doc + `@module` | header `src/index.ts` 1–34 |
| `lib/index.js` | 30–41 | `EXIT_PLAN_MODE`, `REVIEW_ID`, `APPROVE_LABEL`, `KEEP_PLANNING_LABEL`, `EXIT_DESCRIPTION` | `src/index.ts` 77–90 |
| `lib/index.js` | 42–48 | `firstHeading` | `src/index.ts` 99–103 |
| `lib/index.js` | 49–63 | `resolveConfig` + interface `PlanModeConfig` | `src/index.ts` 106–131 |
| `lib/index.js` | 64–127 | `planProjectionDefinition` (`stateVersion 3`, schema NGHIÊM, view `{active,pending}`) | `src/index.ts` 133–212 |
| `lib/index.js` | 133–318 | `PlanModeController` (static `inject`, pre-step, section, projection, `/plan`, exit tool) | `src/index.ts` 218–485 |
| `lib/index.js` | 319–335 | `planState` + ba phép đọc `loggedActive`/`hasOpenTurn`/`loggedActiveAtLastHeader` | `src/index.ts` 496–551 |
| `lib/index.js` | 336–386 | `get` + `set` (committed/queued/cancelled/noop) | `src/index.ts` 553–600 |
| `lib/index.js` | 387–415 | `onBoundary` + `narration` | `src/index.ts` 602–652 |
| `lib/index.js` | 418 | danh sách export (5 tên) | `src/index.ts` 77, 122, 137, 218, 655 |
| `lib/types/index.d.ts` | 23–52 | import kiểu + 3 module augmentation (`MessageSourceMap`, `SessionEventMap`, `Context.planMode`) | `src/index.ts` 48–69 |
| `lib/types/index.d.ts` | 53–70 | `EXIT_PLAN_MODE` + `PlanModeConfig` + `resolveConfig` | `src/index.ts` 77–131 |
| `lib/types/index.d.ts` | 71–90 | kiểu của `planProjectionDefinition` | `src/index.ts` 137–139 |
| `lib/types/index.d.ts` | 91–146 | `PlanModeController` + `default` | `src/index.ts` 218–655 |
| `lib/types/types.d.ts` | 10–46 | `PlanProjection`, `PlanUnitState`, hai bảng chiếu `plan` | `src/types.ts` 10–53 |
| `package.json` stock | 40–59 | 9 peer + `peerDependenciesMeta` (commands optional) + 2 dependency | `package.json` peer/deps/dev |

Không port `locale/`, `README.md`, `README.zh.md`: `apply` không đọc locale và row không có chuỗi UI.

## 1. Bề mặt export

Artefact `lib/index.js` xuất **đúng 5 tên** như stock — test 01 so `Object.keys` trên ARTIFACT:

| export | kiểu | hành vi |
|---|---|---|
| `EXIT_PLAN_MODE` | `"exit_plan_mode"` | tên công cụ phía model; vẫn đăng ký khi plan mode tắt |
| `PlanModeController` | class kế thừa `Service` | service `ctx.planMode` |
| `default` | chính class trên | `default === PlanModeController` |
| `planProjectionDefinition` | object `ProjectionDefinition<"plan", PlanUnitState>` | `key "plan"`, `stateVersion 3` |
| `resolveConfig` | `(config) => { section }` | kiểm cấu hình deployment |

**Không có export `Config`.** Bản gốc cũng không có: `PlanModeConfig` chỉ là **type** và `resolveConfig` là
bộ kiểm tra runtime. Vì luật parity "*stock không khai thì không bịa thêm khoá*", gói cố ý **không** thêm
schema `Config`; test 06 ghi nhận `String(Config) === "undefined"` ở **cả hai bản**.

Các hằng riêng của hành vi (không export, y stock): `REVIEW_ID = "plan-review"`,
`APPROVE_LABEL = "Approve"`, `KEEP_PLANNING_LABEL = "Keep planning"`.

## 2. Hành vi giữ nguyên

1. **`resolveConfig`**: `section` phải là chuỗi (`PlanModeConfig needs a string `section``), không rỗng sau
   `trim()` (`PlanModeConfig needs a non-empty `section``), và mọi khoá khác bị từ chối với
   `PlanModeConfig has unknown key(s) <danh sách> — config is { section }`. Constructor mặc định
   `{ section: "" }` vì vậy vẫn ném lỗi non-empty y stock.
2. **Chiếu `plan`**: `stateVersion 3`; schema `.strict()` gồm `active`, `wanted`, `running {commandId,wanted}`,
   `activeAtLastHeader`; `apply` xử lý `command/run` (name `plan`, `args` khác `undefined`), `command/done` cùng
   `commandId`, `plan/mode`, `request/header`; view `pending = wanted !== null && wanted !== active`.
   Sự kiện không liên quan **trả CÙNG tham chiếu** (test 07).
3. **Section `plan:policy`**: order lấy từ `getSectionOrder("PLAN_POLICY")`; text là `this.section` khi có
   pending (ưu tiên) hoặc trạng thái đã ghi active; không có `context.agent` ⇒ chuỗi rỗng.
4. **`agent/pre-step`**: gọi `next()` trước; bỏ qua khi `reject`, `signal.aborted`, hoặc không có pending;
   ghi `plan/mode` qua `onBoundary` (lỗi ghi chỉ `logger.warn` rồi giữ quyết định); chỉ thêm message
   narration khi `pending.narrate` và narration tồn tại.
5. **`/plan`**: `definitionId: "@deepseek-ai/dsh-plan-mode"`, `input { hint: "[off|message]", attachments: true }`;
   `off` + attachment là lỗi; bốn kết cục `committed/queued/cancelled/noop` giữ nguyên từng câu; có text
   hoặc attachment thì `agent.steer(createUserMessage({ content: [...attachments, text?], source: {kind:"user"} }))`.
6. **`exit_plan_mode`**: công cụ `defineTool` với đúng schema tham số/kết quả, render hai câu, `presentCall`
   (tiêu đề = heading đầu tiên hoặc `"Plan"`) và `presentResult` (`"Plan review"`). Nhánh thực thi kiểm
   agent, plan mode active, plan bắt đầu bằng `# `; `ctx.get("userQuestions")` thiếu ⇒ đúng câu lỗi; câu hỏi
   `plan-review` có `detail: plan`, hai option và `intent { kind:"plan-review", approve:"Approve", callId }`;
   `ASK_CANCELLED` ⇒ `concludeTurn()` + `{approved:false}`; approve đúng ⇒ pending `{active:false,narrate:false}`
   và `{approved:true}`; mọi lựa chọn khác ⇒ lỗi giữ plan kèm feedback nếu có.
7. **Chu kỳ service**: `ctx.effect` đặt cờ `disposed`; nếu service bị nạp lại trong lúc chờ duyệt, công cụ
   ném `"the plan-mode service was reloaded while the plan was under review; present the plan again"`.

## 3. Vì sao khai CẢ `gbh.row` lẫn `gbh.nested`

Dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` có **HAI tầng** cho cùng row `plan-mode`:

- **(a) TOP-LEVEL dòng 283–335**: `- id: plan-mode` · `name: '@deepseek-ai/dsh-plan-mode'` ·
  `config.section` = **TEXT A 2.361 ký tự** · `disabled: true`. Đây là row top-level nên khai `gbh.row`
  với `id`, `config` nguyên văn, `disabled: true`, `tests`.
- **(b) LỒNG trong group `planning`** (`isolate: { planMode: true }`) của **preset-standard / preset-ptc /
  preset-cordis**, tại dòng **849 / 1013 / 1276**: `config.section` = **TEXT B 2.358 ký tự**. Đây là entry
  lồng trong preset nên khai `gbh.nested` `kind: "preset"`, `presetGroup: "planning"`,
  `presets: ["preset-standard","preset-ptc","preset-cordis"]`.

Hai TEXT khác nhau **đúng một câu ở giữa**:

| | câu giữa |
|---|---|
| A (top-level) | `those tools remain listed only to keep the request shape stable.` |
| B (nested) | `those tools remain listed to keep the tool catalog unchanged.` |

Hai TEXT được đọc từ `/tmp/plan-mode-row-config.json` và `/tmp/plan-mode-nested-config.json` **lúc sinh
`package.json`** (script đọc JSON rồi chèn, không gõ tay). Test 17 khẳng định độ dài 2.361/2.358, SHA-256
`8e3b78ec…461b5` / `eab4c75e…8951`, và deep-equal với hai tệp `/tmp` khi chúng còn mặt.

`gbh.row` thay entry top-level; `gbh.nested` chỉ đổi `name` của entry lồng trong preset, giữ nguyên `id`,
`config`, `disabled` và mọi entry anh em.

## 4. Test

`tests/host/plan-mode.test.ts` — **18 ca / 236 expect**, chạy **CẢ HAI** bản trên **Context cordis THẬT**
với seam giả (`tools`, `systemPrompt`, `sessionProjections`, `commands`, `userQuestions`), **không mạng**:

1. bề mặt export 1:1 + `default` + `inject` + khoá chiếu;
2. `resolveConfig` section hợp lệ + object tách rời;
3. section rỗng — đúng câu lỗi;
4. section non-string — đúng câu lỗi;
5. khoá lạ — đúng danh sách/câu lỗi;
6. `String(Config)` — cả hai `undefined` (stock không có schema);
7. fold chiếu qua 14 sự kiện + `Object.is` cho sự kiện không liên quan;
8. schema trạng thái + schema wire;
9. section `plan:policy` (bật/tắt/pending/không agent/thiếu chiếu);
10. pre-step không pending giữ quyết định;
11. pre-step queued on/off + narration + reject/aborted/cancelled;
12. `set` committed/noop/cancelled + lỗi thiếu `turnBoundary`/`plan`;
13. lệnh `/plan` — 10 tổ hợp + steer/attachment;
14. exit tool — review question, approve, presenters, pre-step ghi `plan/mode`;
15. exit tool — thiếu agent/không active/plan sai/thiếu user-questions;
16. exit tool — từ chối/feedback/`ASK_CANCELLED`/lỗi khác;
17. `package.json`: tên, peer/deps, `gbh.row`, `gbh.nested`, hash hai TEXT;
18. cấu trúc dòng `ours.yml` (chỉ chạy khi `.parity` còn mặt).

Ca 03–05, 15–16 khẳng định **cùng thông điệp lỗi**; mọi ca khác so **sâu giá trị** qua
`normalize` (id message UUID được thay nhãn).

## 5. Lệnh

```bash
# build (từ package)
cd galaxy-blackhole/blackhole-tauri/packages/host/plan-mode
/Users/buitronghieu/.bun/bin/bun run build.ts        # -> lib/index.js

# typecheck (từ repo root)
/Users/buitronghieu/.bun/bin/bun node_modules/typescript/lib/tsc.js -p packages/host/plan-mode

# test A/B
/Users/buitronghieu/.bun/bin/bun test tests/host/plan-mode.test.ts

# lint scoped (từ repo root)
GBH_LINT_ROOT="$PWD/packages/host/plan-mode" /Users/buitronghieu/.bun/bin/bun run tools/lint/header.ts --strict
GBH_LINT_ROOT="$PWD/packages/host/plan-mode" /Users/buitronghieu/.bun/bin/bun run tools/lint/file-length.ts --strict
GBH_LINT_ROOT="$PWD/packages/host/plan-mode" /Users/buitronghieu/.bun/bin/bun run tools/lint/jsdoc.ts --strict
```

## 6. Ghi chú

- **Một mặt, host-only**: không `lib/client.js`, không `exports["./client"]`, không `locale/`. Row không có
  bề mặt UI riêng; client đọc chiếu `plan` qua `sessionProjections`.
- **`instanceof UserQuestionError`**: như stock, gói import lớp của `@deepseek-ai/dsh-user-questions` và chỉ
  bắt `ASK_CANCELLED` khi lỗi là thể hiện của **cùng lớp đó**. Nếu về sau `gbh-user-questions` thay seam bằng
  lớp riêng, nhánh này sẽ không khớp — đó là hành vi của stock, không phải khác biệt của bản port.
- **Artifact**: `lib/index.js` 406 dòng; `grep -c "id: @deepseek-ai" lib/index.js` = 0.

### insertDisabled (19/10/2026 — Lead chốt)

Row stock `disabled: true` ⇒ row INSERT của ta cũng phải tắt theo (`insertDisabled: true`), nếu không mount sẽ BẬT
một thứ stock đang tắt = đổi hành vi. Tiền lệ: `config-editor` (disabled + insertDisabled{js}) và
`session-title-first-prompt-llm` (disabled + insertDisabled:true). `insertDisabled` là khoá do `rewrite-metadata.ts`
đọc khi sinh patch — KHÔNG thuộc row config/inject/disabled nên không phá cổng parity (config/inject/disabled vẫn
mirror đúng dump).
