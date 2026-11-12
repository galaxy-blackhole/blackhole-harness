<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row system-prompt của DSH (sổ lắp ghép system prompt).
-->

# @galaxy-blackhole/gbh-system-prompt

Bản viết lại **theo hành vi** của gói `@deepseek-ai/dsh-system-prompt` (row `system-prompt`, tier **T1**).
Đây là **sổ lắp ghép system prompt**: mọi row khác **đăng ký** mục/ngữ cảnh/tool/biến vào đây, rồi mỗi bước model
gọi `ctx.systemPrompt.assemble()` để nhận **một** bản lắp có thứ tự chuẩn.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `system-prompt` (tier T1) | `@galaxy-blackhole/gbh-system-prompt` |
| Package | `@deepseek-ai/dsh-system-prompt` (0.2.1-alpha.4) | `@galaxy-blackhole/gbh-system-prompt` (0.1.0) |
| Đường dẫn đối chiếu | `apps/host/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js` (**409 dòng**) + `lib/types/index.d.ts` (**316 dòng**) | `packages/host/system-prompt/src/` — **4 module** (`index.ts` · `types.ts` · `render.ts` · `order.ts` · `layer.ts`), artifact **329 dòng** |
| Mức độ dẫn xuất | — | **viết lại theo hành vi**: đọc `.d.ts` + bundle để nắm hành vi, viết lại TypeScript, **so từng hành vi với chính bundle gốc** |
| Hai mặt? | **KHÔNG** — `package.json` gốc **không có** `dsh.client`, `lib/client.js` **không tồn tại** | **KHÔNG** — một mặt (host thuần) |
| `locale/` | `en.json` · `zh.json` | **chép byte-for-byte** (shasum `aca35609…` · `4c296e6b…`) |
| Bề mặt service | `ctx.systemPrompt` + 2 sự kiện `system-prompt/assemble` (waterfall) · `system-prompt/change` (emit) | **giữ nguyên** tên service, tên sự kiện, `static Config`, chữ ký từng phương thức |

### Bước 0 — ba phép bắt buộc (đo lại 18/10/2026, dump **MỚI NHẤT** `2026-10-18T01-31-57`)

| # | Phép | Kết quả |
|---|---|---|
| i | cặp `- id: system-prompt` + `name: '@deepseek-ai/dsh-system-prompt'` trong dump | **CÓ** — `ours.yml` dòng **465–466** (`oracleA.yml` dòng 429–430) |
| ii | `dsh.client` trong `package.json` gốc **VÀ** `lib/client.js` | **KHÔNG** / **KHÔNG** ⇒ **MỘT MẶT** (không có nửa client ẩn — bài học `typert`) |
| iii | `config:` + `inject:` đọc từ **ours.yml ĐANG CHẠY** | `config:` **chỉ một trường**: `personaPrefix: You are a coding agent powered by the {{model}} model.` · `inject:` **KHÔNG có** (row trần, không `!!js`) ⇒ `gbh.row` không cần inject/config; khi Lead khai thì chép **nguyên văn** hai dòng này từ `ours.yml`, **không** lấy từ `oracleA_nopatch` |

## 2. Vì sao cần — và ai gọi nó

`ctx.systemPrompt` là **nguồn duy nhất** của system prompt mà model thấy. Bản gốc cung cấp:

1. **Mục prompt có thứ tự** (`section`): danh tính harness, persona prefix/suffix của deployment, chính sách plan/team/PTC, hướng dẫn từng tool…
   Thứ tự do **trung tâm** cấp qua `getSectionOrder(name)` (bảng `SECTION_ORDERS`), để hàng chục row không tự chọn số.
2. **Ngữ cảnh động** (`context`): ảnh chụp runtime (cwd · chính sách sandbox · approval · subagent · nguồn harness · URL web…),
   gộp thành **một** khối `Current runtime context…`; mục `required` sống sót khi deployment tắt ngữ cảnh tuỳ chọn.
3. **Schema tool** (`tools`): gom schema từ mọi provider, **tách tham số** (`structuredClone`), rồi xếp theo `toolOrder`
   (mốc `<unlisted-tools>` chèn các tool không liệt kê theo thứ tự từ điển; tên lạ ⇒ ném lỗi).
4. **Biến nội suy** (`variable` + `{{name}}`): nội suy **nghiêm ngặt** — tham chiếu hỏng/không đăng ký/không có giá trị đều **ném**;
   giá trị đã thay **không bị quét lại**; `interpolate: false` giữ nguyên văn.
