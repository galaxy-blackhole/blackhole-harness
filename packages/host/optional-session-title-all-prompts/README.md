<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row optional-session-title-all-prompts (host-only) — nguồn đối chiếu G4, lý do peer, và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-optional-session-title-all-prompts

Bản viết lại **host-only** của row `optional-session-title-all-prompts` trong profile `blackhole`.

- Row stock: `optional-session-title-all-prompts` → `@deepseek-ai/dsh-session-title-all-prompts-llm`
  (**127 dòng** build, **một mặt**: KHÔNG có `lib/client.js`, KHÔNG có khoá `dsh.client`).
- Gói của ta: `@galaxy-blackhole/gbh-optional-session-title-all-prompts` (tên package **khác** tên thư mục
  theo quy ước `@galaxy-blackhole/gbh-*`).
- **`gbh.row` ĐÃ khai** (metadata do Lead sinh 18/10/2026): `id` + `tests`; gói **điền thêm `config`**
  sáu giá trị **bắt buộc** (schema không có mặc định — thiếu nó thì boot ném
  `ValidationError: $.targetWords missing required value`, đo được trong log `gate:home-isolation`).
  Lượt `lab:row` + mount vẫn là quyết định của Lead (mục §6).

## 1. Nguồn đối chiếu (G4)

| Hành vi | Bản gốc (`lib/index.js`) | Bản của ta (`src/index.ts`) | Bằng chứng |
|---|---|---|---|
| Tên plugin | `name = "session-title-all-prompts-llm"` | y nguyên | `name` bằng nhau (test) |
| Service bắt buộc | `inject = ["sessionTitle", "llm", "sessions"]` | y nguyên, cùng thứ tự | mảng bằng nhau (test) |
| Schema `Config` | `z.object({ targetWords, targetCjkCharacters, maxInputBytes, maxOutputTokens, timeoutMs, provider, model })` | cùng bảy trường, cùng thứ tự | `String(Config)` trùng từng chữ (test) |
| `resolveConfig` | `resolveSessionTitleLlmConfig(execution)` + `assertTarget("targetWords"/"targetCjkCharacters")` | y nguyên | hai lớp kiểm, thông điệp trùng (test) |
| `selectReasoningEffort` | `model.reasoning?.efforts[0]?.id` | y nguyên | `reasoningEffort = "low"` khi efforts = [low, high] (test) |
| `systemPrompt` | 5 dòng + **4 dòng neo** khi có tiêu đề `provider` | y nguyên từng chữ | `system.split("\n")` so từng dòng (test) |
| `frameMessages` | mảng JSON khi không neo · object `{currentTitle, messages}` khi neo | y nguyên | so từng chuỗi (test) |
| Lấy tiêu đề | dòng đầu không rỗng, bỏ nhấn mạnh `*…*` bao TRỌN dòng, giữ nhấn mạnh bên trong | y nguyên, cùng regex | 6 ca văn bản, khớp bản gốc (test) |
| Đường lỗi | `tool-calls` · `max-tokens` · khối `tool-call` · không văn bản | y nguyên từng chữ | 4 ca so thông điệp (test) |
| Đăng ký | `ctx.sessionTitle.register({ id, automatic: "all-prompts", generate })` | y nguyên | id + nhịp bằng nhau (test) |
| Tập export | `Config · apply · inject · name` | **bằng** (0 thiếu · 0 thừa) | đo trên **ARTIFACT** `lib/index.js` (test) |

**Khác biệt CÓ Ý (duy nhất)**: bản gốc import helper `assertNever` từ `@deepseek-ai/dsh-util-values`;
ta viết lại đúng helper đó tại chỗ (`unreachableVariant`, cùng định dạng thông điệp
`unreachable variant in SessionTitleLlmFinish: …`) để **không thêm một peer chỉ vì một hàm 3 dòng**.
Nhánh đó là bất khả tới (`SessionTitleLlmFinish` là union đóng ba nhánh và seam đã ném cho `error`/`aborted`).

## 2. Vì sao dùng seam thay vì viết lại

`executeSessionTitleLlm` sở hữu **chính sách thi hành dùng chung** của mọi provider tiêu đề: chuẩn bị tuyến
qua `ctx.llm.prepareCall`, trần byte đầu vào, trần token đầu ra, thời hạn đầu-cuối, ghi ĐÚNG một bản ghi
`session/title-llm-request`, và lắp stream bằng `BlockAssembler`. Đo được: viết lại nó là viết lại
`ctx.llm` + `dsh-timeout` + `dsh-llm` (bản thân `dsh-session-title-llm` là **229 dòng** và gọi ba gói kernel).
⇒ Row này **cố ý** chỉ sở hữu phần của nó: câu lệnh, đóng khung, chọn mức suy luận, lấy tiêu đề — **y bản gốc**.

## 3. Peer và lý do (bảng §3b)

| Peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 (kernel) | kiểu `Context` cho `apply` — **chỉ mượn kiểu**, bị xoá lúc build |
| `@deepseek-ai/schemastery` | 1 (kernel) | `z.object` của `Config` — **nạp lúc chạy** |
| `@deepseek-ai/dsh-session-title` | **ngoài bảng** | `SessionTitleProviderId` (dấu hiệu provider) + `normalizeSessionTitle` (cắt an toàn UTF-8) — **nạp lúc chạy**; tự chế bản sao sẽ lệch chuẩn hoá của service đang nhận tiêu đề |
| `@deepseek-ai/dsh-session-title-llm` | **ngoài bảng** | `executeSessionTitleLlm` + `SessionTitleLlmConfigFields` + `resolveSessionTitleLlmConfig` — **nạp lúc chạy**; đây là **chính sách thi hành dùng chung** mà row stock cũng gọi (xem §2) |

