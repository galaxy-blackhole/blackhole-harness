<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc KHUNG README cua @galaxy-blackhole/gbh-session-reference — NUA HOST port 1:1 vung spill (stock 9–90) va
      uri (274–348) cua @deepseek-ai/dsh-session-reference; ghi no hai manifest typert va ly do row PARKED
-->

# @galaxy-blackhole/gbh-session-reference (NỬA HOST — KHUNG)

Khung package cho **NỬA HOST** của `@deepseek-ai/dsh-session-reference` (0.2.1-alpha.4). **Lượt này** port
**hai vùng** của `lib/index.js`: dòng **9–90** (`lib/types/spill.js`) và dòng **274–348**
(`lib/types/uri.js`) — nguồn duy nhất của `src/spill.ts` + `src/uri.ts` trong README này.
Vùng **service** (349–745) và **hai manifest typert** CHƯA nghiệm thu — xem mục 3.

> **KHUNG, chưa đủ nội dung.** Các mục 0–4 mới có khung + số đo dòng; phần diễn giải chi tiết, bảng bằng
> chứng A/B và test (`tests/host/session-reference.test.ts`) sẽ do **subagent test bổ sung sau**.
> Không mục nào ở đây được coi là "đã nghiệm thu".

## 0. Năm câu hỏi

| # | câu hỏi | trả lời ngắn |
|---|---|---|
| 1 | Gói hai mặt? | **KHÔNG — MỘT MẶT**: `lib/index.js` 745 dòng, **KHÔNG** có `lib/client.js`, manifest gốc **KHÔNG** có khoá `dsh.client` |
| 2 | Entry phụ? | **CÓ 2 manifest typert**: `lib/typert.host.js` **793 dòng** + `lib/typert.remote-client.js` **88 dòng** — **CHƯA port** |
| 3 | Trùng tên service? | stock đăng ký `ctx.sessionReferenceResolver` (`SessionReferenceResolver` kế thừa `TypertRemoteService`) ở vùng 349–745 — **lượt này KHÔNG port**; một subagent khác đang viết `src/service.ts` (đo 734 dòng lúc 03:22), **chưa nghiệm thu** |
| 4 | Row trong dump? | **CÓ, đang BẬT**: cặp `- id: session-reference` + `name: '@deepseek-ai/dsh-session-reference'` ở `ours.yml` dòng **532–533** (`stock.yml` 437–438), dump `2026-10-18T01-31-57`; `normalised.json`: id dòng 525 · `order: 103`; `presence-table.md` dòng 106 = ✓ ✓ ✓ |
| 5 | Vendor inline? | **0 dòng** vendor inline trong 745 dòng bundle; 0 phụ thuộc `@galaxy-stack/*` |

## 1. Nguồn đối chiếu theo dòng

Stock = `apps/host/node_modules/@deepseek-ai/dsh-session-reference` (**CHỈ ĐỌC**).

| Vùng stock `lib/index.js` | Region | Kiểu stock | Bản của ta | Dòng ta |
|---|---|---|---|---:|
| **9–90** (82 dòng) | `lib/types/spill.js` | `lib/types/spill.d.ts` (37 dòng) | `src/spill.ts` | **154** |
| **274–348** (75 dòng) | `lib/types/uri.js` | `lib/types/uri.d.ts` (40 dòng) | `src/uri.ts` | **153** |

Đối chiếu tới từng ký hiệu (dòng của bản ta là dòng khai báo trong tệp):

