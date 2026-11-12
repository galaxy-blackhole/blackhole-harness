<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row session-title-llm (@deepseek-ai/dsh-session-title-first-prompt-llm) — nguồn đối chiếu G4, lý do peer, TRƯỚC/SAU, và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-session-title-first-prompt-llm

Bản viết lại **host-only** của row `session-title-llm` trong profile `blackhole` (Wave A, task-12).

- Row stock: id **`session-title-llm`** → `@deepseek-ai/dsh-session-title-first-prompt-llm`
  (**118 dòng** `lib/index.js`, **MỘT MẶT**: không `lib/client.js`, không khoá `dsh.client`).
- Gói của ta: `@galaxy-blackhole/gbh-session-title-first-prompt-llm` (tên package khác tên thư mục theo quy ước
  `@galaxy-blackhole/gbh-*`; **id row** vẫn là `session-title-llm` vì đó là id stock bị thay).
- **`gbh.row` ĐÃ khai**, gồm `config` sáu giá trị đo từ oracle và **`disabled: true` mirror** (xem §4).

## 1. Nguồn đối chiếu (G4)

| Hành vi | Bản gốc (`lib/index.js`) | Bản của ta (`src/index.ts`) | Bằng chứng |
|---|---|---|---|
| Tên plugin | `name = "session-title-first-prompt-llm"` | y nguyên | `name` bằng nhau (test) |
| Service bắt buộc | `inject = ["sessionTitle", "llm", "sessions"]` | y nguyên, cùng thứ tự | mảng bằng nhau (test) |
| Schema `Config` | `z.object({ targetWords, targetCjkCharacters, maxInputBytes, maxOutputTokens, timeoutMs, provider, model })` | cùng bảy trường, cùng thứ tự | `String(Config)` trùng từng chữ (test) |
| `resolveConfig` | `resolveSessionTitleLlmConfig(execution)` + `assertTarget("targetWords"/"targetCjkCharacters")` | y nguyên | hai lớp kiểm, thông điệp trùng (test) |
| `selectReasoningEffort` | `model.reasoning?.efforts[0]?.id` | y nguyên | `reasoningEffort = "low"` khi efforts = [low, high] (test) |
| `systemPrompt` | **5 dòng** (không neo tiêu đề) | y nguyên từng chữ | `system.split("\n")` so từng dòng (test) |
| `frameMessages` | `Generate the session title from this JSON array of human messages:\n` + JSON mảng | y nguyên | so từng chuỗi (test) |
| Tin nhắn dùng | **CHỈ `messages[0]`**; `messageSeqs = [first.seq]` | y nguyên | input KHÔNG chứa tin nhắn thứ hai; `messageSeqs = [1]` (test) |
| Lấy tiêu đề | dòng đầu không rỗng, bỏ nhấn mạnh `*…*` bao TRỌN dòng, giữ nhấn mạnh bên trong | y nguyên, cùng regex | 5 ca văn bản, khớp bản gốc (test) |
| Đường lỗi | `tool-calls` · `max-tokens` · khối `tool-call` · không văn bản · không có tin nhắn | y nguyên từng chữ | 5 ca so thông điệp (test) |
| Đăng ký | `ctx.sessionTitle.register({ id, automatic: "first-prompt", generate })` | y nguyên | id + nhịp bằng nhau (test) |
| Tập export | `Config · apply · inject · name` | **bằng** (0 thiếu · 0 thừa) | đo trên **ARTIFACT** `lib/index.js` (test) |

**Khác biệt CÓ Ý (duy nhất)**: bản gốc import helper `assertNever` từ `@deepseek-ai/dsh-util-values`;
ta viết lại đúng helper đó tại chỗ (`unreachableVariant`, cùng định dạng thông điệp
`unreachable variant in SessionTitleLlmFinish: …`) để **không thêm một peer chỉ vì một hàm 3 dòng**.
Nhánh đó bất khả tới (`SessionTitleLlmFinish` là union đóng ba nhánh).

## 2. Vì sao dùng seam thay vì viết lại

