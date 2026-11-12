<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README của @galaxy-blackhole/gbh-time-context — port 1:1 nửa host của @deepseek-ai/dsh-time-context
      (stock lib/index.js 249 dòng, ba vùng 6–60 · 61–93 · 94–248); ghi lý do khai gbh.nested thay gbh.row
-->

# @galaxy-blackhole/gbh-time-context

Port **1:1** nửa host của `@deepseek-ai/dsh-time-context` (0.2.1-alpha.4) sang Galaxy Blackhole: plugin cordis
tên `time-context` — mỗi bước **hợp lệ** được chèn thêm một **lần đọc đồng hồ bền, có nguồn** vào lịch sử yêu cầu:
mốc thời gian ISO-shaped kèm độ lệch + múi giờ IANA, dòng chỉ dẫn múi giờ trình duyệt, và độ trôi kể từ mốc trước.

## 0. Tóm tắt (và năm câu hỏi)

| # | câu hỏi | trả lời ngắn |
|---|---|---|
| 1 | Gói hai mặt? | **KHÔNG — MỘT MẶT**: chỉ `lib/index.js` **249 dòng**, không có `lib/client.js`, manifest gốc **KHÔNG** có `dsh.client` |
| 2 | Entry phụ? | **KHÔNG** — 1 entry duy nhất (service). Không typert, không locale runtime, không worker |
| 3 | Trùng tên plugin/service? | Plugin tên **`time-context`** (chỉ để Loader chẩn đoán); đăng ký **unit projection `timeContext`** + listener `agent/pre-step` (prepend). Không tạo service mới |
| 4 | Row trong dump? | **CÓ — row LỒNG trong 3 preset**: `ours.yml` dòng **817** (standard) · **981** (ptc) · **1248** (cordis), dòng `- id: time-context` + `name: '@deepseek-ai/dsh-time-context'`, **KHÔNG config** |
| 5 | Vendor inline? | **0 dòng** vendor trong bundle; 0 phụ thuộc `@galaxy-stack/*` |

Bề mặt export của gói = **đúng 4 ký hiệu** như stock: `name` · `inject` · `Config` · `apply`.

## 1. Nguồn đối chiếu theo dòng

Stock = `apps/host/node_modules/@deepseek-ai/dsh-time-context` (**CHỈ ĐỌC**), `lib/index.js` 249 dòng / 10.800 B.

| vùng stock `lib/index.js` | dòng | số dòng | kiểu stock | bản của ta | dòng ta |
|---|---|---:|---|---|---:|
| import dùng chung (đầu bundle) | 1–5 | 5 | — | mỗi tệp TS tự import | — |
| `lib/types/request-zone.js` | **6–60** | 55 | `request-zone.d.ts` (25 dòng) | `src/request-zone.ts` | **92** |
| `lib/types/timestamp.js` | **61–93** | 33 | `timestamp.d.ts` (15 dòng) | `src/timestamp.ts` | **40** |
| `lib/types/index.js` | **94–248** | 155 | `index.d.ts` (52 dòng) | `src/index.ts` | **269** |
| dòng export | 249 | 1 | — | export ngay tại khai báo | 45 · 69 · 80 · 157 |

Đối chiếu tới từng ký hiệu (dòng của bản ta là dòng **khai báo** trong tệp):

