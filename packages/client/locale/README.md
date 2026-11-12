<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row locale cua DSH (M5 — row NEN, 48 row khac phu thuoc)
-->

# @galaxy-blackhole/gbh-client-locale

Bản viết lại của row **`locale`** — **dịch vụ ngôn ngữ** của vỏ: sổ từ điển đa namespace + lựa chọn ngôn
ngữ + chuỗi dự phòng, kèm dòng **Language** trong Settings. Row **HAI MẶT**: nửa host sở hữu mục cài đặt
`locale`, nửa browser phơi dịch vụ `locale` cho mọi row khác.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `locale` (tier T3, 1.602 dòng build) | `@galaxy-blackhole/gbh-client-locale` |
| Package | `@deepseek-ai/dsh-client-locale` `0.2.1-alpha.4` | `@galaxy-blackhole/gbh-client-locale` `0.1.0` |
| File gốc đã đọc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-locale/{package.json,lib/index.js,lib/client.js}` | `packages/client/locale/{build.ts,src/*.ts}` |
| Kích thước bản build | **1.602 dòng** — nhưng **887 dòng là VENDOR** (cosmokit 254 + schemastery 633); logic thật ≈ **600 dòng** | **1.183 dòng TS** (locale-runtime 467 · language-row 173 · plugin 160 · locales-common 107 · index 59 · bootstrap 55 · schemastery.d.ts 55 · ids 31 · styles 31 · client 29 · locales-settings 16) → `client.js` **20.309 B** + `index.js` **1.094 B** |
| **Bán kính nổ** | **48 row** khác có `@deepseek-ai/dsh-client-locale` trong `inject` | đo lại từ payload: 48 (khớp) |
| Hai mặt? | **CÓ**, và nửa host **KHÔNG rỗng** | đủ hai nửa trong MỘT package |
| Export nửa HOST | `Config` (schema schemastery) · `LOCALE_IDS` · `LOCALE_PREFERENCE_FIELD` · `LOCALE_SETTINGS_NAMESPACE` · `apply` | **y hệt** (builder tự chặn nếu thiếu) |
| Export nửa CLIENT | `COMMON_NS` · `FALLBACK_LOCALE` · `LocaleRuntime` · `SETTINGS_NS` · `apply` · `inject` | **y hệt** (bundle IIFE tự khai đủ, để module của ta là hàng thay thế được) |
| `dsh.client.inject` | 4 gói: `dsh-client-connection` · `dsh-client-ui-renderer` · `dsh-client-ui-settings` · `dsh-api-remotes`, **`immediately: true`** | **y hệt** |
| Id module bundle đăng ký | **1**: `@deepseek-ai/dsh-client-locale` | **1**: `@galaxy-blackhole/gbh-client-locale` |
| Peer | `@deepseek-ai/cordis` (+ `schemastery` cho nửa host) | `@deepseek-ai/cordis` · `@deepseek-ai/schemastery` (bảng §3b) |

## 2. Vì sao là row NỀN (không phải row rẻ)

`row:cost` cho **điểm 13** (3 primitive + 2 khoá từ điển) — nhưng điểm đó đo *công viết lại*, không đo
*hậu quả nếu sai*. Đo từ đồ thị boot: **48 row** phụ thuộc dịch vụ này, và entry của nó là
**`immediately: true`**. Nếu nửa client thiếu một hàm (`bind`/`register`/`getSnapshot`/`setLocale`/
`addLanguage`/`resolveText`), hệ quả là **mọi row UI mất từ điển** — đúng lớp sự cố "UI chết".
⇒ Phép kiểm của row này phải chứng minh **hệ quả trên row khác**, không chỉ chứng minh row chạy.

## 3. Dịch vụ `locale` (bề mặt 48 row đọc)

```ts
getLocale(): LocaleSnapshot           // ĐO ĐƯỢC: trả về BẢN CHỤP (như getSnapshot), không phải id
getSnapshot(): { active, locales, revision }
subscribe(fn): () => void             // listener hỏng không chặn listener khác
setLocale(id): void                   // gói lạ ⇒ 'locale "x" is not registered'
addLanguage({id,label,fallback}): () => void
register(ns, dicts): () => void       // gỡ được; trùng ⇒ 'locale namespace "ns" already has locale "x"'
bind(ns): (key, params?) => string    // tra namespace → common → chính khoá; điền {tên}
resolveText(text): string             // chọn chữ theo chuỗi dự phòng
```

## 4. Đếm id module — và vì sao KHÔNG alias id stock

| Việc | Kết quả đo |
|---|---|
| Số `__ModuleLoader__.load({ id, factory })` trong bundle gốc | **1** |
| Bundle nào `require("@deepseek-ai/dsh-client-locale")`? | **0** (chỉ *dịch vụ* là quan trọng, không có ai require *module*) |
| Kết luận | 1 id module = tên package của ta + `gbh.row.moduleIds` khai tường minh; **không cần alias** |

## 5. Bảng TRƯỚC / SAU

**LAB CÁCH LY CHỈ ĐỔI ROW NÀY** (`bun run lab:row locale` · home `/tmp/gbh-lab-locale` · cổng **5462**):

| Chỉ số | Kết quả |
|---|---|
| Trang `/` | 200 · **49.384 B** |
| Entry · `mode` | 72 · `live` · **có id ta · không còn id stock** |
| `#root` · lỗi console | **89.015 ký tự** · **0 lỗi** |
| Thẻ style của ta · `<html lang>` | có · `en` (chứng minh `syncDocumentLanguage` của ta đã chạy) |
| **HỆ QUẢ TRÊN ROW KHÁC** (điều quan trọng nhất với row nổ 48) | Trang render chữ THẬT của các row khác — "New Session" · "Plugins" · "Automation tasks" · "Workspaces" · "Default workspace" · "More" · "Into the Unknown" · "Preview" · "Standard mode" · "Describe what you want to build, / commands, @ files or sessions" · "Auto" · "Default" — và **0 khoá thô** kiểu `namespace.key` trên `#root`. Vì row stock đã bị TẮT trong lab, MỌI chữ đó phải đi qua dịch vụ `locale` của ta. |

**APP THẬT 5439** (`scripts/restart-host.sh`, 17/10/2026):

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| `check:app` | — | **(1)…(11) ĐẠT**: 49.384 B · 72/72 entry · 0 `did not activate` · **16 gói của ta chạy thật, `gbh-client-locale` đứng đầu** · **`#root` 99.183 · 0 lỗi console** · bố cục 1/80 (1 px có sẵn từ trước, không phải row này) · mount mới nhất 24 file khớp repo · HMR sống |
| Id `__DSH_BOOT__` | 72 entry · có `@deepseek-ai/dsh-client-locale` | 72 entry · **có `@galaxy-blackhole/gbh-client-locale`**, id stock đã biến |
| Bundle | 1.602 dòng (887 là vendor) | 20.309 B client + 1.094 B host |
| Test | — | **5 ca / 84 expect** (A/B tầng dịch vụ với chính bundle gốc) |

## 6. Nhật ký nghiệm thu — còn lại gì

Đã xong đủ trình tự: bật `gbh.row`+`moduleIds` → lab cô lập chỉ đổi row này + kiểm chữ của row khác → `check:rows` sạch → `scripts/restart-host.sh` → `check:app` (1)…(11) ĐẠT → hàng `locale` **đã thay thật**, feature KHÔNG mất.

Còn thiếu duy nhất, nói thẳng: **chưa có ảnh A/B pixel cho riêng dòng Language trong Settings** — mở được màn đó cần một phiên đang chạy để vào Settings, nên phần ảnh thuộc giàn của `tm-ui-features`. Bù lại: CSS đã đối chiếu **từng khai báo** với bản gốc (696 B) và dòng Language render bằng đúng component + đúng primitives như gốc.

Ghi chú kỹ thuật đã đo (đừng đo lại): `getLocale()` của gốc trả **bản chụp** chứ không phải id · tự-trỏ-fallback bị chặn ở phép kiểm "fallback chưa đăng ký" (nhánh *chu trình* là phòng thủ nhiều lớp) · test phải cài `window` KHÔNG qua tham số `new Function("window", …)` (Bun không có `window` toàn cục; truyền tham số làm phép dò trình duyệt đi nhầm nhánh và cả hai bundle cùng chết ở `navigator.languages`) · `@deepseek-ai/schemastery` phải symlink trong chính package (khai ambient là toàn cục, sẽ đè type thật của gói khác — xem lịch sử hồi quy trong báo cáo).

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-locale` (shasum `en 93d6e5273c48...` · `zh be82e59dcf84...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
