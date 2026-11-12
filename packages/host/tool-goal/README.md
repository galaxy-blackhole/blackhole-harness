<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README của @galaxy-blackhole/gbh-tool-goal — port 1:1 nửa host của @deepseek-ai/dsh-tool-goal
      (stock lib/index.js 379 dòng, ba vùng 5–81 · 82–99 · 100–379); ghi lý do khai CẢ gbh.row
      (row top-level đang bị TẮT) lẫn gbh.nested (row lồng trong 3 preset)
-->

# @galaxy-blackhole/gbh-tool-goal

Port **1:1** nửa host của `@deepseek-ai/dsh-tool-goal` (0.2.1-alpha.4) sang Galaxy Blackhole: plugin cordis
tên `tool-goal` — ba tool hướng model `get_goal` · `create_goal` · `update_goal` trên **miền goal bền của cùng
phiên**, kèm **kiểm quyền lúc thực thi** (agent sống đúng driver, tin nhắn người thật, hoặc đúng vòng goal),
và một mục system prompt `tool:goal` mang ngưỡng `blocked` do triển khai chọn.

## 0. Tóm tắt (và năm câu hỏi)

| # | câu hỏi | trả lời ngắn |
|---|---|---|
| 1 | Gói hai mặt? | **KHÔNG — MỘT MẶT**: chỉ `lib/index.js` **379 dòng** stock, không có `lib/client.js`, manifest gốc **KHÔNG** có `dsh.client` |
| 2 | Entry phụ? | **KHÔNG** — 1 entry duy nhất (service). Không typert, không worker |
| 3 | Trùng tên plugin/service? | Plugin tên **`tool-goal`** (chỉ để Loader chẩn đoán); đăng ký **3 tool** qua `ctx.tools` + **1 mục prompt** `tool:goal`. Không tạo service mới |
| 4 | Row trong dump? | **HAI TẦNG**: row **top-level** `tool-goal` **đang TẮT** (`ours.yml` dòng **422–424**, `disabled: true`, KHÔNG config/inject) **và** row **LỒNG** trong **3 preset** (`841` · `1005` · `1268` — entry chỉ id + name) |
| 5 | Vendor inline? | **0 dòng** vendor trong bundle; 0 phụ thuộc `@galaxy-stack/*` |

Bề mặt export của gói = **đúng 4 ký hiệu** như stock: `name` · `inject` · `Config` · `apply`.

## 1. Nguồn đối chiếu theo dòng

Stock = `apps/host/node_modules/@deepseek-ai/dsh-tool-goal` (**CHỈ ĐỌC**), `lib/index.js` 379 dòng.

| vùng stock `lib/index.js` | dòng | số dòng | kiểu stock | bản của ta | dòng ta |
|---|---|---:|---|---|---:|
| import dùng chung (đầu bundle) | 1–4 | 4 | — | mỗi tệp TS tự import | — |
| `lib/types/authority.js` | **5–81** | 77 | `authority.d.ts` (40 dòng) | `src/authority.ts` | **161** |
| `lib/types/wrapup.js` | **82–99** | 18 | `wrapup.d.ts` (12 dòng) | `src/wrapup.ts` | **38** |
| `lib/types/index.js` | **100–379** | 280 | `index.d.ts` (27 dòng) | `src/index.ts` | **476** |
| dòng export | 379 | 1 | — | export ngay tại khai báo | 42 · 45 · 54 · 292 |

Đối chiếu tới từng ký hiệu (dòng của bản ta là dòng **khai báo** trong tệp):