| Ký hiệu trong bản của ta | Dòng stock tương ứng | Ghi chú |
|---|---:|---|
| `src/spill.ts:17` — `ReferencedConversationItem` | `lib/types/types.d.ts` 75–80 | **KIỂU TẠM**: `src/types.ts` chưa port; `src/projection.ts` của subagent khác đang import ngược từ đây |
| `src/spill.ts:11` — `import { ReferenceRetentionStats, ReferencedSessionData } from "./projection.ts"` | `lib/types/projection.d.ts` 6–21 | **KHÔNG chép lại**: `src/projection.ts` (subagent khác, stock 123–273) đã có hai interface này |
| `src/spill.ts:29` — `FullSnapshot` (private) | `spill.d.ts` 7–12 | không xuất, y như stock |
| `src/spill.ts:38` — `REFERENCE_WARNING` | `lib/index.js` 12–14 | nguyên văn 3 dòng, giữ cả xuống dòng |
| `src/spill.ts:49` — `prepareReferenceOmission` | `lib/index.js` 23–56 | `!truncated` ⇒ `undefined`; không store ⇒ `storage-not-configured`; `saveText` ném ⇒ `save-failed` |
| `src/spill.ts:99` — `omission` (private) | `lib/index.js` 57–65 | stock không xuất; giữ private |
| `src/spill.ts:127` — `renderTranscript` (private) | `lib/index.js` 66–89 | 64 điểm mã/dòng, `JSON.stringify(match[0])` từng mảnh, đuôi rỗng |
| `src/uri.ts:21` — `SessionReferenceInput` | `lib/types/types.d.ts` 36–42 | **KIỂU TẠM** (chờ `src/types.ts`) |
| `src/uri.ts:33` — `ParsedSessionReferenceText` | `lib/types/uri.d.ts` 25–30 | **KIỂU TẠM** |
| `src/uri.ts:14` — `import { SessionReferenceError } from "./config.ts"` | `lib/index.js` 99–108 + `config.d.ts` 19–26 | **KHÔNG chép lại**: `src/config.ts` (subagent khác, stock 91–109) đã có class ⇒ chỉ MỘT class |
| `src/uri.ts:45` — `SESSION_REFERENCE_SCHEME` | `lib/index.js` 277 | `"dsh-session:"` |
| `src/uri.ts:52` — `encodeSessionReferenceUri` | `lib/index.js` 283–285 | base64url của `JSON.stringify(id)` |
| `src/uri.ts:62` — `decodeSessionReferenceUri` | `lib/index.js` 291–304 | scheme ⇒ bảng chữ `[A-Za-z0-9_-]+` ⇒ chuỗi JSON ⇒ **phải chuẩn** (mã hoá lại == URI gốc) |
| `src/uri.ts:82` — `formatSessionReferenceMention` | `lib/index.js` 310–312 | `@[label](uri)`, nhãn mặc định là sessionId |
| `src/uri.ts:93` — `parseSessionReferenceText` | `lib/index.js` 321–338 | regex **nguyên văn**; mention hỏng ⇒ ném; URI trần phải chuẩn |
| `src/uri.ts:129` — `escapeLabel` (private) | `lib/index.js` 339–341 | escape `\` và `]` |
| `src/uri.ts:138` — `unescapeLabel` (private) | `lib/index.js` 342–344 | bỏ `\` trước đúng một ký tự |
| `src/uri.ts:147` — `invalidUri` (private) | `lib/index.js` 345–347 | mã `SESSION_REFERENCE_INVALID_REFERENCE`, `cause` tuỳ chọn |

Ba hàm `escapeLabel` · `unescapeLabel` · `invalidUri` **giữ private** y như stock (chỉ 4 hàm + 1 hằng
được xuất ở vùng này). `src/index.ts` do subagent service nối bề mặt — **không phải** phần của lượt này.

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | `packages/host/session-reference/` (khung này dựng: build.ts + tsconfig.json + package.json + README.md + 17 symlink peer; subagent khác ghép thêm config/projection/serialization/service) |
| vùng spill | `lib/index.js` 9–90 (82 dòng) | `src/spill.ts` **154 dòng** |
| vùng uri | `lib/index.js` 274–348 (75 dòng) | `src/uri.ts` **153 dòng** |
| bề mặt export của **hai vùng này** | 5 ký hiệu (`SESSION_REFERENCE_SCHEME` + `encode` · `decode` · `format` · `parse`) | **y nguyên 5/5** (3 hàm private vẫn private) |
| test | — | **chưa có** — `gbh.tests` đã khai đích `tests/host/session-reference.test.ts` |
| `gbh.row` | — | **KHÔNG khai** (mục 4); chỉ khai `gbh.row_unmounted_ly_do` |
| build | — | `bun run build.ts` **PASS** (đo lúc 03:19: `lib/index.js` 0 B vì `src/index.ts` khi đó còn `export {}`) |

**Đo lượt khung (19/10/2026, mốc 03:19–03:22 — các subagent khác đang ghi cùng package nên số đo trôi):**
- `bun run build.ts` (`~/.bun/bin/bun`) → PASS.
- `tsc` strict với đúng cờ của `tsconfig.json` trên **vùng của lượt này** (`spill.ts` · `uri.ts` +
  `projection.ts` · `config.ts` mà chúng import) → **PASS, 0 lỗi**. `tsc` **cả gói** lúc đo còn đỏ ở
  `src/service.ts` (`TS2345` `readonly UserMessage[]`) — tệp của **subagent khác đang viết dở**, không
  phải vùng của lượt này.
- **A/B chạy thật** `src/uri.ts` với chính bundle stock (nạp `lib/index.js` gốc trong cùng tiến trình):
  **0 khác biệt** trên 9 id (kể cả `""` · emoji · 300 ký tự · `"dsh-session:abc"`) cho `encode`/`decode`,
  **0 khác biệt** trên 9 URI hỏng (name · message · code · cause), **0 khác biệt** trên 8 văn bản
  (`parseSessionReferenceText`) và 3 hình dạng mention (`formatSessionReferenceMention`).
- **Smoke** `prepareReferenceOmission`: preview nguyên ⇒ `undefined`; store vắng ⇒ `storage-not-configured`;
  `saveText` ném ⇒ `save-failed`; `suggestedName` = `session-reference-1.txt`; yêu cầu gửi store có
  `owner.sessionId` · `source.kind = "session-reference"` · `source.sessionId` · `source.label` và bản thoại
  23 dòng (đầu đề + JSON + mảnh 64 điểm mã) đúng như stock.
- `lint:header` · `lint:length` · `lint:jsdoc` · `lint:deps` **XANH** — 0 vi phạm, 0 cảnh báo cho gói này;
  `check:rows`: 140 gói khai `gbh.row` TẤT CẢ đạt, gói này **không** nằm trong danh sách (đúng chủ ý).

**Peer:** 16 peer + `@deepseek-ai/schemastery` **đều tồn tại** trong `apps/host/node_modules/@deepseek-ai` và đã
symlink vào `node_modules/@deepseek-ai/` của gói (**17 symlink**, `zod` giải từ `node_modules` gốc như
`api-workspace-controller`). **Không peer nào thiếu.**

## 3. Nợ: 2 manifest typert (và nợ phụ)

> **ĐÃ TRẢ NỢ hai dòng đầu (19/10/2026):** cả hai manifest đã port 1:1 và đã khai `exports` — xem **mục 6**.
> Bảng dưới giữ lại làm mốc lịch sử (số dòng stock vẫn đúng).

| phần nợ | số dòng stock | hệ quả nếu mount bây giờ |
|---|---:|---|
| `lib/typert.host.js` | **793** | thiếu manifest Remote phía Host cho `ctx.sessionReferenceResolver` |
| `lib/typert.remote-client.js` | **88** | thiếu manifest Remote phía client |
| vùng service `lib/types/index.js` (349–745) | **397** | **đang được subagent khác port** (`src/service.ts`) — chưa nghiệm thu, chưa có test A/B |
| kiểu tạm trong `uri.ts` | — | `SessionReferenceInput` · `ParsedSessionReferenceText` chờ `src/types.ts` (stock `types.d.ts` 81 dòng) |
| `ReferencedConversationItem` (`spill.ts`) | — | chờ `src/types.ts`; hiện `src/projection.ts` import ngược từ `spill.ts` |
| `SessionReferenceError` | — | **đã xử lý**: import từ `./config.ts` (MỘT class duy nhất) |

**Điểm nối quan trọng (không phải nợ của gói này):** `packages/host/api-remotes/src/client-parts/part-14.txt`
(5 · 39 · 45 · 53) đang tham chiếu `typeSymbol: "@deepseek-ai/dsh-session-reference#sessionReferenceResolver/…"` ⇒
RPC surface của client chỉ sống lại khi **hai manifest typert** được port.

## 4. Vì sao row PARKED (không khai `gbh.row`) + quy trình 4 bước của Lead

Gói stock là **MỘT MẶT** (không `client.js`) nhưng **row `session-reference` đang BẬT** trong dump
(`ours.yml` 532–533) và có **2 manifest typert CHƯA port** (793 + 88 dòng). Mount lúc này = cặp
`disable + insert` thay row stock bằng bản **thiếu manifest Remote** ⇒ có thể **mất RPC surface** mà
`api-remotes` đang trỏ tới (`#sessionReferenceResolver`). Vì vậy gói **cố ý không khai**
`gbh.row` — chỉ khai `gbh.row_unmounted_ly_do` (kèm `row: { id, tests }` để lượt mount biết đích).
Hệ quả: `gate`/`check:rows` **không** canh gói này cho tới khi flip.