| ký hiệu trong bản của ta | dòng stock | ta | ghi chú |
|---|---:|---|---:|
| `IANA_TIME_ZONE` | 8 | `request-zone.ts` | 15 |
| `browserTimeZone` (private) | 10–23 | `request-zone.ts` | 29 |
| `BrowserTimeZoneContext` (type) | `request-zone.d.ts` 6–18 | `request-zone.ts` | 18 |
| `deriveBrowserTimeZoneContext` | 30–45 | `request-zone.ts` | 53 |
| `renderBrowserTimeZoneContext` | 51–59 | `request-zone.ts` | 80 |
| `createTimestampFormatter` | 68–80 | `timestamp.ts` | 16 |
| `formatTimestamp` | 88–92 | `timestamp.ts` | 36 |
| `declare module MessageSourceMap` | `index.d.ts` 11–17 | `index.ts` | 29–35 |
| `name` | 102 | `index.ts` | 45 |
| `timeContextStateSchema` (private) | 103–110 | `index.ts` | 48–56 |
| `TimeContextProjection` (type) | `index.d.ts` 31–32 | `index.ts` | 58 |
| `declare module SessionProjectionStateMap` | `index.d.ts` 20–25 | `index.ts` | 61–66 |
| `inject` | 112 | `index.ts` | 69 |
| `Config` (interface) | `index.d.ts` 36–41 | `index.ts` | 72–78 |
| `Config` (schema) | 114–117 | `index.ts` | 80–83 |
| `formatDuration` (private) | 119–133 | `index.ts` | 90–109 |
| `requestMessages` (private) | 135–143 | `index.ts` | 111–121 |
| `renderText` (private) | 144–149 | `index.ts` | 127–145 |
| `validateRefreshInterval` (private) | 151–153 | `index.ts` | 147–149 |
| `apply` | 160–247 | `index.ts` | 157–268 |
| · mặc định `refreshIntervalMs = 600000` + kiểm | 162–163 | `index.ts` | 159–160 |
| · formatter dự phòng + nhãn vùng | 164–171 | `index.ts` | 161–168 |
| · `formatters` + `formatterFor` | 172–180 | `index.ts` | 169–181 |
| · `ctx.sessionProjections.register` (key · stateVersion 2 · schema · init · apply) | 181–214 | `index.ts` | 182–223 |
| · `ctx.on("agent/pre-step", …, { prepend: true })` | 215–246 | `index.ts` | 225–268 |

**Hai chỗ chỉ ĐỔI KIỂU, không đổi hành vi** (tsconfig của repo bật `noUncheckedIndexedAccess` còn `tsconfig` gốc của
stock thì không):

1. `ctx.sessionProjections.stateOf(agent.session, "timeContext")!` — `stateOf` khai trả `| undefined`; bản gốc đọc
   thẳng nên nếu unit **không** đăng ký thì cả hai đều ném `TypeError` tại đúng chỗ đó.
2. `parts.timeZoneName!` và `parts.year!` … — `Object.fromEntries` cho chỉ mục `string`; giá trị thiếu vẫn cho ra
   đúng hành vi cũ (chuỗi `undefined` trong template, hoặc `TypeError` ở `.replace`).
3. `export const Config: z<Config> = z.object({…}) as unknown as z<Config>` — schemastery suy ra trường **bắt buộc**,
   còn `z<Config>` khai trường **tuỳ chọn**; object runtime y hệt bản gốc. Tiền lệ: `packages/host/spill-policy/src/index.ts:38`.

Ngoài ra `apply` dùng hai import **chỉ-kiểu** (`import type { Agent } from "@deepseek-ai/dsh-agent"` và
`import type {} from "@deepseek-ai/dsh-session-projection"`) để nạp augmentation `Context.agents` /
`Context.sessionProjections` / `Events["agent/pre-step"]` của kernel — **bị Bun xoá hoàn toàn** khi build, nên
`lib/index.js` chỉ còn 5 import runtime đúng như bundle stock (`lib/index.js` dòng 1–5).

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | `packages/host/time-context/` (3 tệp `src/` + `build.ts` + `tsconfig.json` + `package.json` + README + 8 symlink) |
| nguồn | chỉ có bundle stock 249 dòng | `src/request-zone.ts` 92 · `src/timestamp.ts` 40 · `src/index.ts` 269 = **401 dòng TS** |
| artifact | `apps/host/node_modules/…/lib/index.js` 249 dòng | `lib/index.js` **237 dòng** (Bun in lại từ 3 module; cùng cây hành vi) |
| bề mặt export | 4 ký hiệu | **y nguyên 4/4** — `name` · `inject` · `Config` · `apply` |
| `Config` | `z.object({ timeZone: z.string(), refreshIntervalMs: z.number() })` | **nguyên văn** (hai trường tuỳ chọn của schemastery) |
| `inject` | `["agents", "sessionProjections"]` | **nguyên văn** |
| projection | key `timeContext` · `stateVersion: 2` · 3 trường nullable | **nguyên văn** |
| listener | `agent/pre-step` waterfall, `prepend: true` | **nguyên văn** (chèn `createUserMessage` nguồn `time-context`, form `snapshot`) |
| test | — | **chưa có** — `gbh.tests` đã khai đích `tests/host/time-context.test.ts` (mục 3) |
| `gbh.row` | — | **KHÔNG khai** (mục 4) — chỉ khai `gbh.nested` + `gbh.draft` |
| mount | row stock trong 3 preset | **vẫn stock** cho tới khi Lead mount `gbh.nested` (mục 4–5) |