`executeSessionTitleLlm` sở hữu **chính sách thi hành dùng chung** của mọi provider tiêu đề: chuẩn bị tuyến
qua `ctx.llm.prepareCall`, trần byte đầu vào, trần token đầu ra, thời hạn đầu-cuối, ghi ĐÚNG một bản ghi
`session/title-llm-request`, và lắp stream bằng `BlockAssembler`. Viết lại nó là viết lại `ctx.llm` +
`dsh-timeout` + `dsh-llm` — vượt phạm vi MỘT row provider. Row này **cố ý** chỉ sở hữu phần của nó.

## 3. Peer và lý do (bảng §3b)

| Peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 (kernel) | kiểu `Context` cho `apply` — **chỉ mượn kiểu**, bị xoá lúc build |
| `@deepseek-ai/schemastery` | 1 (kernel) | `z.object` của `Config` — **nạp lúc chạy** |
| `@deepseek-ai/dsh-session-title` | ngoài bảng — seam owner | `SessionTitleProviderId` + `normalizeSessionTitle`; tự chế bản sao sẽ lệch chuẩn hoá của service đang nhận tiêu đề |
| `@deepseek-ai/dsh-session-title-llm` | ngoài bảng — policy helper | `executeSessionTitleLlm` + `SessionTitleLlmConfigFields` + `resolveSessionTitleLlmConfig`; **chính sách thi hành dùng chung** mà row stock cũng gọi |

`gbh.peers` = đúng bốn tên trên, **⊆ `peerDependencies`** (so PHẦN TỬ, có **đối chứng âm**).

## 4. Row mount với `insertDisabled: true` — MIRROR oracle, KHÔNG phải tắt tính năng