| ký hiệu trong bản của ta | dòng stock | ta | ghi chú |
|---|---:|---|---:|
| `GoalToolExecution` (interface) | `authority.d.ts` 8–12 | `authority.ts` | 22 |
| `GoalToolAuthority` (type) | `authority.d.ts` 13–19 | `authority.ts` | 32 |
| `reject` (private) | 8–10 | `authority.ts` | 49 |
| `openTurnEvents` (private) | 12–20 | `authority.ts` | 59 |
| `goalToolExecution` | 27–35 | `authority.ts` | 81 |
| `someOpenTurnEvent` (private) | 37–43 | `authority.ts` | 98 |
| `hasDirectHumanInput` (private) | 49–52 | `authority.ts` | 113 |
| `isMatchingGoalRound` (private) | 54–56 | `authority.ts` | 123 |
| `requireDirectHuman` | 62–65 | `authority.ts` | 140 |
| `completionAuthority` | 72–80 | `authority.ts` | 151 |
| `renderWrapupContext` | 91–98 | `wrapup.ts` | 27 |
| `declare module MessageSourceMap` | `index.d.ts` 9–15 | `index.ts` | 26–32 |
| `name` | 106 | `index.ts` | 42 |
| `inject` | 107–113 | `index.ts` | 45 |
| `Config` (interface) | `index.d.ts` 19–22 | `index.ts` | 48–51 |
| `Config` (schema) | 115 | `index.ts` | 54–56 |
| `UPDATE_ACTIONS` (private) | 116–122 | `index.ts` | 59 |
| `CREATE_DESCRIPTION` · `GET_DESCRIPTION` | 123–124 | `index.ts` | 62–67 |
| `GOAL_VALUE_SCHEMA` (private) | 125–193 | `index.ts` | 73 |
| `guidance` (private) | 195–197 | `index.ts` | 171 |
| `resolveConfig` (private) | 199–203 | `index.ts` | 185 |
| `hasText` · `hasRoundCap` (private) | 205–211 | `index.ts` | 198 · 207 |
| `goalRef` (private) | 213–219 | `index.ts` | 217 |
| `goalValue` (private) | 221–238 | `index.ts` | 235 |
| `GOAL_OUTPUT` (private) | 240–246 | `index.ts` | 259 |
| `present` (private) | 248–255 | `index.ts` | 277 |
| `apply` | 257–377 | `index.ts` | 292–476 |
| · `get_goal` | 264–274 | `index.ts` | 301 |
| · `create_goal` | 275–300 | `index.ts` | 314 |
| · `update_goal` | 301–376 | `index.ts` | 342 |

**Ba chỗ chỉ ĐỔI KIỂU, không đổi hành vi** (tsconfig của repo bật `strict` + `noUncheckedIndexedAccess`):

1. `reject` khai kiểu trả **`never`** — bản JS ném ở cuối thân; kiểu `never` cho TypeScript thu hẹp
   `boundary.openTurnStartSeq` sau lời gọi, đúng luồng chạy của bản gốc.
2. `const event = execution.events[seq]; if (event !== undefined && predicate(event))` — bản gốc đọc thẳng
   `execution.events[seq]`; với mảng đặc (không có lỗ hổng) hai cách cho **cùng kết quả**.
3. `message: args.blocked_reason as string` trong nhánh `blocked` — ngay trước đó bản gốc đã ném khi
   `blocked_reason` vắng/rỗng, nên giá trị runtime y hệt; chỉ bỏ kiểu `string | undefined` mà TypeScript
   không tự thu hẹp qua điều kiện ghép.
4. `export const Config: z<Config> = z.object({…}) as unknown as z<Config>` — schemastery suy ra trường **bắt buộc**,
   còn `z<Config>` khai trường **tuỳ chọn**; object runtime y hệt bản gốc. Tiền lệ:
   `packages/host/time-context/src/index.ts:80`.

Ngoài ra `src/index.ts` dùng hai import **chỉ-kiểu** (`@deepseek-ai/dsh-system-prompt` cho `ctx.systemPrompt`,
`@deepseek-ai/dsh-session-projection` trong `authority.ts` cho `ctx.sessionProjections` / khoá `turnBoundary`) —
**bị Bun xoá hoàn toàn** khi build, nên `lib/index.js` chỉ còn **5 dòng import runtime** trên **đúng 4 module** như bundle stock
(`schemastery` · `dsh-goal` · `dsh-llm` · `dsh-tools`; `dsh-llm` xuất hiện hai lần vì hai module nguồn cùng import).

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | `packages/host/tool-goal/` (3 tệp `src/` + `build.ts` + `tsconfig.json` + `package.json` + README + `locale/{en,zh}.json` + 9 symlink peer) |
| nguồn | chỉ có bundle stock 379 dòng | `src/authority.ts` 176 · `src/wrapup.ts` 38 · `src/index.ts` 476 = **675 dòng TS** |
| artifact | `apps/host/node_modules/…/lib/index.js` 379 dòng | `lib/index.js` **373 dòng** (Bun in lại từ 3 module; cùng cây hành vi; 5 dòng import trên 4 module) |
| bề mặt export | 4 ký hiệu | **y nguyên 4/4** — `name` · `inject` · `Config` · `apply` |
| `Config` | `z.object({ blockedAfterConsecutiveRounds: z.number().step(1).min(1).default(3) })` | **nguyên văn** |
| `inject` | `["agents","goals","tools","systemPrompt","sessionProjections"]` | **nguyên văn** |
| tool | 3 tool: `get_goal` · `create_goal` · `update_goal` | **nguyên văn** tên/mô tả/schema tham số/schema kết quả/presentCall |
| kiểm quyền | agent sống đúng driver · người thật · vòng goal | **nguyên văn** (cùng mã lỗi `GOAL_TOOL_*`) |
| wrapup | `renderWrapupContext` chèn `createUserMessage` nguồn `tool-goal` form `notice` | **nguyên văn** (A/B so từng ký tự) |
| test | — | **19 test / 296 expect · 0 fail** — A/B với chính bundle gốc trên cùng fixture |
| `gbh.row` | — | `{ id: "tool-goal", disabled: true, tests: ["tests/host/tool-goal.test.ts"] }` |
| `gbh.nested` | — | `{ kind: "preset", pluginId: "tool-goal", stockId: "@deepseek-ai/dsh-tool-goal", presets: ["preset-standard","preset-ptc","preset-cordis"] }` |