**Quy trình 4 bước của Lead (đúng thứ tự, chưa bước nào xong):**

1. **Test A/B xanh** — viết `tests/host/session-reference.test.ts` (đích đã khai trong `gbh.tests`): chạy **cả hai**
   bản (ta + bundle stock) trên cùng đầu vào rồi so **từng ký tự** — `encode`/`decode`/`format`/`parse`,
   7 mã lỗi, và hình dạng bản ghi omission/spill request.
2. **Lead boot-smoke ĐẠT** — Lead chạy lượt boot trên cổng 5439 (`scripts/restart-host.sh`) + `check:app`
   (nhớ **cookie jar**), rồi xác nhận app lành.
3. **Lead thêm `packages/README.md` §4** — dòng bằng chứng cho gói này (cổng `hygiene` đòi gói khai
   `gbh.row` phải có mặt ở §4 **trước khi** flip row).
4. **Lead flip `gbh.row` + mount** — chuyển `row_unmounted_ly_do.row` thành `gbh.row` thật, thêm row vào
   profile/patch và mount **sau khi** hai manifest typert (hoặc bản port của chúng) đã sẵn sàng; đo lại `check:rows`
   + `check:app` + A/B.

## 5. Vùng SERVICE host — chi tiết (port 19/10/2026)

> **Mục này TRẢ NỢ mục 0 ô #3 và dòng "đang được subagent khác port" ở mục 3.** Vùng service
> `lib/types/index.js` (stock `lib/index.js` **349–744**) và dòng export **745** đã có bản TS:
> `src/service.ts` **734 dòng** + `src/index.ts` **14 dòng**. Nợ còn lại của gói: **hai manifest typert**
> (793 + 88 dòng) — mục 5.5.

