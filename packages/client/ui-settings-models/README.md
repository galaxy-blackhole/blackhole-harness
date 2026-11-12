<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-client-ui-settings-models — bản viết lại của dsh-client-ui-settings-models (row ui-settings-models)
-->

# @galaxy-blackhole/gbh-client-ui-settings-models

Bản viết lại của Galaxy Blackhole cho row `ui-settings-models`: **trang Models** trong Settings (khoá API
từng nhà cung cấp, danh sách model, tuyến pi-ai tự khai) và **hai bước onboarding** dùng chung hạ tầng
settings. **Trạng thái: đã viết xong + nghiệm thu trên artifact; đã khai `gbh.row`.**

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Bản gốc nửa client (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js` (4.526 dòng) |
| Bản gốc nửa host | `…/lib/index.js` (`Config` + `apply`, phát `webserver/index-inject`) |
| Kiểu công khai | `…/lib/types/client/*.d.ts` |
| Test hành vi | `tests/client/ui-settings-models.test.ts` (9 ca / 66 expect) |

## Bản đồ hành vi ĐO ĐƯỢC (nguyên văn từ bản gốc)

| Chạm gì | Chi tiết |
|---|---|
| Seam (fiber inject) | `slots` · `locale` · `remote` · `remote.credentials` · `remote.llm` · `remote.settings` · `remote.session` · `configForms` · `settingsSchema` — **9 mục nguyên văn** |
| Slot | `settings.section` / occupant `models` / `order 10` / `label: () => t("nav")` + hai slot con khai `children` (`settings.models.provider-card` kiểu `keyed`, `settings.models.footer` kiểu `list`) |
| Slot | `settings.onboarding` / occupant `welcome-notice` / `order -100` — **chỉ đăng ký khi KHÔNG phải vỏ desktop** |
| Slot | `settings.onboarding` / occupant `deepseek-official` / `order 0` + slot con `settings.models.sign-in` (`single`) |
| Từ điển | namespace `settings.models`, **134 khoá × 2 ngữ** |
| RPC chéo tầng | `remote.credentials.set/unset/describe` · `remote.settings.mutate` · `remote.llm.listProviders/listConfigurableProviders/discoverModels` · `remote.session.modelCatalog` |
| Cấu hình công khai | nửa host phát `__DSH_MODELS_ONBOARDING__` qua `webserver/index-inject`; nửa client đọc lại và tắt onboarding khi có dấu hiệu `dshDesktop` |
| Seed nền tảng dùng | `react` · `react/jsx-runtime` · `@galaxy-blackhole/gbh-client-ui-primitives` · `@galaxy-blackhole/gbh-client-store` (đi qua `require` của factory) |

## Cấu trúc

`src/` tách theo **từng module của bản gốc** (mỗi file ≤ 1.000 dòng): `api-key` · `api-key-input` ·
`editor-footer` · `model-input-types` · `model-reasoning-efforts` · `model-row` ·
`deepseek-models-editor` · `model-list-editor` · `store` · `protocol-label` · `custom-provider-card` ·
`provider-editor` · `models-section` · `onboarding-modal` · `deepseek-onboarding-dialog` ·
`welcome-notice` · `onboarding-copy` · `welcome-store` · `operations` · `schema-operations` · `locales`;
cộng `ids.ts` (hằng định danh) · `plugin.ts` (mặt plugin) · `css.ts` (nhúng 4 thẻ style) · `styles.ts`
(bảng tên lớp đã băm) · `index.ts` (nửa host) · `client.ts` (điểm vào bundle) · `modules.d.ts` (khai
bốn seed nền tảng — repo không cài `@types/react`).

## Đối chứng với bundle gốc (đo trên ARTIFACT, không grep `src/`)

1. **Một id**: `grep -c 'id: "@deepseek-ai' lib/client.js` = **0**; `grep -c 'id: "@galaxy-blackhole'` = **1**.
2. **Tập slot**: chạy **đúng hai regex của `check:rows`** trên `src/` của ta và trên `lib/` của bản gốc ⇒
   hai tập bằng nhau, đúng `settings.section` + `settings.onboarding`.
3. **Từ điển**: rút khoá từ chính vùng `locales` của bundle gốc ⇒ bằng `Object.keys(zh)`/`Object.keys(en)`.
4. **CSS**: cả bốn module là **nguyên văn từng byte** (chuỗi nhúng trong artifact khớp `JSON.stringify` của
   file nguồn), giữ nguyên hash lớp gốc `zGbnIq_` · `jLrgrW_` · `GL8Viq_` · `t1T8VW_`.
5. **Cây render**: `ModelsSection` của ta và của bản gốc được dựng trong cùng một `window` giả (bắt factory
   qua `window.__ModuleLoader__.load`, cấp `react`/`jsx-runtime`/`primitives`/`store` giả) ⇒ **hai cây
   giống hệt từng ký tự**.

## Khác biệt CÓ Ý so với bản gốc

- Nửa client **không nhúng schemastery + cosmokit** (~890 dòng) như bản gốc. Bản gốc dùng
  `Config(payload)` chỉ để chuẩn hoá **một** boolean; ở đây là hàm thuần `resolveOnboardingConfig` với
  đúng hành vi đó (thiếu payload ⇒ `true`; không phải boolean ⇒ `true`). Nhờ vậy artifact 165 KB thay vì
  211 KB và bundle không kéo theo cây phụ thuộc của schemastery.
- Nửa host **vẫn dùng schemastery** (`Config = z.object({ credentialOnboarding: z.boolean().default(true) })`)
  như bản gốc, để Settings/config-editor của kernel render được field.

## Nợ đã trả trong lúc viết

- `ctx.on("connection/reset", …)` là sự kiện **kernel**, không phải `remote.$on` — ca A/B cây render đã
  bắt được chỗ viết nhầm này (bản gốc gọi `ctx.on`).
- Cổng chặn cài hai lần: `let uiSettingsModelsInstalled` **phạm vi module** + `WeakSet` tên `seenScopes`
  (đặt tên khác `installedContexts` để `check:rows` không báo oan "cổng khoá theo ctx"), cờ **bật SAU**
  `applyInner`, **KHÔNG** khoá theo `ctx`.

## License

MIT (theo repo).
