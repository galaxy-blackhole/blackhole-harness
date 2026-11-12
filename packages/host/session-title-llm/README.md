<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho GÓI THƯ VIỆN session-title-llm — nguồn đối chiếu G4, lý do
      peer, vì sao KHÔNG khai gbh.row, bằng chứng đo được và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-session-title-llm

Bản viết lại **1:1** của gói **THƯ VIỆN** `@deepseek-ai/dsh-session-title-llm` (**229 dòng** `lib/index.js`,
**MỘT MẶT**: KHÔNG có `lib/client.js`, KHÔNG có khoá `dsh.client`).

## 0. Vì sao gói này KHÔNG khai `gbh.row` (đo được, không phải ý thích)

| Câu hỏi | Đo được | Kết luận |
|---|---|---|
| Bản gốc có `apply` (tức là một ROW) không? | tập export bản gốc = `SESSION_TITLE_TIMEOUT_CODE · SessionTitleLlmConfigFields · SessionTitleLlmConfigSchema · executeSessionTitleLlm · resolveSessionTitleLlmConfig` — **0 hàm `apply`** | KHÔNG phải row ⇒ không có entry nào để thay |
| Có entry nào trỏ tới gói này trong cây plugin? | `grep 'dsh-session-title-llm'` trong `.parity/dumps/2026-10-18T01-31-57/ours.yml` = **0** | gói chỉ được **import** bởi 2 provider, không được mount |
| Row id `session-title-llm` trỏ tới gói nào? | `ours.yml` dòng 47–55: `name: '@deepseek-ai/dsh-session-title-first-prompt-llm'` (**disabled: true**) | row đó là việc của **task-12**, KHÔNG phải gói này |

⇒ Khai `gbh.row` cho gói này sẽ (i) **chiếm row của task-12**, và (ii) chèn một row **không có `apply`** ⇒
boot ném. Vì vậy gói khai `gbh.peers` + `gbh.tests` mà **KHÔNG** có `gbh.row` — đúng tiền lệ repo:
`packages/host/subprocess` · `agent-preset` · `workflow`.

**Ai đang dùng bản gốc (đo bằng grep import)**: `packages/host/optional-session-title-all-prompts` và
`packages/host/session-title-first-prompt-llm` — CẢ HAI import `@deepseek-ai/dsh-session-title-llm` từ
`apps/host/node_modules`. Chuyển 2 consumer sang gói này là **task riêng của Lead (task-13)**, người viết
gói này KHÔNG tự sửa consumer (luật một vùng ghi).

## 1. Nguồn đối chiếu (G4)

| Hành vi | Bản gốc (`lib/index.js`) | Bản của ta (`src/`) | Bằng chứng |
|---|---|---|---|
| `SESSION_TITLE_TIMEOUT_CODE` | `"SESSION_TITLE_TIMEOUT"` | y nguyên | bằng nhau (test) |
| `SessionTitleLlmConfigFields` | 5 trường `z`: 3 trường `.required()`, `provider`/`model` là `z.string()` | y nguyên, cùng thứ tự khoá | `String(từng trường)` **trùng**; danh sách khoá **trùng** |
| `SessionTitleLlmConfigSchema` | `z.object(Fields)` | y nguyên | `String(schema)` **trùng**; 5 ca sai ra **cùng thông điệp** |
| `resolveSessionTitleLlmConfig` | 6 lớp kiểm + `deepFreeze({...value})` | y nguyên từng câu thông điệp | **11 ca** bảng so hai bên: cùng kết quả / cùng chuỗi lỗi |
| `resolveRoute` | cặp tường minh THẮNG `request.route`; thiếu cả hai ⇒ ném | y nguyên | ca "tuyến tường minh" + ca "không có tuyến" |
| `terminalFinish` | `stop`/`tool-calls`/`max-tokens` trả về; `error`/`aborted` NÉM mang `code`; nhánh còn lại `assertNever` | y nguyên | 3 ca kết cục + 2 ca lỗi (mã `RATE_LIMITED`) |
| Trần đầu vào | `Buffer.byteLength(prepared.input, "utf8") > maxInputBytes` ⇒ ném nêu ĐÚNG số byte | y nguyên | ca 10 byte / trần 5 ⇒ cùng chuỗi |
| Trần đầu ra | `maxTokens` trong **cả** `prepareCall(config)` và lệnh gọi `stream(options)` | y nguyên | `config` đã ghi = `{provider, model, maxTokens: 64}` |
| Hạn chót | `deadline(request.signal, timeoutMs, SESSION_TITLE_TIMEOUT_CODE)`, dọn ở `finally` | y nguyên (`disposeDeadline` — cùng ngữ nghĩa `using`) | ca `timeoutMs: 1` + stream trễ 60ms ⇒ **cùng mã** `SESSION_TITLE_TIMEOUT` |
| Tin nhắn người dùng | `createUserMessage({ content: [text], source: { kind: "dsh-session-title-llm" } })` | y nguyên (cùng `createUserMessage` của kernel) | `role`/`source.kind`/`content` **trùng**; id là NGẪU NHIÊN ở cả hai bên |
| Bản ghi request | ĐÚNG MỘT `session.append("session/title-llm-request", { titleProvider, messageSeqs, route, system, messages, maxTokens, reasoningEffort? })` — ghi TRƯỚC dispatch | y nguyên, cùng thứ tự khoá | `toEqual` sự kiện hai bên; ca "không effort" ⇒ **vắng khoá** |
| Lắp stream | `BlockAssembler.push` từng mẩu + `throwIfAborted` trước/sau mỗi mẩu | y nguyên | 4 ca kết cục: khối văn bản, `max-tokens`, `tool-calls`, lỗi |
| Tùy chọn cuối | `deepFreeze({ ...call.config, messages, system, sessionId, purpose: "session-title", signal })` | y nguyên | `optionsFrozen = true`; `purpose`/`sessionId` **trùng** |
| Tập export | 5 tên | **bằng** (0 thiếu · 0 thừa) | đo trên **ARTIFACT** `lib/index.js` đã build |