5. **Hai lớp đăng ký**: global + theo **scope** (agent). Mục/biến theo scope **che** bản global cùng tên.
   `system-prompt/assemble` là **waterfall có lọc phạm vi** (`scopeTarget`): người nghe theo scope chỉ thấy bản lắp của scope đó,
   và **giá trị waterfall trả về là chính thức** — trừ mục `complete` đang hiệu lực được **phục hồi** thành mục duy nhất.

**Ai gọi**: `dsh-agent-loop` (lắp trước mỗi bước model) · `harness-dev-context` · `sandbox-policy` · `approval` · `file-reference-local` ·
`mcp-resources` · `goal-round-driver` · `session-checkpoint-policy` … — tất cả đăng ký qua `ctx.systemPrompt`, hoặc đọc
`getSectionOrder/getContextOrder` để lấy đúng chỗ đặt.

### 5 câu hỏi bắt buộc (mục 0 của công thức)

| # | Câu hỏi | Trả lời đo được |
|---|---|---|
| 1 | Row đang **BẬT**? | **CÓ** — `ours.yml` dòng 465 (không `disabled`) |
| 2 | Thuần host hay có mount surface client? | **thuần host** — không `dsh.client`, không `lib/client.js`, không `loader.create/resolve` |
| 3 | Cần **seam** nào? | `Service` của cordis · `schemastery` cho `Config` · `dsh-scope` cho `NamedEntries/AnonymousEntries/ScopedLayers/scopeTarget` — **cả ba đều trong bảng §3b** |
| 4 | **Hành vi đo được**? | `ctx.systemPrompt.assemble()` ⇒ `{sections, contexts, tools, variables}` (thứ tự chuẩn) · `renderPrompt/renderContextSnapshot` ⇒ chuỗi · 2 sự kiện |
| 5 | Gói gốc có `dsh.client`? | **KHÔNG** ⇒ một mặt, thay được ngay (xem bước 0 ii) |

## 3. Peer — vì sao từng cái

| Peer | Bậc §3b | Vì sao **đo được** |
|---|---|---|
| `@deepseek-ai/cordis` | 1 | `Service` (**cùng lớp nền**), `ctx.effect` (bộ huỷ THẬT), `ctx.waterfall` (chạy waterfall `system-prompt/assemble`) |
| `@deepseek-ai/schemastery` | 1 | `static Config` để Settings/config-editor render được từng trường; bản gốc khai nó ở `dependencies`, ta khai **peer** theo quy ước repo (một thể hiện do kernel cấp) |
| `@deepseek-ai/dsh-scope` | 2 | `NamedEntries` · `AnonymousEntries` · `ScopedLayers` · `scopeTarget` — **vật mang phạm vi KHÔNG thể tự chế**: khoá scope là `Symbol` và `WeakMap` **nội bộ gói**, tự chế sẽ ra **hệ ký hiệu thứ hai** ⇒ mục theo scope không bao giờ che được bản global, waterfall không lọc được người nghe |

`gbh.peers` **= 3 tên**, `peerDependencies` **= đúng 3 tên đó** ⇒ **⊆ theo PHẦN TỬ** (có ca test + **ĐỐI CHỨNG ÂM**:
xoá-một-tên · xoá-sạch · thừa-tên). `dependencies` **RỖNG** — peer luôn là peer để kernel cấp **một** thể hiện.

## 4. Bảng TRƯỚC / SAU

⚠️ **Chưa mount** — gói **KHÔNG** khai `gbh.row` (luật: khai là việc của lượt boot của Lead). Vì vậy bảng dưới
**chưa có cột đo trên app thật**; cột "SAU" hiện ghi **bằng chứng tĩnh** đã đo được, và phép đo app thật thuộc lượt mount.

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| Tập export trên **ARTIFACT** (đúng 2 regex của `check:rows`) | **9** | **9 = 9**, **0 thiếu · 0 thừa** — `PERSONA_PREFIX_SECTION` · `PERSONA_SUFFIX_SECTION` · `SystemPrompt` · `TOOL_ORDER_REST` · `default` · `joinContextSections` · `renderContextSections` · `renderContextSnapshot` · `renderPrompt` |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |
| Prototype `SystemPrompt` | — | **trùng tên từng phương thức** (`8 = 8`) |
| `String(Config)` | — | **trùng từng ký tự** + **cùng thông điệp** khi config sai |
| Hành vi | — | **16 test / 154 expect · 0 fail** (A/B trên Context cordis THẬT của **hai bản cài**) |
| `locale/en.json` · `zh.json` | — | **byte-for-byte** (shasum khớp) |
| App 5439 (`check:app`) | (chờ lượt mount) | (chờ lượt mount) |

Lệnh tái lập: `bun test tests/host/system-prompt.test.ts` · `bun run build.ts` · `bun run check:rows` · `bun run gate --no-tests`.

## 5. Phần CHƯA làm (nói thẳng)