## 3. Vì sao khai CẢ `gbh.row` LẪN `gbh.nested`

Dump `2026-10-18T01-31-57/ours.yml` có **hai** vị trí cho cùng id `tool-goal`:

```yaml
# TOP-LEVEL — dòng 422–424 (row trần, KHÔNG config, KHÔNG inject)
- id: tool-goal
  name: '@deepseek-ai/dsh-tool-goal'
  disabled: true

# LỒNG trong preset-standard — dòng 841 (ptc 1005 · cordis 1268)
      - id: tool-goal
        name: '@deepseek-ai/dsh-tool-goal'
```

- `gbh.row` mirror **đúng** row top-level: **chỉ** `id` · `disabled: true` · `tests`. Stock **không khai**
  `config`/`inject` ở row này, nên gói **tuyệt đối không bịa thêm khoá** — thêm một khoá là lệch dump.
  Trạng thái `disabled: true` được giữ nguyên: sản phẩm hiện **tắt** row này.
- `gbh.nested` cho ba entry lồng: `agent-preset-registry/src/nested-mount.ts` đọc `gbh.nested` từ gói đã copy
  vào profile, dựng bản đồ `stockId -> @galaxy-blackhole/gbh-tool-goal` rồi **chỉ viết lại `name`** của entry
  lồng trong từng preset (`rewriteNestedNames`, idempotent, giữ nguyên `id`/`config`/`disabled` và mọi entry
  anh em như `command-goal` · `planning`).
- Hai khai báo **không xung đột**: chúng mô tả hai tầng khác nhau của cùng một id — tầng top-level (đang tắt)
  và tầng preset (đang bật trong preset). Gói chưa mount thì cả hai đều vô hại.

> ⚠️ **Lưu ý mount (cho Lead).** `renderRewriteBlock` biến `gbh.row.disabled: true` thành
> `- id: tool-goal` + `disabled: true` cho row **STOCK**; row **INSERT** chỉ bị tắt khi khai thêm
> `insertDisabled` (`apps/cli/src/rewrite-metadata.ts:128–130`). Gói này giữ **ĐÚNG** object mà parity gate
> yêu cầu (không thêm `insertDisabled`), nên **mount nguyên trạng sẽ BẬT row top-level `tool-goal`** — tức
> đổi hành vi sản phẩm (base DSH cũng như oracle đều để row này `disabled: true`). Hai lựa chọn trước khi mount:
> (a) thêm `insertDisabled: true` (tiền lệ `session-title-first-prompt-llm`), hoặc (b) bỏ `gbh.row`, chỉ giữ
> `gbh.nested` (tiền lệ `skill-filesystem` · `tool-skill` · `tool-jobs` · `tool-present` —
> `tests/host/row-config-parity.test.ts:266`). Quyết định thuộc **Lead**, không thuộc gói.

## 4. Test A/B (19 ca, không mạng)

`tests/host/tool-goal.test.ts` build artifact ngay khi nạp, rồi chạy **cùng một fixture giả** trên **hai bản cài**
(ta + chính bundle gốc) và so từng bước:

