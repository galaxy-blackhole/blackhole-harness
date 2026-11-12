<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README goi repeat-tool-reminder: port 1:1 PHAN THAT cua bundle 2.268 dong (1-2107 la vendor) — TRUOC/SAU, A/B, no ky thuat
-->

# `@galaxy-blackhole/gbh-host-repeat-tool-reminder`

Bản viết lại **1:1 phần THẬT** của `@deepseek-ai/dsh-repeat-tool-reminder` — guard cảnh báo **lặp lời gọi tool
y hệt tham số** theo chuỗi liên tiếp của MỘT agent; chèn nhắc nhở (advisory, không chặn, không viết lại lời gọi)
vào context sau khi tool chạy.

## 1. Đo 4 bước trước khi viết (tách VENDOR khỏi code THẬT)

| phép đo | kết quả |
|---|---|
| row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | `- id: repeat-tool-reminder` ở **thụt lề 0** (TOP-LEVEL), không `disabled`, có `config.thresholds: [3, …]` |
| mặt phải | **MỘT MẶT** (`dsh.client` vắng) |
| kích thước gốc | `lib/index.js` **2.268 dòng** — nhưng **dòng 1–2107 là VENDOR** (bundle in mã của typert-protocol, util-values, util-crypto, util-brand, llm) |
| **phần THẬT** | **dòng 2108–2266 ≈ 159 dòng** (`lib/types/index.js`) + `lib/types/index.d.ts` + `locale/{en,zh}.json` |
| peer | cordis · dsh-agent · dsh-tools (+`dsh-llm` cho `createUserMessage`); dep: schemastery |

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC (DSH) | SAU (gói của ta) |
|---|---|---|
| mã thật | 1 region 159 dòng trong bundle 2.268 dòng (lẫn vendor) | **4 tệp rời · 473 dòng**: `plugin.ts` 231 · `arguments.ts` 82 · `reminder.ts` 79 · `config.ts` 71 (+ `index.ts` 10) |
| vendor | in trong bundle | **import từ kernel**: `createUserMessage` (`@deepseek-ai/dsh-llm`), `z` (`@deepseek-ai/schemastery`); còn lại `node:*` |
| export công khai | `Config · apply · name` | **giống hệt** (regex `lib/index.js` hai bên) |
| `String(Config)` | thresholds default `[3,5,8]` · include/exclude `[]` · previewChars 500 | **trùng từng ký tự**; schema cho cùng object mặc định |
| locale | `en.json` · `zh.json` | **chép byte-for-byte** |
| test | — | **19 ca / 62 expect · 0 fail** |

## 3. Bằng chứng A/B (Context cordis THẬT, 2 bản áp riêng, người nghe ghi lại rồi kích hoạt thủ công)

- **ngưỡng**: lặp y hệt args ⇒ nhắc đúng ở count 3 (câu nhẹ), 5 và 8 (câu chi tiết: `Repeated tool call detected:` + `consecutive_calls: N`) — message **deep-equal** giữa hai bản (đã bỏ `id` ngẫu nhiên).
- **canonicalize**: `{a,b}` vs `{b,a}` là CÙNG chuỗi; args khác ⇒ reset.
- **agent**: hai agent ⇒ hai chuỗi riêng; không có `agent` ⇒ không theo dõi.
- **include/exclude wildcard**: `read_*` chỉ theo dõi tool khớp; tool bị loại là **trong suốt** (không đếm, không reset).
- **pre-step**: tin nhắn `source.kind === "user"` cắt chuỗi; loại khác thì không.
- **downstream**: kết quả `block` được giữ `feedback`, nhắc nhở chèn **TRƯỚC** `additionalContexts` của phía sau; kết quả thường giữ nguyên các trường khác.
- **validate**: `thresholds` rỗng / không nguyên / <2 / trùng / `argumentsPreviewChars` < 1 ⇒ **cùng thông điệp lỗi** (4 câu tiếng Anh nguyên văn, em-dash U+2014).
- **preview**: `argumentsPreviewChars` cắt đầu + hậu tố `… (+N more chars)`; `thresholds` không sắp xếp được chuẩn hoá tăng dần (ngưỡng nhẹ = MIN).
- **đăng ký event**: đúng hai event `agent/pre-step` + `tools/post-execute`.

## 4. Kiểm

```bash
bun test tests/host/repeat-tool-reminder.test.ts   # 19 pass / 62 expect
bun run packages/host/repeat-tool-reminder/build.ts
```

## 5. Trạng thái row — **PARKED** (đúng quy trình Lead)

`package.json` KHÔNG khai `gbh.row`; khối park:

```json
"gbh": { "park": { "ly_do": "…", "row": { "id": "repeat-tool-reminder", "tests": ["tests/host/repeat-tool-reminder.test.ts"] } } }
```

Chỉ flip khi: (1) test A/B xanh ✅, (2) **Lead tự chạy `boot-smoke repeat-tool-reminder` ĐẠT**, (3) Lead thêm dòng
`packages/README.md` §4 — rồi Lead mount + đo `check:app` 11/11.

## 6. Nợ kỹ thuật

1. `reminder.ts` khai `declare module "@deepseek-ai/dsh-llm"` cho khoá `"repeat-tool-reminder"` của `MessageSourceMap`
   — **chép từ `lib/types/index.d.ts` gốc** (đây là phép nối kiểu mà chính gói gốc làm; `plugin.ts` không khai lại).
2. Các helper nội bộ (`canonicalize`, `previewArguments`, `wildcardToRegExp`, `validateThresholds`, …) được export ở
   tầng module để test được, **không** nằm trong mặt public (`index.ts` chỉ xuất `Config · apply · name`).
3. Không ship `.d.ts` (như các gói khác của repo).