## 3. Nợ

| phần nợ | số dòng stock | hệ quả nếu mount bây giờ |
|---|---:|---|
| `tests/host/time-context.test.ts` | — | `gbh.tests` đã khai; **tệp chưa tồn tại**. Bộ A/B 72 phép đo ở mục 5 là **bằng chứng tạm**, KHÔNG thay test |
| `lib/types/*.d.ts` | `index.d.ts` 52 · `request-zone.d.ts` 25 · `timestamp.d.ts` 15 | `package.json` **không** khai `types`/`exports.types`; consumer trong profile chỉ cần runtime, nhưng gói chưa có bề mặt kiểu để `tsc` của consumer đọc |
| `locale/en.json` + `locale/zh.json` | 2 tệp 185 + 158 B | **cố ý không port**: chỉ là `meta.title`/`meta.description` cho UI liệt kê plugin; bundle runtime **không** import locale nào ⇒ 0 ảnh hưởng hành vi. `exports` cũng không khai `./locale/*.json` |
| boot-smoke + mount | — | `gbh.nested` chỉ có hiệu lực khi gói được copy vào profile (registry đọc `gbh.nested` rồi đổi specifier trong preset). Việc này thuộc **Lead** |

## 4. Vì sao KHÔNG khai `gbh.row` mà khai `gbh.nested`

`time-context` **không phải row top-level**. Nó là một entry **LỒNG** trong `config.plugins` của **ba preset**, có
**entry anh em** ngay cạnh nó:

```yaml
# .parity/dumps/2026-10-18T01-31-57/ours.yml — standard 806–819 (ptc 970–983 · cordis 1237–1250)
  config:
    id: standard
    order: 1
    plugins:
      - id: persona
        name: '@deepseek-ai/dsh-persona'
      - id: agent-instructions
        name: '@deepseek-ai/dsh-agent-instructions'
      - id: time-context                        # ← dòng 817 / 981 / 1248
        name: '@deepseek-ai/dsh-time-context'   # ← KHÔNG có config
      - id: tool-bash
        name: '@deepseek-ai/dsh-tool-bash'
```

Khai `gbh.row` cho gói này là **sai tầng**: tầng mount của row sinh cặp `disable + insert` cho một **row top-level**
(`tools/check/rows.ts`, `apps/cli/src/profile.ts`), nên hoặc (a) tắt một id top-level **không tồn tại** rồi chèn thêm
một entry top-level ⇒ preset vẫn trỏ `@deepseek-ai/dsh-time-context` ⇒ **HAI** bản cùng chạy (hai listener prepend +
hai unit `timeContext` cùng key), hoặc (b) phải tắt/thay **cả preset** ⇒ **mất toàn bộ entry anh em** (persona,
agent-instructions, tool-bash …). Cả hai đều **đổi hành vi** của app.

Vì vậy gói khai **`gbh.nested`** — đúng cơ chế của ADR 0007:

```json
"nested": {
  "kind": "preset",
  "pluginId": "time-context",
  "stockId": "@deepseek-ai/dsh-time-context",
  "presets": ["preset-standard", "preset-ptc", "preset-cordis"]
}
```