⇒ `gbh.peers` = đúng bốn tên trên, **⊆ `peerDependencies`** (so PHẦN TỬ, có **đối chứng âm**:
xoá-một-tên / xoá-sạch / thừa-tên). Không tên nào nằm trong `dependencies`.
⚠️ **HAI peer ngoài bảng §3b cần Lead xác nhận mở rộng bảng** (như `user-questions` · `workflow` ·
`subagent-*` đã ghi): `dsh-session-title` và `dsh-session-title-llm`.
→ Tiền lệ đã có trong repo: `agent-preset` (`cordis-plugin-loader`, `dsh-agent-preset-registry`) và
`workflow` (`dsh-llm`) đều khai peer ngoài bảng kèm lý do đo được.

## 4. Cấu hình của row trong profile `blackhole`

Đọc từ bản dump gần nhất (.parity/dumps/…/ours.yml, dòng 1478–1485) — row **đang BẬT**, không `disabled`:

```yaml
- id: optional-session-title-all-prompts
  name: '@deepseek-ai/dsh-session-title-all-prompts-llm'
  config:
    targetWords: 5
    targetCjkCharacters: 10
    maxInputBytes: 4096
    maxOutputTokens: 64
    timeoutMs: 60000
```

⇒ Khi Lead bật `gbh.row`, khối patch phải giữ **đúng sáu giá trị** này (chúng **không có mặc định** trong schema).

## 5. Test

```bash
bun test tests/host/optional-session-title-all-prompts.test.ts   # 16 ca · 138 expect · 0 fail
```

| Nhóm | Số ca | Đo cái gì |
|---|---|---|
| Bề mặt plugin trên ARTIFACT | 3 | tập export ta = gốc (`0 thiếu · 0 thừa`) · `name`/`inject`/`String(Config)` · đăng ký đúng một provider |
| Sinh tiêu đề (A/B với chính bundle gốc) | 4 | câu lệnh 5 dòng · neo 4 dòng khi `source.kind === "provider"` · KHÔNG neo với `fallback`/`user`/vắng · lấy dòng đầu + bỏ nhấn mạnh bao ngoài (6 ca chữ) |
| Đường lỗi (A/B) | 4 | 4 kết cục không dùng được · thiếu cặp tuyến · vượt `maxInputBytes` · vượt trần `timeoutMs` · hai lớp kiểm đích độ dài |
| C6 (danh tính) | 1 | hai lượt cài ⇒ provider **RIÊNG** (`!==`), mỗi bên giữ đích độ dài của mình |
| Quy ước peer | 4 | `gbh.peers ⊆ peerDependencies` + **đối chứng âm** (xoá-một-tên · xoá-sạch) |
| 000e | 1 | bản gốc **không có** `locale/` ⇒ ta cũng không ship |

Cùng một giàn giả cho **cả hai bên**: seam `sessionTitle` ghi lại provider, tầng `llm` phát đúng chuỗi mẩu
(`text-delta` → `finish`), phiên giả ghi lại `session/title-llm-request`. Vì **cả hai bản gọi CÙNG một
`executeSessionTitleLlm`**, phép A/B cô lập đúng phần row sở hữu.

## 6. TRƯỚC / SAU và phần CHƯA làm

| | TRƯỚC (bản gốc) | SAU (gói này) |
|---|---|---|
| Row trong config | `optional-session-title-all-prompts` (bật) | **`gbh.row` đã khai** (id + tests + `config` sáu giá trị) — chờ lượt boot của Lead |
| Tập export trên artifact | `Config · apply · inject · name` | **bằng** (4 = 4) |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |
| Test của gói | — | **18 pass / 0 fail / 141 expect** |

## 8. Đường phân giải tới gói thư viện GBH (task-32, 18/10/2026)

Consumer này dùng **ĐƯỜNG DẪN TƯƠNG ĐỐI** `../../session-title-llm/src/index.ts` thay cho bare specifier
`@galaxy-blackhole/gbh-session-title-llm`. Lý do ĐO ĐƯỢC: bare specifier chỉ phân giải nhờ **symlink tạo
TAY** trong `node_modules` (đã gitignore) ⇒ **clone mới typecheck hỏng** (`TS2307 Cannot find module`).
Nay: xoá symlink ⇒ `tsc` **0 lỗi**, test **pass**; shim `src/gbh-session-title-llm.d.ts` đã **XOÁ** vì gói
thư viện đã re-export đủ sáu kiểu. Artifact: **mã giống hệt** trước/sau (khác duy nhất dòng chú thích nguồn
của Bun.build).

**CHƯA làm (chờ Lead)**:
1. `bun run lab:row optional-session-title-all-prompts` trên **cổng riêng + home tạm** (0 lỗi console · 0 `did not activate`);
2. mount thật + TRƯỚC/SAU trên app 5439 (đo `session/title` sinh từ **toàn bộ** prompt, không chỉ prompt đầu);
3. ⚠️ **`config` trong `gbh.row` phải giữ ĐÚNG sáu giá trị ở §4** — chúng **không có mặc định** trong schema,
   nên khối patch thiếu `config` ⇒ row **fail lúc boot** trong khi row stock đã bị tắt ⇒ mất provider `all-prompts`.

**Peer khi mount**: package trong `profiles/node_modules` phải đúng **TÊN PACKAGE**; bốn peer ở §3 đã có sẵn
trong kernel nên tầng nạp cấp một thể hiện duy nhất.
