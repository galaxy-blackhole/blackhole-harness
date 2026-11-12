<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README của @galaxy-blackhole/gbh-command-goal — port 1:1 @deepseek-ai/dsh-command-goal (187 dòng, host-only);
      ghi cổng parity gbh.row (disabled: true) + gbh.nested (3 preset) và bộ test A/B 18 ca.
-->

# @galaxy-blackhole/gbh-command-goal

Port **1:1** `@deepseek-ai/dsh-command-goal` (0.2.1-alpha.4) sang Galaxy Blackhole: plugin cordis tên
`command-goal`, `inject ['commands','goals']`, đăng ký lệnh `/goal` trên seam `ctx.commands` + `ctx.goals`.

Sáu hình dạng lệnh: `show` (trần) · `create` (objective tự do) · `edit <objective>` ·
`pause` · `resume` · `clear`; attachment của composer CHỈ đi kèm `create`/`edit` và được gửi thành
MỘT tin nhắn người dùng qua `agent.followup(createUserMessage(...))` trước vòng goal kế tiếp.

## 0. Tóm tắt (và năm câu hỏi)

| # | câu hỏi | trả lời ngắn |
|---|---|---|
| 1 | Gói hai mặt? | **KHÔNG — MỘT MẶT**: chỉ `lib/index.js` (stock 187 dòng), không `lib/client.js`, manifest gốc **KHÔNG** có `dsh.client` |
| 2 | Entry phụ? | **KHÔNG** — 1 entry duy nhất. Không typert, không worker, không `Config` |
| 3 | Trùng tên plugin/service? | Plugin tên **`command-goal`** (chỉ để Loader chẩn đoán); nó **đăng ký** lệnh `goal` vào `ctx.commands`, **không** tạo service mới |
| 4 | Row trong dump? | **CÓ — CẢ HAI TẦNG**: row TOP-LEVEL `ours.yml` **280–282** (`disabled: true`, không config/inject) **và** entry LỒNG trong 3 preset **839 / 1003 / 1266** |
| 5 | Vendor inline? | **0 dòng** vendor; 3 import runtime đúng bản gốc (`dsh-commands/brand` · `dsh-goal` · `dsh-llm`) |

Bề mặt export = **đúng 3 ký hiệu** như stock: `name` · `inject` · `apply` (không `default`, không `Config`).

## 1. Nguồn đối chiếu theo dòng

Stock = `apps/host/node_modules/@deepseek-ai/dsh-command-goal` (**CHỈ ĐỌC**), `lib/index.js` 187 dòng + `lib/types/index.d.ts` 10 dòng.
Mức dẫn xuất: **viết lại 1:1 theo hành vi** (đọc bundle + `.d.ts`, không copy byte).

| vùng stock `lib/index.js` | dòng | bản của ta (`src/index.ts`) | dòng ta |
|---|---|---|---|
| `@module` + `name` + `inject` | 5–10 | JSDoc module · `name` · `inject` | 1–36 |
| `USAGE` | 11 | `USAGE` | 39 |
| `assertNever` | 12–17 | `assertNever` | 46 |
| `parseGoalCommand` | 18–35 | `GoalCommand` + `parseGoalCommand` | 51–87 |
| `phaseLabel` | 36–46 | `phaseLabel` | 89 |
| `commandHint` | 47–57 | `commandHint` | 109 |
| `renderGoal` | 58–77 | `renderGoal` | 131 |
| `goalRef` | 78–84 | `goalRef` | 155 |
| `missingGoal` | 85–91 | `missingGoal` | 167 |
| `submitObjectiveAttachments` | 92–107 | `submitObjectiveAttachments` | 181 |
| `executeGoalCommand` | 108–172 | `executeGoalCommand` | 204 |
| `apply` | 173–185 | `apply` | 282 |
| dòng export | 187 | export ngay tại khai báo | 29 · 36 · 282 |

Chỉ **đổi kiểu**, không đổi hành vi: `GoalCommand` là union ĐÓNG thay cho object literal, `assertNever` nhận
`never` (đúng hợp đồng exhaustive), `content` của tin nhắn attachment được khai `ContentBlock[]`. Mọi câu chữ
(USAGE · nhãn pha · gợi ý lệnh · 8 thông điệp lỗi · `definitionId` · `description` · `input.hint`) **nguyên văn**.