## 2. Peer và lý do (bảng §3b)

| Peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 (kernel) | kiểu `Context` cho `executeSessionTitleLlm` — **chỉ mượn kiểu**, bị xoá lúc build |
| `@deepseek-ai/schemastery` | 1 (kernel) | `z.object` của schema — **nạp lúc chạy** |
| `@deepseek-ai/dsh-llm` | 2 (seam) | `BlockAssembler` + `createUserMessage` **nạp LÚC CHẠY**; đây là thuật toán lắp stream DUY NHẤT của kernel — tự viết bản sao là **hai chuẩn lắp khác nhau** |
| `@deepseek-ai/dsh-timeout` | 2 (seam) | `deadline` + `MAX_TIMER_DELAY_MS` **nạp LÚC CHẠY**; trần thời gian và ngữ nghĩa `TimeoutReason` phải là của kernel |
| `@deepseek-ai/dsh-util-values` | 2 (tiện ích hạ tầng; tiền lệ `session-projection-cache`) | `deepFreeze` + `assertNever` **nạp LÚC CHẠY**; `deepFreeze` là vòng lặp sâu có xử lý `AbortSignal`/chu trình ⇒ tự chế là **hai chuẩn đóng băng** |
| `@deepseek-ai/dsh-session` | **ngoài bảng** (tiền lệ: `approval` · `message-feedback` · `workflow`) | kiểu `SessionSeq` — **chỉ mượn kiểu**, bị xoá lúc build |
| `@deepseek-ai/dsh-session-title` | **ngoài bảng** (tiền lệ: `optional-session-title-all-prompts`) | kiểu `SessionTitleProviderRequest`/`SessionTitleProviderId` — **chỉ mượn kiểu**, bị xoá lúc build |

⇒ `gbh.peers` = 7 tên trên, **⊆ `peerDependencies`** (so PHẦN TỬ + **đối chứng âm** xoá-một-tên / thêm-tên-lạ).
`dependencies` **RỖNG** (không tạo thể hiện thứ hai).

## 3. Khác biệt CÓ Ý (duy nhất) và một luật của repo

1. **KHÔNG khai `declare module` nào** (luật **000d**): khoá sự kiện `session/title-llm-request` và khoá
   nguồn tin nhắn `dsh-session-title-llm` được khai **theo CẤU TRÚC** trong `src/types.ts`
   (`TitleRequestSink`) và ép kiểu tại **ĐÚNG MỘT ĐIỂM** khi tạo tin nhắn. Lý do đo được: d.ts của
   **bản gốc** đã khai hai augmentation đó và nó nằm trong cùng chương trình `tsc` (vì
   `optional-session-title-all-prompts` import bản gốc) ⇒ khai trùng sẽ là **hai khai báo cùng khoá**.
2. `src/` tách 3 tệp (`index` · `execute` · `types`) thay vì một `index.js` 229 dòng — luật ≤1000 dòng/file.
3. Helper `disposeDeadline` thay cho `using` của TS: cùng ngữ nghĩa (dọn trong `finally`), nhưng KHÔNG
   phụ thuộc việc lib chuẩn của chương trình có khai báo `Symbol.dispose` hay không — đúng khuôn
   `jobs-local`/`llm-deepseek-account` trong repo.

## 4. Test

```bash
~/.bun/bin/bun test tests/host/session-title-llm.test.ts   # 30 ca · 135 expect · 0 fail
```