### 5.1 Sáu vùng + vỏ bundle của `lib/index.js` → tệp của ta

| # | vùng stock | dòng stock | số dòng | trừ emit helper | kiểu stock | bản của ta | dòng ta |
|---|---|---:|---:|---:|---|---|---:|
| 0 | import đầu bundle (dùng chung) | 1–8 | 8 | — | — | mỗi tệp TS tự import | — |
| 1 | `lib/types/spill.js` | 9–90 | 82 | — | `spill.d.ts` (36) | `src/spill.ts` | 154 |
| 2 | `lib/types/config.js` | 91–109 | 19 | — | `config.d.ts` (26) | `src/config.ts` | 54 |
| 3 | `lib/types/serialization.js` | 110–122 | 13 | — | `serialization.d.ts` (7) | `src/serialization.ts` | 19 |
| 4 | `lib/types/projection.js` | 123–273 | 151 | — | `projection.d.ts` (33) | `src/projection.ts` | 245 |
| 5 | `lib/types/uri.js` | 274–348 | 75 | — | `uri.d.ts` (39) | `src/uri.ts` | 153 |
| 6 | **`lib/types/index.js`** (service) | **349–744** | **396** | **−38** (356–393) | `index.d.ts` (102) + `types.d.ts` (80) | `src/service.ts` | **734** |
| 7 | dòng export | 745 | 1 | — | — | `src/index.ts` | 14 |

Tổng: **745 dòng** host · **0 dòng vendor inline** ⇒ **745 dòng thật**; trừ **38 dòng** helper emit
(`__runInitializers` 356–360 · `__esDecorate` 361–393) ⇒ **707 dòng** phải port. Bản TS: **1.373 dòng**
trên **7 tệp**; riêng vùng service: **396 − 38 = 358 dòng** thật → **734 dòng TS** (JSDoc tiếng Việt + seam
kiểu theo cấu trúc + KIỂU TẠM cho `src/types.ts` chưa port).

### 5.2 TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| nguồn host | `lib/index.js` **745 dòng**, vendor inline **0** | **7 tệp TS** / **1.373 dòng** (6 vùng + `index.ts`) |
| class service | **không có** | `src/service.ts` **734 dòng** — `SessionReferenceResolver` |
| service key + inject | — | `ctx.sessionReferenceResolver` · `static inject = ['sessionQuery']` |
| điểm cuối Remote | — | **1** endpoint `sessionReferenceResolver/candidates` (`@Remote("candidates")`, gọi `direct`) |
| bề mặt export runtime | **10 ký hiệu** (dòng **745**) | **y nguyên 10/10** — `src/index.ts` **14 dòng** |
| build | `lib/index.js` **0 B** (index rỗng) | `lib/index.js` **684 dòng** |
| test | 0 | **chưa có** — đích `tests/host/session-reference.test.ts` |
| `gbh.row` | — | **KHÔNG khai** (mục 4); chỉ `gbh.row_unmounted_ly_do` |

### 5.3 Từng ký hiệu của vùng service (neo theo dòng)