| nhóm | phép đo |
|---|---|
| bề mặt | tập export · `name` · `inject` · `apply.length` · 0 id module trong artifact |
| Config | `String(Config)` trùng từng ký tự · 2 đầu vào chuẩn hoá · 3 cấu hình hỏng (cùng lớp + thông điệp, không đăng ký gì) |
| prompt | mục `tool:goal`: tên · order `2400` · văn bản trùng từng ký tự (kể cả ngưỡng 7) |
| đăng ký tool | 3 tool: tên · mô tả · schema tham số/đầu ra · `presentCall` 10 ca · `render` 3 giá trị |
| validate | 5 đầu vào sai bị cả hai chặn cùng thông điệp (`defineTool`) |
| get_goal | `{goal:null}` · goal blocked + activation · 6 nhánh kiểm quyền (không agent · không sống · idle · không initiator · thiếu projection · giữa lượt) |
| create_goal | 2 ca hợp lệ (có/không trần vòng) · 4 ca thiếu quyền — so cả **vết miền goal** |
| update_goal | edit/pause/resume hợp lệ · **12 ca lỗi** (ref hỏng · blocked_reason sai chỗ · resume paused · ngưỡng blocked) · complete/blocked: quyền người thật **không** defer, quyền vòng goal **defer đúng văn bản wrapup** (so `content` + `source`, bỏ `id` ngẫu nhiên) |
| metadata | `gbh.row` đúng **3 khoá** · `gbh.nested` · `gbh.tests` · `gbh.peers ⊆ peerDependencies` có **3 đối chứng âm** · locale **byte-for-byte** |

## 5. Lệnh + phép đo

Máy này **không** có `node`/`bun` trên `PATH` của shell ⇒ dùng đường dẫn tuyệt đối.

```bash
cd galaxy-blackhole/blackhole-tauri

# build: src/index.ts -> lib/index.js (Bun.build, ESM, target node, packages external)
~/.bun/bin/bun run packages/host/tool-goal/build.ts

# typecheck strict đúng tsconfig của gói
~/.bun/bin/bun node_modules/typescript/lib/tsc.js -p packages/host/tool-goal/tsconfig.json

# test A/B
~/.bun/bin/bun test tests/host/tool-goal.test.ts

# lint scoped: chỉ cây của gói này
GBH_LINT_ROOT="$PWD/packages/host/tool-goal" \
  ~/.bun/bin/bun run tools/lint/gate.ts --only header,file-length,jsdoc,dep-guard --no-tests
```

| phép đo (19/10/2026) | kết quả |
|---|---|
| `build.ts` | **PASS** — `lib/index.js` **373 dòng**; **5 dòng import runtime** trên **4 module** đúng như stock |
| `tsc -p packages/host/tool-goal/tsconfig.json` | **PASS** — **0 lỗi** (strict · `noUncheckedIndexedAccess` · `verbatimModuleSyntax`) |
| `bun test tests/host/tool-goal.test.ts` | **PASS** — **19 test / 296 expect · 0 fail** |
| lint scoped (header · file-length · jsdoc · dep-guard) | xem mục 5 của báo cáo task |
| `locale/{en,zh}.json` | **byte-for-byte** (SHA-256 `627e67bd…` · `812548da…`) |
| symlink peer | **9** — đủ bộ stock peerDependencies + deps |

## 6. Nợ

| phần nợ | hệ quả nếu mount bây giờ |
|---|---|
| `lib/types/*.d.ts` | `package.json` **không** khai `types`/`exports.types`; consumer trong profile chỉ cần runtime, nhưng gói chưa có bề mặt kiểu để `tsc` của consumer đọc (tiền lệ `time-context`) |
| mount + `lab:row` + `check:app` | thuộc **Lead**: row top-level đang `disabled: true` nên mount sẽ không đổi hành vi sản phẩm; preset thay `name` khi Lead chạy lượt boot |
| `row:cost` | chưa đo — gói **chưa mount**, nên phép đo chi phí row chưa có mẫu |

### insertDisabled (19/10/2026 — Lead chốt)

Row stock `disabled: true` ⇒ row INSERT của ta cũng phải tắt theo (`insertDisabled: true`), nếu không mount sẽ BẬT
một thứ stock đang tắt = đổi hành vi. Tiền lệ: `config-editor` (disabled + insertDisabled{js}) và
`session-title-first-prompt-llm` (disabled + insertDisabled:true). `insertDisabled` là khoá do `rewrite-metadata.ts`
đọc khi sinh patch — KHÔNG thuộc row config/inject/disabled nên không phá cổng parity (config/inject/disabled vẫn
mirror đúng dump).