- **CHƯA khai `gbh.row`** ⇒ **CHƯA mount** vào profile/app 5439. Khi Lead khai, chép **nguyên văn** từ `ours.yml`:
  `id: system-prompt` · `config: { personaPrefix: "You are a coding agent powered by the {{model}} model." }` · **không inject**.
- **CHƯA chạy `lab:row`** và **CHƯA đo `check:app`** (`#root` · entry · `did not activate`) — hai phép này thuộc lượt boot.
- **Khác biệt CÓ Ý** so với manifest gốc (đã ghi để người sau không tưởng là sót):
  1. bản gốc khai `@deepseek-ai/schemastery` ở **`dependencies`**; ta khai **`peerDependencies`** theo quy ước §3b bậc 1;
  2. bản gốc khai `@deepseek-ai/dsh-llm` làm **peer** chỉ để lấy **kiểu** `ToolSchema`/`ContextSnapshotSection`; ta khai hai hình dạng đó
     **theo cấu trúc** trong `src/types.ts` ⇒ **không cần peer `dsh-llm`** (đúng tiền lệ `workflow`/`approval`: gói chỉ mượn kiểu thì không khai peer);
  3. bản gốc augment `Context.systemPrompt`/`Events` của cordis; ta **KHÔNG augment** — đo thật 18/10/2026: `@deepseek-ai/dsh-agent` (nhiều gói trong repo mượn kiểu)
     kéo `.d.ts` gốc vào **cùng chương trình tsc** ⇒ augmentation thứ hai đỏ `TS2717` (*"Property 'systemPrompt' must be of type 'SystemPrompt', but here has type 'SystemPrompt'"* —
     hai lớp khác nhau, cùng tên). Vì vậy hai bề mặt `emit`/`waterfall` được khai **theo cấu trúc** (`PromptContextSurface`) — đúng tiền lệ `harness-dev-context`/`mcp-resources`/`approval`.
- **CHƯA chứng minh `Context.systemPrompt` hoạt động khi `agent.ctx` là scope lồng nhiều tầng** (chỉ đo 1 tầng scope: mục/biến theo scope che global, cả hai bên y hệt).

## 6. C6 — danh tính (lớp lỗi `toEqual` KHÔNG bắt được)

| Vật thể | Ca test | Kỳ vọng |
|---|---|---|
| Sổ đăng ký của hai thực thể | cùng tên mục ở hai bản cài | **không ném** ở bản thứ hai ⇒ hai `PromptLayer` **độc lập** |
| Bản lắp mỗi lượt | hai lượt `assemble()` | `sections`/`contexts`/`tools`/`variables` là **vật MỚI**, phần tử mục cũng **mới**; sửa bản cũ **không lan** |
| `refreshContext` | mục chỉ-do-waterfall | **giữ nguyên THAM CHIẾU** khi ngữ cảnh runtime BẬT; **bị bỏ** khi TẮT; `required` được **giải lại** (vật mới) |

## 7. Ghi chú kỹ thuật

- Artifact **một file** `lib/index.js` (ESM, `packages: "external"`), `build.ts` nhận `process.argv[2]` làm thư mục đích.
- Nguồn tách 5 module để **≤ 1000 dòng/file** và để mỗi luật nằm một chỗ: `types.ts` (kiểu + hai bảng thứ tự) ·
  `render.ts` (nội suy + dựng chữ) · `order.ts` (thứ tự + `toolOrder` + thông điệp lỗi) · `layer.ts` (một lớp đăng ký) ·
  `index.ts` (service + waterfall + sự kiện).
- Mọi **thông điệp lỗi** chép **nguyên văn** — test so **từng ký tự** với bundle gốc (17 hình dạng hỏng), vì đó là hợp đồng mà
  `ui-*`/`agent-loop` dựa vào khi hiển thị lỗi.
- `structuredClone(parameters)` giữ đúng **tách tham số**: provider trả schema dùng chung cũng không bị bản lắp sửa vào.

## 8. Khác biệt thương hiệu CÓ Ý (18/10/2026 — task-17/N2)

- Câu **identity** của agent đổi tên sản phẩm: `"You are an AI agent powered by DeepSeek Harness."`
  → `"You are an AI agent powered by Galaxy Blackhole."`. **Chỉ đổi tên sản phẩm**; cấu trúc câu và hợp đồng prompt không đổi.
- Lý do: mục tiêu dự án "không còn gì liên quan DSH"; chuỗi này là **danh tính người dùng/model thấy**, không phải mã lỗi.
- Reviewer đối chiếu bundle gốc: mọi **hình dạng** khác (17 ca lỗi, thứ tự lớp, cờ `identity`) phải **y hệt**; chỉ chuỗi trên là khác có chủ đích.