| ký hiệu trong bản của ta | stock `lib/index.js` / `*.d.ts` | ta (`src/service.ts`) |
|---|---:|---:|
| `DEFAULT_REFERENCE_CONTEXT_FRACTION = 0.2` | 394 | 36 |
| `PROMPT_PREFIX` (`## Referenced sessions` … `<referenced-sessions>`) | 395–401 | 39–46 |
| `PROMPT_SUFFIX = "\n</referenced-sessions>"` | 402 | 48 |
| `LABEL_KEYS = ['title','subagent']` | 403–404 | 51 |
| `ResolvedConfig` (không xuất, y như stock) | — (kiểu nội bộ của trường `config`; `index.d.ts` 27) | 58 |
| seam context theo cấu trúc (`sessionQuery` · `sessionProjections` · `sessions` · `sessionProjectionCache` · `spillStore` · `llm` · hai `on`) | — (bản gốc gọi thẳng `ctx.*`) | 97–214 · 372 |
| `SessionReferenceSource` + `declare module` `MessageSourceMap` | `types.d.ts` 11–35 | 216 · 250 |
| `SessionReferenceCandidate` | `types.d.ts` 44–62 | 258 |
| `SessionReferenceMentionCandidate` | `types.d.ts` 63–68 | 274 |
| `PreparedReferencedMessage` | `types.d.ts` 68–74 | 280 |
| `class SessionReferenceResolver` | 406–689 (`index.d.ts` 24) | 300 |
| `static inject = ["sessionQuery"]` | 432 (`index.d.ts` 25) | 302 |
| `static Config` (4 trường: `maxReferences` 1..3 mặc định 3 · `candidateLimit` ≥1 mặc định 50 · `maxReferenceBytes` ≥1 · `referenceContextFraction` 0..1 mặc định 0.2) | 433–438 (`index.d.ts` 26) | 305 |
| trường `config` · `assembledRoutes` | 439 · 440 | 313 · 316 |
| `constructor` (`super(ctx,'sessionReferenceResolver')`, trộn mặc định, 3 phép kiểm cấu hình, đăng ký 2 listener) | 441–478 | 323–370 |
| listener `system-prompt/assemble` (ghi `assembledRoutes`) | 459–469 | 341 |
| listener `agent/pre-step` (`reject` đi xuyên, còn lại thay `messages`) | 470–477 | 353 |
| `prepareDirectMessages` (private) | 487–510 | 382 |
| `listCandidates` | 522–542 | 421 |
| `projectedLabels` (private) | 567–584 | 471 |
| `@Remote("candidates")` | 413 | 503 |
| `remoteExportCandidates` | 594–602 | 504 |
| `prepare` | 615–660 | 525 |
| `referenceBudget` (private) | 661–675 | 596 |
| `renderSources` (private) | 676–687 | 617 |
| `normalizeReferences` | 690–707 | 639 |
| `renderPrompt` | 708–710 | 667 |
| `titleOf` | 712–715 | 676 |
| `candidateRank` | 716–720 | 686 |
| `assertNotCancelled` | 721–723 | 697 |
| `settleWithCancellation` | 724–740 | 706 |
| `cancelled` | 741–743 | 732 |

Bảy helper (`normalizeReferences` · `renderPrompt` · `titleOf` · `candidateRank` · `assertNotCancelled` ·
`settleWithCancellation` · `cancelled`) là **private trong stock**, ở đây **xuất** theo yêu cầu của lượt port;
bốn hằng cấu hình cũng xuất. `src/index.ts` **không** xuất chúng — bề mặt gói vẫn đúng 10 ký hiệu.

### 5.4 Bề mặt Remote và hai listener

| endpoint | method | kiểu gọi | tham số wire | kết quả |
|---|---|---|---|---|
| `sessionReferenceResolver/candidates` | `remoteExportCandidates` | `direct` | `agent` (lookup `agent` → wire `agentId`) · `query` (JSON string) | mảng `SessionReferenceMentionCandidate` (7 trường của candidate + `mention`) |

| event | chế độ | `prepend` | việc làm |
|---|---|---|---|
| `system-prompt/assemble` | waterfall | ✓ | `await next()` rồi ghi `assembledRoutes[agent] = { provider, model }` từ `assembly.variables` |
| `agent/pre-step` | waterfall | ✓ | `await next()`; `kind === 'reject'` đi xuyên NGUYÊN VẸN; còn lại thay `messages` bằng `prepareDirectMessages(agent, messages, signal)` |

Ba method công khai: `listCandidates` (liệt kê + xếp hạng theo `cwd`, tự loại chính nó, lọc chuỗi con không
phân biệt hoa thường) · `remoteExportCandidates` (mặt Remote: áp trần `candidateLimit` của cấu hình + gắn
mention chuẩn) · `prepare` (chụp `readSurface` song song, ngân sách byte, omission + spill, dựng
`createUserMessage` nguồn `session-reference`/`recall`/`version: 1`).