### Ghi chú về `inject` (đặc tả brief ghi `['commands','goal','llm']`)

Artefact stock khai `inject = ["commands", "goals"]` (`lib/index.js` dòng 10). Port **theo artefact**: `commands` +
`goals`. Không có seam `llm`: `createUserMessage` là **hàm thuần** import từ `@deepseek-ai/dsh-llm`, không đọc
`ctx.llm`. Test A/B chứng minh `ctx.llm` **0 khoá bị chạm** trong suốt mọi nhánh.

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | `packages/host/command-goal/` (`src/index.ts` + `build.ts` + `tsconfig.json` + `package.json` + README + 4 symlink peer) |
| nguồn | chỉ bundle stock 187 dòng | `src/index.ts` **293 dòng** TS |
| artifact | stock `lib/index.js` 187 dòng | `lib/index.js` **199 dòng** / 6.284 B (Bun in lại; cùng cây hành vi) |
| bề mặt export | 3 ký hiệu | **y nguyên 3/3** |
| `inject` | `["commands","goals"]` | **nguyên văn** |
| định nghĩa lệnh | `definitionId` · `goal` · mô tả · `input{hint,attachments}` · `handler` | **nguyên văn 5 trường** |
| 7 nhánh handler | show · invalid-edit · create · edit · pause · resume · clear | **nguyên văn**, kể cả thứ tự `goals.get` → mutate |
| test | — | `tests/host/command-goal.test.ts` — **18 ca** A/B (mục 5) |
| `gbh.row` | — | **CÓ** `{ id, disabled: true, tests }` (mục 3) |
| `gbh.nested` | — | **CÓ** 3 preset (mục 3) |

## 3. Cổng parity mới — mirror ĐÚNG dump `2026-10-18T01-31-57`

Row TOP-LEVEL trong `.parity/dumps/2026-10-18T01-31-57/ours.yml` (dòng 280–282), **KHÔNG config, KHÔNG inject**:

~~~yaml
- id: command-goal
  name: '@deepseek-ai/dsh-command-goal'
  disabled: true
~~~

Entry LỒNG (chỉ `id` + `name`) trong `preset-standard` (839) · `preset-ptc` (1003) · `preset-cordis` (1266);
`preset-minimal` **KHÔNG** chứa `command-goal`. Metadata của gói mirror đúng hai tầng đó:

~~~json
"row": { "id": "command-goal", "disabled": true, "tests": ["tests/host/command-goal.test.ts"] },
"nested": {
  "kind": "preset",
  "pluginId": "command-goal",
  "stockId": "@deepseek-ai/dsh-command-goal",
  "presets": ["preset-standard", "preset-ptc", "preset-cordis"]
}
~~~

Không bịa khoá: `config`/`inject` **vắng** ở cả row lẫn entry lồng, đúng như dump (test D1/D2 canh).

## 4. Vì sao khai CẢ `gbh.row` và `gbh.nested`

- `gbh.row` → `apps/cli/src/rewrite-metadata.ts` sinh cặp `- id: command-goal / disabled: true` + khối `insert`
  `command-goal-ours`: thay row TOP-LEVEL (đang bị patch tắt) bằng bản của ta.
- `gbh.nested` → `packages/host/agent-preset-registry/src/nested-mount.ts` đổi **tên module** của entry
  LỒNG trong 3 preset sang `@galaxy-blackhole/gbh-command-goal` (giữ nguyên `id`/`config`/`disabled` và mọi entry anh em).
- Mount đọc **cả hai** trong `apps/cli/src/mount.ts` (`metadata.row` + `readNestedDeclaration`) — không nhánh nào bị bỏ.

**Lưu ý `insertDisabled`** (Lead quyết): `disabled: true` ở `gbh.row` là giá trị của row **STOCK** bị tắt; khối `insert`
sinh ra **KHÔNG** disabled (`renderRewriteBlock`). Muốn bản chèn cũng tắt thì phải khai thêm `insertDisabled: true` —
**chưa khai** vì đặc tả cổng parity chốt đúng ba khoá `{ id, disabled, tests }`.

## 5. Test A/B (`tests/host/command-goal.test.ts` — 18 ca, không mạng)

