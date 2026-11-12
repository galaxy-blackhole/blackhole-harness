<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-client-ui-theme — ban do dong + hop dong + 403 token cua row ui-theme
-->

# @galaxy-blackhole/gbh-client-ui-theme

Ban viet lai cua Galaxy Blackhole cho row **ui-theme** (@deepseek-ai/dsh-client-ui-theme).
Day la **nen cua moi row UI khac**: no cap service **theme** va bo token **--dsw-***.

## 1. Hop dong phai khop (doc tu bundle goc, khong doan)

| Muc | Gia tri |
|---|---|
| inject | slots · locale · remote · configForms |
| service CAP | **theme** (ctx.provide("theme", theme), dong 2029) |
| SETTINGS_NS | settings.theme (dong 1521) |
| export | SETTINGS_NS · ThemeRuntime · apply · inject |
| UI row dang ky | AppearanceRow · FontFamilyRow · FontSizeRow · FontSettingsGroup |
| CSS module | AppearanceRow.module.css · FontFamilyRow.module.css · FontSettingsGroup.module.css · FontSizeRow.module.css |
| Token --dsw-* | **403 token** (bang o muc 4) |

### ThemeRuntime — 13 method (dong 1662-1880)

getTheme · exportInspectTokens · setTheme(id) · setFontSize(role, px) · adjustFontSizes(delta) ·
setFontFamily(role, value) · write(operation) · adopt · register(definition) · overrideTokens(source, tokens) ·
buildSnapshot · composeActive(active) · publish

## 2. Ban do dong bundle goc (2082 dong) — doc muc nay thay vi doc lai ca file

| Dong | So dong | Vung |
|---|---|---|
| 11-25 | 15 | clsx@2.1.1/node_modules/clsx/dist/clsx.mjs |
| 26-43 | 18 | AppearanceRow.module.css.mjs |
| 44-96 | 53 | AppearanceRow.js |
| 97-350 | 254 | vendor/cosmokit/lib/index.js |
| 351-983 | 633 | vendor/schemastery/lib/index.mjs |
| 984-1131 | 148 | lib/types/theme-settings.js |
| 1132-1155 | 24 | FontSizeRow.module.css.mjs |
| 1156-1167 | 12 | FontFamilyRow.module.css.mjs |
| 1168-1217 | 50 | FontFamilyRow.js |
| 1218-1295 | 78 | FontSizeRow.js |
| 1296-1307 | 12 | FontSettingsGroup.module.css.mjs |
| 1308-1358 | 51 | FontSettingsGroup.js |
| 1359-1405 | 47 | settings-store.js |
| 1406-1408 | 3 | ui-theme/src/styles/base.css.mjs |
| 1409-1411 | 3 | ui-theme/src/styles/corner-shape.css.mjs |
| 1412-1414 | 3 | ui-theme/src/styles/design-platform.css.mjs |
| 1415-1417 | 3 | ui-theme/src/styles/focus.css.mjs |
| 1418-1420 | 3 | ui-theme/src/styles/onboarding.css.mjs |
| 1421-1423 | 3 | ui-theme/src/styles/scrollbar.css.mjs |
| 1424-1426 | 3 | ui-theme/src/styles/gradient-shadow-text.css.mjs |
| 1427-1429 | 3 | ui-theme/src/styles/shiki.css.mjs |
| 1430-1459 | 30 | styles.js |
| 1460-1518 | 59 | locales.js |
| 1519-2083 | 565 | index.js |

**Vendor nhung (cosmokit + schemastery + clsx): 902 dong** ⇒ code THAT cua row chi con khoang **1181 dong**.
Vi vay con so row:cost (2301 dong) phong dai cong viet lai ~2 lan — de nghi tru cac vung vendor khi dem.

## 4. Token --dsw-* (403) — nen cua moi row UI

| Nhom | So token |
|---|---|
| font | 182 |
| alias | 107 |
| static | 77 |
| specific | 11 |
| radius | 6 |
| elevation | 5 |
| shadow | 4 |
| gradient | 3 |
| focus | 2 |
| linear | 2 |
| menu | 2 |
| corner | 1 |
| mask | 1 |

Danh sach day du (de row sau dung lai, khong tu nghi ra ten token):

Danh sach day du **403 token** da tach ra file tra cuu chung: **docs/UI-TOKENS.md**
(nguon: bundle goc dsh-client-ui-theme, doi chieu 17/10/2026). Giu bang nhom o tren de doc nhanh;
tra cuu tung ten thi mo file kia — moi row UI dung chung mot danh muc, khong tu nghi ra ten token.

## 5. Khuon bat buoc cua repo (task-54) + di biet co chu dich

1. Header 5 dong (create date co dinh 15/10/2026) · <=1000 dong/file · moi export co JSDoc.
2. moduleIds CHI id cua ta · aliases giu id stock · bundle dang ky MOT id.
3. Cong apply: let pham vi MODULE + WeakSet, dat TRUOC JSDoc cua ham, om applyInner, log console.error kem id roi RETHROW.
4. Boc lop bang ham dung thi phai sao chep static inject.
5. KHONG nem khi moi truong thieu (document/window/cau Desktop): tat tinh nang phu + console.warn; ghi ro di biet ngay cho sua.
6. Be mat service phai DU: consumer stock doc thuoc tinh nao thi phai co thuoc tinh do (chay bun run parity:surface).