Hành vi giữ nguyên: `structuredClone` nội dung đã nhận; ngân sách tự động =
`max(64 KiB, floor(contextWindow * 4 * fraction))` và **64 KiB** khi thiếu tuyến/adapter/cửa sổ ngữ cảnh, với
`LlmError` mã `NO_ADAPTER` được nuốt riêng; huỷ **không** công bố ngữ cảnh (kể cả khi lưu trữ xong sau huỷ);
notice omission chỉ xuất hiện khi có preview bị cắt, văn bản **nguyên văn** như stock; `reject` của bước
kế tiếp không bị viết lại.

### 5.5 Nợ còn lại

> **ĐÃ TRẢ NỢ hai dòng typert (19/10/2026):** `src/typert-host.ts` + `src/typert-remote-client.ts` đã có và
> build ra `lib/typert.host.js` + `lib/typert.remote-client.js` — xem **mục 6**. Nợ `src/types.ts` vẫn còn.

| phần nợ | số dòng stock | hệ quả nếu mount bây giờ |
|---|---:|---|
| `lib/typert.host.js` | **793** | thiếu manifest Host ⇒ Gateway không có codec/scope/`typeSymbol` cho `sessionReferenceResolver/candidates` |
| `lib/typert.remote-client.js` | **88** | thiếu manifest client ⇒ `packages/host/api-remotes/src/client-parts/part-14.txt` (5 · 39 · 45 · 53) mất typeSymbol `@deepseek-ai/dsh-session-reference#sessionReferenceResolver/…` |
| `src/types.ts` | `types.d.ts` **80** | KIỂU TẠM nằm rải: `SessionReferenceSource`/`…Candidate`/`…MentionCandidate`/`PreparedReferencedMessage` trong `service.ts`, `SessionReferenceInput` trong `uri.ts`, `ReferencedConversationItem` trong `spill.ts` |

Decorator `@Remote("candidates")` chỉ ĐÁNH DẤU method trên thể hiện; phần wire (schema tham số, scope
`context: 'agent'`/`wire: 'agentId'`) vẫn thuộc manifest — nên **chưa mount** (mục 4).

### 5.6 Đo lượt port (19/10/2026)

