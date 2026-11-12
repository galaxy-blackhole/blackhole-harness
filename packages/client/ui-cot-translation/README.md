<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README goi ui-cot-translation: port 1:1 HAI NUA (host 198 dong · client 1.057 dong / 11 vung) cua row cot-translation; row dang PARK (chua qua boot-smoke)
-->

# `@galaxy-blackhole/gbh-client-ui-cot-translation`

Bản viết lại **1:1 cả hai nửa** của `@deepseek-ai/dsh-experimental-client-ui-cot-translation` — *“Optional machine
translation of expanded reasoning, preserving original Session text”*.

## 1. Phân loại row (đo trước khi viết)

| phép đo | kết quả |
|---|---|
| row trong dump `.parity/dumps/2026-10-17T23-25-26/oracleA.normalised.json` | `- id: cot-translation`, không `disabled`, `config: { provider: "bing", targetLanguage: "auto" }` |
| nguồn chèn row | `dsh-experimental-cot-translation-bundle/cordis.patch.yml` khối `insert` (KHÔNG phải `cordis:group`) ⇒ không phải row NHÓM |
| mặt phải | **HAI MẶT**: host `lib/index.js` **9.546 B · 250 dòng**, client `lib/client.js` **42.061 B · 1.057 dòng / 11 #region** |
| typert | bản gốc có `./typert` + `./remote`; nửa client của bản gốc **inline** bộ dựng `remote-info` (không `require` typert-protocol) ⇒ gói ta port kèm `src/client/remote-info.ts` |

## 2. Nửa host (1:1) — `src/`

| file | nội dung | đối chứng |
|---|---|---|
| `src/preferences.ts` | `LANGUAGE_PREFERENCE_PATTERN` + `PROVIDER_PREFERENCES` | **nguyên văn** hai hằng số bản gốc |
| `src/types.ts` | `CotTranslationPreferences` · `CotTranslationSnapshot` + khai bổ sung `RemoteErrorDetailsMap` | **nguyên văn** `lib/types/types.d.ts` |
| `src/controller.ts` | `CotTranslationController extends TypertRemoteService` với `@Remote` trên **`limits`** + **`translate`**, `static inject` + `static Config`, constructor `configure({ auto: false })`, `resolveSelected` | `String(Config)` **trùng từng ký tự**; `static inject` trùng; bề mặt Remote trùng |
| `src/index.ts` | export **duy nhất `default`** | tập export artifact **= bản gốc = `["default"]`** |
| `src/remote-surface.ts` | cửa phụ CHO TEST (`remoteMethods`) | không nằm trong bề mặt export |

## 3. Nửa client (1:1, tách theo #region) — `src/client/`

| file | vùng gốc | nội dung |
|---|---|---|
| `src/client.ts` | 11 `lib/types/client/index.js` | entry: export `apply` + `inject` (KHÔNG `createPlugin` — bản gốc không có) |
| `src/client/remote-info.ts` | 1 `typert/protocol/…/remote-info.js` | bộ dựng chỉ mục Remote (inline như bản gốc) |
| `src/client/typert-remote-client.ts` | 2 `lib/typert.remote-client.js` | spec `cotTranslation/limits` + `cotTranslation/translate` |
| `src/client/translation.ts` | 3 `lib/types/client/translation.js` | `reasoningFragments` + `ReasoningTranslation` |
| `src/client/translation-css.ts` | 4 `dsh-css:…Translation.module.css.mjs` | CSS nguyên văn + bảng lớp + gắn thẻ `<style>` (tagId/dataset.plugin = id CỦA TA) |
| `src/client/translation-body.ts` | 5 `…/TranslationBody.js` | thân khối suy luận có nút dịch |
| `src/client/locales.ts` | 6 `…/locales.js` | `NS` · `en` · `zh` · `formLabels` |
| `src/client/provider-label.ts` + `translation-settings.ts` | 7 `…/TranslationSettings.js` | thẻ tuỳ chọn dịch trong Plugins |
| `src/client/preferences-form.ts` | 9 `…/preferences-form.js` | form đang chờ dùng chung `SettingsFormModel` |
| `src/client/mount.ts` | 10 `…/mount.js` | `inject` 4 seam + `registerUi` + `mountTranslation` |

Vùng 8 (`lib/types/preferences.js`) dùng chung `src/preferences.ts` của nửa host.

Hợp đồng client giữ nguyên: slot `conversation.chat.reasoning.body` · slot `plugins.bundle.config`
(key `@deepseek-ai/dsh-experimental-cot-translation-bundle`) · Remote `cotTranslation.limits/translate`.

## 4. Build (HAI lời gọi `Bun.build` tách rời)

```bash
bun run packages/client/ui-cot-translation/build.ts [outDir]   # argv[2] = thư mục đích (mount trong profile)
```

- host: `src/index.ts` → `lib/index.js` (ESM, target node)
- client: `src/client.ts` → CJS → bọc `window.__ModuleLoader__.load({ id, factory })` với **ĐÚNG MỘT id** của ta
  (`@galaxy-blackhole/gbh-client-ui-cot-translation`); id gói gốc **0 lần** trong artefact (kể cả CSS tagId/dataset.plugin)

## 5. Kiểm

```bash
bun test tests/client/ui-cot-translation.test.ts   # 27 ca: 11 ca host cũ + 16 ca client (BỘ BA · MỘT-ID · A/B vùng gốc)
```

## 6. Trạng thái mount — PARK

`package.json` khai `gbh.row_unmounted_ly_do` (row `cot-translation`, `moduleIds` = id ta, `aliases` = id gốc,
`config` parity dump). **KHÔNG** khai `inject`/`disabled` vì dump không khai.

Nợ còn lại: **chờ Lead chạy boot-smoke** rồi mới đổi `gbh.row_unmounted_ly_do` → `gbh.row` (không sửa mã).

## Ghi chú parity (19/10/2026)

- **Export surface**: bản gốc nửa client CHỈ export `apply` + `inject` (KHÔNG có `createPlugin`) ⇒ ta giữ
  **đúng 2 tên** đó — **parity > khuôn** (khác ui-brand/ui-settings-* có createPlugin).
- **`sourceLocation`** trong spec Remote giữ **nguyên đường dẫn nguồn gốc**, KHÔNG đổi theo repo ta —
  đây là metadata mô tả nguồn, không phải id bundle, nên ưu tiên parity.
- **`gbh.provenance`** khai nguồn: `{ stock, version, sha }` (sha256 của `lib/client.js` gói stock).