**Sự thật 1 — oracle TẮT provider này.** `--dump-config` 18/10 21:19 (và `.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng 48–55):
row `session-title-llm` mang **`disabled: true`**. Mirror đúng nghĩa: row của TA cũng phải disabled.

**Sự thật 2 — seam chỉ nhận MỘT provider.** `dsh-session-title/lib/index.js:360`: provider thứ hai ném
`session-title provider "…" is already registered`. App ta đang bật `optional-session-title-all-prompts-ours`.

**Sự thật 3 — `gbh.row.disabled` KHÔNG điều khiển row chèn.** `apps/cli/src/rewrite-metadata.ts:110` sinh
`- id: <stock> / disabled: <row.disabled>` rồi `- insert: - id: <stock>-ours / name: …`; nếu chỉ khai
`disabled: true`, row chèn vẫn BẬT ⇒ hai provider cùng đăng ký (đo được trước khi có `insertDisabled`).

**Cách sửa (Lead mở khoá 18/10/2026):** CLI thêm trường `insertDisabled` (render đúng dòng `disabled` trong
khối `insert`, nhận `true` và `{ js }`). Gói này khai:
`gbh.row = { id, config, disabled: true, insertDisabled: true, tests }` ⇒ patch sinh ra:
`- id: session-title-llm-ours` → `name: …` → **`disabled: true`** (đúng thứ tự).

**Bằng chứng cây thật (`--dump-config` 18/10 21:42):** stock `disabled: true` · `session-title-llm-ours`
`disabled: true` · **active entry 180 = 180** (entry 327 → 328, disabled 147 → 148) ⇒ thêm ĐÚNG MỘT row TẮT,
không đổi số plugin đang chạy.

Muốn BẬT provider first-prompt sau này: phải tắt hẳn `optional-session-title-all-prompts-ours` (task riêng),
rồi đổi `insertDisabled` → `false` trong metadata — KHÔNG sửa tay patch.
## 5. TRƯỚC → SAU (số đo)

| # | Phép đo | TRƯỚC (18/10, trước task-12) | SAU |
|---|---|---|---|
| 1 | Bản GBH cho gói này trong repo | **không có** (row vẫn trỏ gói DSH, `disabled: true`) | package host-only + `lib/index.js` build được |
| 2 | Tập export trên ARTIFACT | — (không có artifact) | `['Config','apply','inject','name']` **= ĐÚNG** tập bundle gốc |
| 3 | `name` · `inject` · `String(Config)` | — | **trùng từng ký tự** với bundle gốc |
| 4 | Câu lệnh hệ thống (5 dòng) + đóng khung mảng | — | **trùng từng dòng**; input chỉ chứa tin nhắn ĐẦU |
| 5 | 5 ca lấy tiêu đề + 5 đường lỗi | — | **trùng thông điệp/chuỗi** với bản gốc |
| 6 | Test của gói | 0 | **18 ca · 18 pass · 147 expect** (A/B cả hai bản trên cùng giàn) |
| 7 | `check:rows` | 120 gói | **121 gói — TẤT CẢ đạt · 0 CHẶN** |
| 8 | Locale 000e | — | `locale/{en,zh}.json` **byte-for-byte** bản gốc (sha256 khớp) |
| 9 | `--dump-config`: `session-title-llm-ours` + số entry đang chạy | **0** dòng (chưa có `insertDisabled`, row chèn sẽ BẬT) | **1** dòng `disabled: true`; **active 180 = 180** (entry 327→328, disabled 147→148) |

Lệnh: `~/.bun/bin/bun test tests/host/session-title-first-prompt-llm.test.ts` · `~/.bun/bin/bun run check:rows`.

## 6. Bằng chứng lab (`.parity/lab-evidence/session-title-first-prompt-llm.json`)

`bun run tools/check/lab-evidence.ts session-title-first-prompt-llm` (chạy LẠI sau khi mount disabled — 21:45):
**DAT** · `#root` **24.602** · **0 lỗi console** · **0 lỗi trang** · **0 `did-not-activate`** · **0 overlay** ·
25 slot · 13 nút · 116,6s. Lab ghi `[lab] patch cua repo DA thay row` ⇒ đo trên ĐÚNG cây của repo
(row ta đã chèn, `disabled: true`), không cần overlay.

Đối chứng: `#root` **24.602 = 24.602** với lượt đo TRƯỚC khi có `insertDisabled` ⇒ việc thêm một row TẮT
**không đổi một ký tự DOM nào** (đúng kỳ vọng: row host-only, 0 slot).
## 7. CHƯA làm

- **Mount thật 5439**: thuộc lượt boot của Lead (chỉ Lead restart). Bằng chứng cây đã có: `--dump-config` sinh
  `session-title-llm-ours` + `disabled: true`, active entry không đổi; lab DAT 0/0.
- **Chữ ký reviewer độc lập** — phần PACKAGE đã được reviewer xác nhận đạt; chờ Lead ghi chữ ký vào signoff.
- **BẬT provider first-prompt**: cần task riêng tắt `optional-session-title-all-prompts-ours` rồi đổi
  `insertDisabled` → `false` (không sửa tay patch).
- **Đổi peer sang bản GBH của `dsh-session-title`** khi gói đó chuyển xong: hiện import bản stock (cùng
  hợp đồng, helper thuần) để không phụ thuộc tiến độ của tm-host-session.

## 7b. Đường phân giải tới gói thư viện GBH (task-32, 18/10/2026)

Consumer này dùng **ĐƯỜNG DẪN TƯƠNG ĐỐI** `../../session-title-llm/src/index.ts` thay cho bare specifier.
Lý do ĐO ĐƯỢC: bare specifier chỉ phân giải nhờ **symlink tạo TAY** trong `node_modules` (đã gitignore) ⇒
**clone mới typecheck hỏng**. Nay xoá symlink ⇒ `tsc` **0 lỗi** + test **pass**; shim
`src/gbh-session-title-llm.d.ts` đã **XOÁ** (gói thư viện re-export đủ sáu kiểu). Artifact: **mã giống hệt**.

## 8. License

MIT (theo repo). Giữ nguyên thông báo bản quyền của DSH khi dẫn xuất hành vi (THIRD_PARTY_NOTICES.md).