- `packages/host/agent-preset-registry/src/nested-mount.ts` đọc `gbh.nested` từ **gói đã copy vào profile**, dựng bản
  đồ `stockId -> @galaxy-blackhole/gbh-time-context` rồi **chỉ viết lại `name`** của entry lồng trong từng preset
  (`rewriteNestedNames`, idempotent, giữ nguyên `id`/`config`/`disabled`/`group` và **mọi entry anh em**).
- `kind: "preset"` là giá trị mặc định của khai báo (`NestedDeclaration.kind`) — khai tường minh để người đọc thấy
  đây **không** phải `kind: "group"` (row con của `cordis:group`, do `apps/cli/src/profile.ts` sinh patch riêng).
- `fail-soft`: gói khai `nested` mà **chưa có `lib/index.js`** trong profile thì registry **bỏ qua + cảnh báo**, giữ
  tên stock — nên khai `nested` không thể làm chết cây boot.
- Vì **không** khai `gbh.row`, cổng `hygiene`/`check:rows` **không** canh gói này (đúng chủ ý: chưa mount).
- Tiền lệ trong repo: `packages/host/tool-todo` · `tool-ask-user` · `tool-web` … cùng khai `gbh.nested`, không `gbh.row`.

## 5. Lệnh + phép đo

Máy này **không** có `bun`/`node` trên `PATH` của shell ⇒ dùng đường dẫn tuyệt đối.

```bash
cd galaxy-blackhole/blackhole-tauri

# build: src/index.ts -> lib/index.js (Bun.build, ESM, target node, packages external)
~/.bun/bin/bun run packages/host/time-context/build.ts

# typecheck strict đúng tsconfig của gói (tsc chạy bằng bun vì thiếu node)
~/.bun/bin/bun node_modules/typescript/bin/tsc -p packages/host/time-context/tsconfig.json

# lint scoped: chỉ cây của gói này
GBH_LINT_ROOT="$PWD/packages/host/time-context" \
  ~/.bun/bin/bun run tools/lint/gate.ts --only header,file-length,jsdoc,dep-guard --no-tests
```

| phép đo (19/10/2026) | kết quả |
|---|---|
| `build.ts` | **PASS** — `lib/index.js` **237 dòng** / 8.780 B; 5 import runtime đúng như stock |
| `tsc -p packages/host/time-context/tsconfig.json` | **PASS** — **0 lỗi** (strict · `noUncheckedIndexedAccess` · `verbatimModuleSyntax`) |
| lint scoped (header · file-length · jsdoc · dep-guard) | **XANH 4/4** — 4 tệp kiểm, 0 vi phạm, 0 cảnh báo |
| **A/B với bundle stock** (cùng tiến trình, cùng `Date.now`, fake `ctx`) | **72/72 PASS** — bề mặt export · `inject` · `Config` (6 đầu vào) · `stateVersion`/`key`/`init` · schema zod (5 đầu vào) · fold `apply` (9 sự kiện + kiểm tham chiếu) · listener (16 ca) · 7 cấu hình hỏng · 5 múi giờ · 3 mốc thời gian |
| độ nhạy của phép A/B (đột biến 1 ký tự trong bundle đối chứng) | **59 pass / 13 fail** ⇒ phép so **bắt được** khác biệt, không phải so rỗng |
| symlink peer | **8** — 7 `@deepseek-ai/*` (5 cấp `../../../../../apps/host/node_modules/…`) + `zod` (4 cấp); **không peer nào thiếu** |

Ví dụ văn bản chèn (giống **từng ký tự** ở cả hai bản, `Date.now() = 1760000000000`, TZ tiến trình `Asia/Saigon`):

```text
Time sampled while preparing turn 1, step 1: 2025-10-09T15:53:20+07:00[Asia/Saigon]
Browser time zone for this request: Asia/Saigon. Interpret otherwise-unqualified dates and times in this zone.
Elapsed since the preceding model-visible message: unavailable.
```

Bộ A/B nằm ngoài repo (`/tmp/gbh-time-context-ab.ts`) — **không** phải test của repo; nợ test ở mục 3.