Mỗi ca chạy **CẢ HAI** bản (artefact build trong `mkdtemp` + bundle gốc) trên **cùng fixture** ctx giả có ba seam
`commands/goals/llm`, rồi so sâu (JSON thuần để bỏ tham chiếu hàm giữa hai giàn):

| nhóm | ca |
|---|---|
| A · export | 3 tên export · `inject` đọc từ artefact · artefact 3 import runtime + 0 tự đăng ký id |
| B · apply | đúng 1 định nghĩa (5 trường + 5 khoá) · apply 2 lần = 2 định nghĩa, disposer không tự gọi · ctx thiếu `commands` ⇒ TypeError |
| C · handler | show rỗng · show 5 pha/activation (kể cả `Blocker`) · create (mới/đang active/complete) · edit (trần/thiếu goal/active/complete) · pause+resume+clear (CAS ref 3→4→5) · ngữ pháp (trắng, `CLEAR`, `Edit x`, tab, `editing x`, `clear now`) · attachments (chỉ create/edit, thứ tự attachment trước câu vai trò, message đông băng) · `GoalError` ⇒ câu lỗi ổn định, lỗi khác ⇒ ném nguyên văn · blocked thiếu reason ⇒ TypeError |
| D · parity | `gbh.row` = 3 khoá + dump row 280–282 · `gbh.nested` = 3 preset + dump entry 839/1003/1266 · manifest: peers = stock `peerDependencies`, không `dsh.client`, đủ khung |

## 6. Lệnh + phép đo (19/10/2026)

~~~bash
cd galaxy-blackhole/blackhole-tauri
~/.bun/bin/bun run packages/host/command-goal/build.ts
~/.bun/bin/bun node_modules/typescript/bin/tsc -p packages/host/command-goal/tsconfig.json
~/.bun/bin/bun test tests/host/command-goal.test.ts
GBH_LINT_ROOT="$PWD/packages/host/command-goal" ~/.bun/bin/bun run tools/lint/gate.ts --only header,file-length,jsdoc,dep-guard --no-tests
~~~

| phép đo | kết quả |
|---|---|
| build | **PASS** — `lib/index.js` **199 dòng / 6.284 B**, 3 import runtime đúng stock |
| `tsc -p` | **PASS** — **0 lỗi** (strict · `noUncheckedIndexedAccess` · `verbatimModuleSyntax`) |
| test A/B | **18 ca / 178 expect · 0 fail** (không mạng, không phụ thuộc thứ tự) |
| lint scoped | **XANH 4/4** — header · file-length · jsdoc · dep-guard, 0 vi phạm · 0 cảnh báo |
| symlink peer | **4** — `cordis` · `dsh-commands` · `dsh-goal` · `dsh-llm` (5 cấp `../../../../../apps/host/node_modules/…`) |

## 7. Nợ / chưa làm

| phần | ghi chú |
|---|---|
| mount + profile | khai `gbh.row` + `gbh.nested` **chưa chạy lượt boot nào** — thuộc Lead (`bh host` + `check:app` + `lab:row`) |
| `check:rows` | chưa chạy (cần profile đã mount); gói host-only, không slot client |
| §4 bảng trạng thái | dòng **§4z** (bảng tự sinh) trong `packages/README.md` đã có mặt với đúng tên gói/row/test; dòng §4 chính do Lead cập nhật sau lượt boot |
| peer ngoài §3b | `dsh-commands` · `dsh-goal` · `dsh-llm` là **seam của row stock** (không thể tự chế); cần Lead xác nhận theo tiền lệ `host/time-context` |
| `insertDisabled` | xem mục 4 — quyết định của Lead nếu muốn bản chèn cũng tắt |

### insertDisabled (19/10/2026 — Lead chốt)

Row stock `disabled: true` ⇒ row INSERT của ta cũng phải tắt theo (`insertDisabled: true`), nếu không mount sẽ BẬT
một thứ stock đang tắt = đổi hành vi. Tiền lệ: `config-editor` (disabled + insertDisabled{js}) và
`session-title-first-prompt-llm` (disabled + insertDisabled:true). `insertDisabled` là khoá do `rewrite-metadata.ts`
đọc khi sinh patch — KHÔNG thuộc row config/inject/disabled nên không phá cổng parity (config/inject/disabled vẫn
mirror đúng dump).
