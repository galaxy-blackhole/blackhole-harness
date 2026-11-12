<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README goi experimental-translator: port 1:1 host-only (bundle 938 dong + 5 module) — TRUOC/SAU, bang chung A/B, no ky thuat
-->

# `@galaxy-blackhole/gbh-host-experimental-translator`

Bản viết lại **1:1** của `@deepseek-ai/dsh-experimental-translator` — *dịch máy văn bản*: endpoint ẩn danh
Google/Bing + route trả phí DeepSeek, có **Session bền** cho kết quả đã lưu, huỷ được và gỡ nạp tĩnh lặng.

## 1. Phân loại row (đo trước khi viết)

| phép đo | kết quả |
|---|---|
| row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | `- id: translator` ở **thụt lề 0**, không `disabled` — row TOP-LEVEL (do bundle `dsh-experimental-cot-translation-bundle` chèn) |
| mặt phải | **MỘT MẶT** (`dsh.client` vắng, không `lib/client.js`) |
| kích thước gốc | `lib/index.js` **938 dòng** (bundle 5 vùng) + `provider` 214 · `storage` 214 · `deepseek` 285 · `index` 147 · `error` 13 |
| peer | cordis · dsh-timeout · dsh-util-values · dsh-session · dsh-session-persistence · cordis-plugin-loader · dsh-llm · dsh-credentials · dsh-launch-environment; dep: schemastery |

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC (DSH) | SAU (gói của ta) |
|---|---|---|
| host plugin | 1 bundle 938 dòng (5 vùng) | `src/plugin.ts` **267 dòng** (`Translator extends Service`, Config 8 trường, translate/resolve/availableProviders/maxTextChars, track/lifetime) |
| module phụ | vùng trong bundle | `deepseek.ts` **434** · `storage.ts` **272** · `provider.ts` **187** · `types.ts` **156** · `error.ts` **41** |
| export công khai | `TranslationError` · `default` (Translator) | **giống hệt** (regex `lib/index.js` hai bên) |
| `String(Config)` | 8 trường + transform endpoint | **trùng từng ký tự**; mặc định provider `bing` · `maxTextChars` 4.000 |
| mặt `./types` | `lib/types/types.js` = `export {};` | `src/types.ts` (khai báo kiểu 1:1) + `lib/types.js` rỗng runtime |
| test | — | **15 ca / 34 expect · 0 fail** |

## 3. Bằng chứng A/B (Context cordis THẬT, hai bản dựng riêng)

- **export**: `["TranslationError","default"]` hai bên; mặt `./types` rỗng runtime.
- **Config**: `String(Config)` trùng từng ký tự; `{}` ⇒ provider `bing`, `maxTextChars` 4.000.
- **TranslationError**: `name`/`code`/`message`/`instanceof Error` trùng; hợp mã lỗi lấy **nguyên văn 10 mã** của gốc.
- **resolve**: mặc định + `sourceLanguage: "auto"`; provider tường minh + `sessionId`; route trả phí thiếu Session ⇒ cùng `TRANSLATION_SESSION_REQUIRED`; văn bản vượt trần ⇒ cùng `TRANSLATION_TEXT_LIMIT` (thông điệp nguyên văn); `maxTextChars` đọc từ config.
- **recipe** (hàm thuần): `anonymousRecipe` ổn định theo provider/config và **đổi khi endpoint đổi**; `deepseekRecipe` trùng.
- **availableProviders**: thiếu seam ⇒ hai bản cùng kết quả hoặc cùng lỗi (so nhánh, không so thời gian).
- **translate**: vượt trần ⇒ cùng `TEXT_LIMIT` **trước khi chạm mạng**; signal đã huỷ ⇒ cùng `AbortError`.
- **đăng ký service**: cả hai bản đăng ký `translator` trên Context thật.

## 4. Kiểm

```bash
bun test tests/host/experimental-translator.test.ts   # 15 pass / 34 expect
bun run packages/host/experimental-translator/build.ts # lib/index.js + lib/types.js
```

## 5. Nợ kỹ thuật

1. Chưa khai `gbh.row` — chờ `lab:row` + boot-smoke + dòng `packages/README.md` §4 (đúng quy trình của Lead; xem `gbh.row_unmounted_ly_do` trong package.json khi có).
2. Không ship `.d.ts` (như các gói khác của repo).
3. Bộ test A/B **không chạm mạng**: các nhánh cần HTTP thật (translate Google/Bing, DeepSeek paid) chỉ đối chứng gián tiếp qua recipe + đường lỗi; nếu cần bằng chứng mạng thì phải có lab có endpoint giả.