| Nhóm | Số ca | Đo cái gì |
|---|---|---|
| Bề mặt gói trên ARTIFACT | 3 | tập export ta = gốc (5 = 5) · 4 module ngoài nạp lúc chạy · `String(schema)`/`String(từng trường)` trùng · 5 ca schema sai ra cùng thông điệp |
| `resolveSessionTitleLlmConfig` | 12 | 11 ca bảng (hợp lệ/không tuyến · `null` · khoá lạ · 3 ca số âm/không nguyên/không dương · vượt `MAX_TIMER_DELAY_MS` · thiếu một nửa cặp tuyến · cặp rỗng) + ca **đóng băng sâu & tách rời** |
| `executeSessionTitleLlm` | 10 | 5 ca hành vi (hạnh phúc · tuyến tường minh · bộ chọn mức suy luận · `max-tokens` · `tool-calls`) + 5 ca lỗi (đã huỷ trước · không seq nguồn · vượt `maxInputBytes` · không tuyến · hết hạn chót) + 2 ca `error`/`aborted` |
| C6 danh tính | 1 | hai lượt thi hành ⇒ hai danh sách tin nhắn **RIÊNG** (`!==`, cả phần tử) · hai `resolve` ⇒ hai vật thể RIÊNG, đều đóng băng |
| Quy ước repo | 2 | **không** `gbh.row` + **đối chứng dương** (bản gốc thật sự không export `apply`) · `gbh.peers ⊆ peerDependencies` + đối chứng âm |

**Giàn đo**: mỗi bên cài chạy trên **Context cordis THẬT** (`new Context()` của chính kernel) bọc Proxy đắp
seam `llm` (ghi lại `prepareCall` + phát đúng chuỗi mẩu, `selectReasoningEffort` nhận metadata
`reasoning.efforts = [low, high]`). **Cùng một giàn** cho bản của ta và bản gốc ⇒ mọi khác biệt quy được
về **ruột gói**. Danh tính tin nhắn (`id` ngẫu nhiên) được chuẩn hoá thành *có id hay không* trước khi so.

## 5. TRƯỚC / SAU và phần CHƯA làm

| | TRƯỚC (bản gốc) | SAU (gói này) |
|---|---|---|
| Vai trò | thư viện dùng bởi 2 provider tiêu đề | **y nguyên** (chưa ai import — xem §0) |
| Tập export trên artifact | 5 tên | **bằng** (5 = 5) |
| `grep -c "from @deepseek-ai/cordis" lib/index.js` | — | **0** (chỉ mượn kiểu) |
| Test của gói | — | **30 pass / 0 fail / 135 expect** |
| `check:rows` | — | không áp dụng: gói **không khai `gbh.row`** ⇒ cổng không kiểm (và không được kiểm oan) |

## 6. Bề mặt KIỂU công khai + đường phân giải bền (task-32, 18/10/2026)

**(a) Re-export ĐỦ SÁU kiểu** mà `dsh-session-title-llm/lib/types/index.d.ts` công bố (dòng 23, 48, 61, 83,
99, 103): `SessionTitleLlmConfig` · `ResolvedSessionTitleLlmConfig` · `SessionTitleLlmPreparedRequest` ·
`SessionTitleLlmFinish` · `SessionTitleLlmResponse` · `SessionTitleLlmRequestEventData`.
Trước task-32 gói chỉ công bố 5 **giá trị** ⇒ consumer phải tự khai shim `declare module` để bù kiểu (đó là
mùi nợ kỹ thuật: shim chép tay sẽ lệch khi gói đổi). Nay **hai shim đã bị XOÁ**.

**(b) Đường phân giải bền cho consumer** — chọn **ĐƯỜNG DẪN TƯƠNG ĐỐI**:

| | TRƯỚC (task-13) | SAU (task-32) |
|---|---|---|
| Câu import ở consumer | `from "@galaxy-blackhole/gbh-session-title-llm"` | `from "../../session-title-llm/src/index.ts"` |
| Cần gì để typecheck | **symlink** `node_modules/@galaxy-blackhole/…` (đã gitignore, **tạo TAY**) + shim `.d.ts` | **chỉ cây nguồn** — không node_modules, không shim, không script setup |
| Clone mới | typecheck **HỎNG** (đo được: xoá symlink ⇒ `TS2307 Cannot find module`) | typecheck **0 lỗi**, test **pass** (đo được với symlink ĐÃ XOÁ) |
| Artifact consumer | inline thư viện từ `lib/index.js` đã build | inline thư viện từ **`src/index.ts`** ⇒ không cần cả `lib/` của gói này |

Thêm `"types": "./src/index.ts"` trong `exports` để một consumer tương lai dùng bare specifier (nếu có
symlink workspace do `bun install`) vẫn có kiểu — nhưng **đường chính của repo là tương đối**.

**Bằng chứng đo được (18/10/2026)**
- `tsc --noEmit` (đúng cờ gate) trên `session-title-llm/src/index.ts` + 2 consumer: **0 lỗi** khi
  `node_modules/@galaxy-blackhole` của CẢ HAI consumer đã bị xoá.
- Test: **71 pass / 0 fail / 487 expect** trên 3 tệp (thư viện 30 · all-prompts 20 · first-prompt 21).
- Artifact 2 consumer: **MÃ GIỐNG HỆT** trước/sau (khác duy nhất dòng chú thích nguồn do Bun.build sinh:
  `// …/lib/index.js` → `// …/src/index.ts`).

**CHƯA làm**
1. `lab:row`/`--dump-config` **không áp dụng** cho gói thư viện (không có row); bằng chứng mount nằm ở 2
   consumer (row của chúng đã bật và đã được Lead boot).