| phép đo | kết quả |
|---|---|
| `bun run build.ts` | **PASS** — `lib/index.js` **684 dòng** |
| `tsc -p packages/host/session-reference/tsconfig.json` | **PASS** — **0 lỗi** (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`) |
| bề mặt export runtime | **BẰNG** stock: cùng 11 khoá (`Object.keys`) và `default === SessionReferenceResolver` ở cả hai |
| `remoteMethods(service)` | **BẰNG** stock: `[{ method: 'remoteExportCandidates', exportName: 'candidates', invocation: { kind: 'direct' } }]` |
| `static inject` | `["sessionQuery"]` — cả hai |
| A/B nghiệp vụ (2 cấu hình: mặc định · `{ maxReferenceBytes: 600, maxReferences: 1 }`) | **0 khác biệt** trên: `listCandidates` (mặc định · limit 2 · query hoa/thường · theo `cwd` · phiên lạnh qua cache) · `remoteExportCandidates` · `prepare` (khử trùng · rỗng · cắt + notice omission · `source` JSON) · 4 ca lỗi (tự tham chiếu · `limit = 0` · huỷ khi liệt kê · huỷ khi chuẩn bị) |
| prompt bị cắt (cùng đầu vào 4.000 ký tự) | **byte-identical**: 1.289 ký tự, `truncated: true`, `omittedMessages: 1`, `omittedBytes: 3571` |
| spill (3 đường: lưu được · `saveText` ném · không có store) | **byte-identical** với stock: notice `fullSnapshot` lần lượt `{"status":"saved","locator":"spill://local/session-reference-1.txt","bytes":4849,"retrievalHint":"Read it back"}` · `{"status":"unavailable","reason":"save-failed"}` · `{"status":"unavailable","reason":"storage-not-configured"}`; prompt 1.338 / 1.273 / 1.284 ký tự |
| `lint:header` · `lint:length` · `lint:jsdoc` | **XANH** — 0 vi phạm, 0 cảnh báo cho gói này |

### 5.7 Quy trình 4 bước mount của Lead (trạng thái sau lượt port)

1. **Test A/B xanh** — **CHƯA XONG**: `tests/host/session-reference.test.ts` chưa có. Bộ đo của lượt port
   (mục 5.6) là bằng chứng tạm, **không** thay test.
2. **Lead boot-smoke ĐẠT** — chưa chạy (chỉ Lead chạy `scripts/restart-host.sh` + `check:app` với cookie jar).
3. **Lead thêm `packages/README.md` §4** — chưa có dòng cho gói này (hiện `grep session-reference` = 0 kết quả).
4. **Lead flip `gbh.row` + mount** — chưa; điều kiện: bước 1–3 xong **và** hai manifest typert (793 + 88) đã
   sẵn sàng, rồi đo lại `check:rows` + `check:app` + A/B.

## 6. Manifest typert

> **Ownership (19/10/2026, sau boot-smoke):** typert-loader từ chối manifest khai `package` khác id gói export nó
> (`typert-loader: ... the manifest must be owned by the package that exports it`). Vì vậy 2 manifest của ta khai
> `package: '@galaxy-blackhole/gbh-session-reference'`; các `typeSymbol` riêng của gói cũng đổi sang id của ta
> (5 + 4 = 9 chỗ). `typeSymbol` của gói khác (vd `@deepseek-ai/dsh-session/types#SessionId`) giữ nguyên.
> Kiểm: `grep -c '@deepseek-ai/dsh-session-reference' packages/host/session-reference/lib/*.js` = 0. — port 1:1 hai artifact GENERATED (19/10/2026)

> **Mục này TRẢ NỢ mục 0 ô #2, mục 3 và mục 5.5.** Cả **hai** manifest typert đã có bản TS **nguyên văn** và
> đã nằm trong `lib/` sau `bun run build.ts`; `package.json` đã khai `exports` `./typert` + `./remote` như
> stock. Row vẫn **PARKED** (mục 4): điều kiện "manifest sẵn sàng" nay đã xong, còn test A/B xanh + boot-smoke
> của Lead.

### 6.1 Nguồn: máy sinh — port là CHÉP, không viết lại

Cả hai tệp stock đều do `@galaxy-blackhole/gbh-typert-generator` sinh từ **FaceModel**, dòng đầu ghi
`Generated by @galaxy-blackhole/gbh-typert-generator … do not edit`. Vì vậy bản của ta **chép nguyên văn thân tệp**
(nguyên chuỗi, schema, thứ tự key, `sourceLocation`), chỉ **thêm header 5 dòng repo** lên đầu — không diễn
giải, không "cải tiến" một field nào.

| tệp stock (CHỈ ĐỌC) | dòng | byte | bản của ta | dòng | bề mặt export |
|---|---:|---:|---|---:|---|
| `lib/typert.host.js` | **793** | 55.369 | `src/typert-host.ts` | **803** | `export const TYPERT` — **không** default export (y stock) |
| `lib/typert.remote-client.js` | **88** | 6.490 | `src/typert-remote-client.ts` | **98** | `export const TYPERT_REMOTE` (stock dòng **25**) **và** `export default TYPERT_REMOTE` (stock dòng **88**) |

Cổng byte cho vùng của lượt này: `tail -n 88 src/typert-remote-client.ts` **trùng từng byte** với
`lib/typert.remote-client.js` của stock (`cmp` + cùng SHA-256 `17b54a4b…b0f9893`). Tệp host do subagent khác
port cùng ngày (đo 803 dòng lúc 04:15).

**`lib/*.js` là bản Bun in lại, không phải bản chép byte** (nháy kép, `var`, gộp `export { … }`). Vì vậy đối
chiếu đúng là **cây dữ liệu runtime** ở mục 6.5 — không phải `diff` văn bản của tệp build.

### 6.2 TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| manifest Host | `lib/typert.host.js` **793 dòng** (stock) | `src/typert-host.ts` **803 dòng** → `lib/typert.host.js` **1.336 dòng** |
| manifest Remote-client | `lib/typert.remote-client.js` **88 dòng** (stock) | `src/typert-remote-client.ts` **98 dòng** → `lib/typert.remote-client.js` **88 dòng** |
| build | 1 entry (`src/index.ts` → `lib/index.js`) | **3 entry** (`index` + `typert.host` + `typert.remote-client`); `buildPackage` trả `{ service, typertHost, typertRemoteClient, worker? }` |
| `exports` | **không có** khoá `exports` | `.` + `./typert` + `./remote` + `./package.json` |
| `gbh.tests` | 1 đích | 2 đích (+ `tests/host/session-reference-typert.test.ts`) |
| `gbh.row` | — | **KHÔNG khai** (giữ nguyên, mục 4) |

**Vì sao `lib/` ra 3 tệp chứ không phải 4:** `buildPackage` build thêm entry **worker nếu có**
(`src/worker.ts`, nhánh `existsSync` + `worker?` trong `BuiltEntries`). Gói này **không** có worker, và stock
cũng chỉ có 3 tệp `lib/*.js` (`index.js` · `typert.host.js` · `typert.remote-client.js`) — nhánh worker nằm
trong code để gói anh em dùng chung khuôn.

### 6.3 `exports` đối chiếu stock

| subpath | stock `exports` | ta `exports` | trạng thái |
|---|---|---|---|
| `.` | `./lib/index.js` | `./lib/index.js` | ✓ |
| `./types` | `./lib/types/types.js` | — | **không khai**: `src/types.ts` chưa port (nợ phụ mục 5.5) nên không có `lib/types/` |
| `./typert` | `./lib/typert.host.js` | `./lib/typert.host.js` | ✓ **mới** — `typert-loader` dò đúng subpath này |
| `./remote` | `./lib/typert.remote-client.js` | `./lib/typert.remote-client.js` | ✓ **mới** |
| `./package.json` | ✓ | ✓ | ✓ |
| `./src/*` | `./src/*` | — | bản ta chỉ build trong profile, không ship `src/` |
| `./locale/*.json` | ✓ | — | bản ta không có `locale/` |

Hai tệp typert import `zod` (stock khai ở `dependencies`) và `@deepseek-ai/dsh-typert-protocol/remote-info`
(stock khai ở `peerDependencies`). Gói ta đã khai cả hai trong `peerDependencies`; riêng `zod` được symlink
`node_modules/zod → apps/host/node_modules/zod` (đúng khuôn `api-workspace-controller`) để `tsc -p` giải được.

### 6.4 Vì sao PHẢI port hai manifest mới mount được row

- **Gateway discovery theo `./typert`.** `dsh-typert-loader` chỉ nạp manifest của gói **có** export `./typert`;
  thiếu nó thì `ctx.sessionReferenceResolver` **không có** codec/scope/`typeSymbol` cho
  `sessionReferenceResolver/candidates` — method `@Remote("candidates")` vẫn tồn tại nhưng **không đi được trên wire**.
- **Client đang trỏ tới `typeSymbol` của gói này.** `packages/host/api-remotes/src/client-parts/part-14.txt`
  (dòng 5 · 39 · 45 · 53) tham chiếu `@deepseek-ai/dsh-session-reference#sessionReferenceResolver/…`; mount bản
  thiếu manifest ⇒ client gọi vào **schema không tồn tại** ⇒ rơi RPC surface.
- **Mount là cặp `disable + insert`.** Row `session-reference` đang BẬT (`ours.yml` 532–533); thay bằng bản thiếu
  manifest là **mất** đúng phần stock đang cung cấp. Port 1:1 hai manifest ⇒ bản ta phủ **đúng** surface cũ.

### 6.5 Đo lượt port (19/10/2026, 04:10–04:16)

| phép đo | kết quả |
|---|---|
| `bun run build.ts` | **PASS** — `lib/index.js` 684 dòng · `lib/typert.host.js` 1.336 dòng · `lib/typert.remote-client.js` 88 dòng |
| `tsc -p packages/host/session-reference/tsconfig.json` | **PASS** — **0 lỗi** |
| bề mặt export runtime của manifest remote | **BẰNG** stock: cùng `["TYPERT_REMOTE","default"]`, `default === TYPERT_REMOTE` ở cả hai |
| cây dữ liệu manifest remote | **BẰNG** stock: `JSON.stringify(TYPERT_REMOTE)` trùng từng ký tự (so trong cùng tiến trình, serializer chịu BigInt) |
| endpoint | **BẰNG**: 1 method `sessionReferenceResolver/candidates`; `scope` `{context:'agent', wire:'agentId'}`; `invocation` `{kind:'direct'}`; `sourceLocation` `packages/context/session-reference/src/index.ts:290:9` |
| `typeSymbol` 3 chỗ | **BẰNG**: `@deepseek-ai/dsh-session/types#SessionId` · `…#sessionReferenceResolver/candidates:query` · `…:result` |
| codec zod | **BẰNG**: payload hợp lệ parse ra cùng object; payload thiếu field **ném** ở cả hai; `jsonSchema` của `result` trùng |
| `exports` | 4 subpath (`.` · `./typert` · `./remote` · `./package.json`), 4 tệp đích đều tồn tại trong `lib/` |

Còn lại để mount: (1) `tests/host/session-reference-typert.test.ts` (đích đã khai trong `gbh.tests`, chưa có) cùng
`tests/host/session-reference.test.ts`; (2) Lead boot-smoke + `check:app`; (3) Lead thêm `packages/README.md` §4;
(4) Lead flip `gbh.row`.