## 6. Trang thai

- [x] Vong 1: doc ban goc + chot hop dong (tai lieu nay)
- [ ] Vong 2: dung khung + test
- [ ] Vong 3: hoan thien + lab:row + mount

## 3b. Hop dong HANH VI cua ThemeRuntime (doc tu dong 1655-1900, khong doan)

| Method | Luat chinh xac |
|---|---|
| getTheme() | tra snapshot dang giu (tham chieu on dinh giua hai lan doi) |
| exportInspectTokens() | gop token built-in + token cua moi theme + token chi co trong override; tra ban sao JSON-safe, sap xep theo ten |
| setTheme(id) | system luon hop le; id khac phai da dang ky, neu khong NEM theme "<id>" is not registered; trung gia tri thi khong lam gi; ghi qua host.set(preference, id) khi la tuy chon built-in; roi publish() |
| setFontSize(role, px) | px phai NGUYEN trong [min,max] cua role, neu khong nem <role> font size <px> is outside <min>..<max>; trung thi khong lam gi; ghi host.set(spec.field, px) roi publish |
| adjustFontSizes(delta) | moi role kep vao khoang cua no; MOT lan mutate duy nhat voi cac field doi; khong co field nao doi thi KHONG ghi, KHONG phat su kien |
| setFontFamily(role, value) | chuan hoa danh sach; gia tri rong ⇒ tra ve stack built-in; trung thi khong lam gi |
| write(operation) | tang pendingWrites, chay operation, .finally giam va goi adopt() (de khong tu ghi de len gia tri vua ghi) |
| adopt() | BO QUA khi pendingWrites > 0; doc host.getSnapshot().value; rong thi thoi; so sanh preference + ca ba font size + font families, khac moi publish |
| register(definition) | id system NEM ("system" is a preference, not a registrable theme id); id trung NEM (theme "<id>" is already registered); tra disposer; huy theme dang active ⇒ tra preference ve mac dinh roi publish |
| overrideTokens(source, tokens) | mot layer cho moi source; layer xep theo seq tang dan, layer sau THANG theo tung token; goi lai cung source ⇒ THAY ca layer cu; tra disposer chi go dung layer nay (vo hieu neu da bi thay); token sai ⇒ nem loi day du |
| buildSnapshot() | resolvedId = preference === "system" ? (media?.matches ? "dark" : "light") : preference; thieu theme trong registry ⇒ nem theme registry lost "<id>"; tra object DONG BANG gom preference/fontSizes/fontFamilies/active/themes/revision |
| composeActive(active) | khong co layer ⇒ tra chinh definition do (DONG NHAT); co layer ⇒ gop theo seq, moi token chon gia tri theo color scheme dang active; tra object dong bang |
| publish() | tang revision roi phat theme/change |

Khoi tao: preference = DEFAULT_PREFERENCE (system) · media = typeof matchMedia === undefined ? undefined : matchMedia(...) (**khong nem khi thieu moi truong**) · nghe change cua media qua ctx.effect · nghe host.subscribe de adopt() · cai phim tat co gian font.

Hang so da doi chieu nguon: THEME_PREFERENCE_FIELD = "preference" (995) · DEFAULT_PREFERENCE = "system" (999) · FONT_ROLES = [text, code, terminal] (1001) · FONT_SIZE_SPECS (1011): text 10..22 mac dinh 14 · code 10..16 mac dinh **11** · terminal 10..**20** mac dinh 13.
(Hai gia tri cuoi toi da DOAN SAI mot lan roi doi chieu lai — ghi ra day de nguoi sau khong doan lai.)

## 6b. Trang thai vong 2 (moc dung hien tai)

- [x] src/ids.ts (52 dong): id ta + id stock + SETTINGS_NS + truong preference + su kien + 3 vai tro font + specs DOI CHIEU NGUON
- [x] Hop dong + hop dong hanh vi (muc 1, 2, 3b) — du de viet lai ma khong phai doc lai bundle goc
- [x] src/theme-runtime.ts (13 method theo muc 3b) + khong nem khi thieu moi truong — 6 test, 0 fail
- [x] src/plugin.ts (wrapper: inject nguyen van 4 service, provide theme co guard, cong boolean PHAM VI MODULE truoc JSDoc, log loi roi rethrow) + src/client.ts
- [x] build.ts hai nua (host ESM 278 B, client CJS 11.544 B, dung MOT id) + package.json (exports, dsh.client.inject nguyen van, CHUA khai gbh.row theo luat)
- [ ] 4 UI row (AppearanceRow · FontFamilyRow · FontSizeRow · FontSettingsGroup) + CSS module + 25 khoa tu dien
- [ ] test (nap module TUOI moi ca) + parity:surface + lab:row + mount
