<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Kiểm kê icon/asset DSH trong UI của ta: nguồn, số đo, đường dẫn, bằng chứng DOM thật (task-9)
-->

# Kiểm kê icon/asset DSH trong UI của ta

> Mục tiêu cuối của dự án: **không còn gì liên quan DSH, kể cả icon/asset**. Tài liệu này là **phép đo**
> (không phải phỏng đoán) về asset DSH còn nằm trong UI đang chạy, kèm đường dẫn + số + ảnh chụp.
> Bảng ánh xạ DSH → GBH: [`icon-mapping-dsh-gbh.md`](icon-mapping-dsh-gbh.md). Kế hoạch + phạm vi: [`asset-plan.md`](asset-plan.md).

## 0. Cách đo (lặp lại được)

| phép đo | lệnh |
|---|---|
| đếm export + icon của module primitives trong vỏ | trích `const zU=Object.freeze(Object.defineProperty({__proto__:…` từ `dsh-web-frontend/dist/assets/index-CN7NIWNw.js` |
| đếm icon tham chiếu trong artifact của ta | quét 53 `packages/client/*/lib/client.js` với 188 tên icon (chuỗi literal) |
| đo DOM thật | Playwright + Chrome (`channel: "chrome"`), mở `~/.galaxy/blackhole/ready-url.txt`, đọc `[data-slot="sidebar.brand.mark"]`… |
| đối chiếu artwork 1:1 | so từng chuỗi `d` của bản đọc được (`vendor/dsh-client-ui-primitives`) với bundle vỏ đang chạy |

## 1. Nguồn asset DSH (đo 18/10/2026)

| # | nguồn | đường dẫn | số đo |
|---|---|---|---|
| 1 | **Module primitives của vỏ web** — id `@deepseek-ai/dsh-client-ui-primitives` do vỏ cấp qua `staticModules`, **không phải gói npm** | `apps/host/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-CN7NIWNw.js` | **288 export** · **188 icon** · 100 primitive/artwork khác |
| 2 | **Fish logo + viewBox** (`FISH_LOGO_PATH`, `FISH_LOGO_VIEWBOX`) + **BrandWordmark** ("deepseek HARNESS") | như trên, hằng `j_`, `Is`, component `hA`/`pA` | path bắt đầu `M22.9168 1.43018…` · viewBox `0 0 23.16 17.04` · wordmark viewBox `26 0 156 24` |
| 3 | **favicon vỏ** (cá DSH) | `…/dsh-web-frontend/dist/favicon.svg`, `favicon-dark.svg` | 3.634 B mỗi file · sha256 `9e983b4f…` / `dde7db78…` |
| 4 | **tiêu đề tài liệu** | `…/dist/index.html` | `<title>DeepSeek Harness</title>` |
| 5 | **PWA manifest** | `…/dist/manifest.webmanifest` | `name: "DeepSeek Harness"`, `short_name: "DSH"`, icon = `favicon.svg` |
| 6 | **bundle gốc** của row brand/sidebar (chứa FishLogo dự phòng) | `…/@deepseek-ai/dsh-client-ui-brand-official/lib/client.js` · `…/dsh-client-ui-sidebar/lib/client.js` | 47 dòng/1.863 B · 535 dòng/31.998 B |
| 7 | **nguồn ĐỌC ĐƯỢC để đối chiếu artwork** (bản 0.2.0-rc.2, vendor chỉ đọc) | `galaxy-blackhole/galaxy-vscode-extension/vendor/dsh-client-ui-primitives/lib/index.js` | 12.382 dòng/530.719 B · **189 icon export** · **94 artwork** |
| 8 | gói `dsh-brand` (types thương hiệu, không phải UI) | `apps/host/node_modules/@deepseek-ai/dsh-brand/` | 32 dòng `lib/index.js` — không có asset |

### 1b. Kiểm version: bản đọc được (0.2.0-rc.2) có khớp vỏ đang chạy (0.2.1-alpha.4)?

| phép kiểm | kết quả |
|---|---|
| chuỗi path `d` (≥ 30 ký tự) của 94 artwork có mặt trong bundle vỏ | **153/153 = 100%** |
| tên icon export có mặt trong bundle vỏ | **188/189** (thiếu đúng `IconPlanOutlineArtwork` — đó là tên *artwork*, không phải export) |

⇒ Nguồn đọc được ở #7 dùng được làm **nguồn chuẩn 1:1** cho artwork, không phải đoán từ bundle minify.

## 2. Tham chiếu trong repo ta

### 2.1 Nửa client — require module primitives của DSH (artifact `lib/client.js`)

| chỉ số | số đo | cách đo |
|---|---|---|
| bundle client có `require("@deepseek-ai/dsh-client-ui-primitives")` | **53** lúc khảo sát · **54** lúc 21:30 (số sống) | `grep -l` trên `packages/client/*/lib/client.js` |
| icon khác nhau được tham chiếu | **89** lúc khảo sát · **92** lúc 21:30 | so 188 tên icon với nội dung bundle |
| cặp icon × gói | **216** lúc khảo sát · **221** lúc 21:30 | cùng phép quét |
| gói dùng icon | **31** lúc khảo sát · **32** lúc 21:30 | cùng phép quét |

> Con số **là số SỐNG**: teammate đang thêm icon (ui-theme vừa thêm 3 biến thể `Medium`: dark/light/followsystem).
> Bất biến của ta không phải "89" mà là **mọi tên icon tham chiếu đều nằm trong sổ GBH** (test ratchet `>= 89`).
| primitive thương hiệu/artwork dùng | **14** | xem bảng dưới |

**14 primitive thương hiệu/artwork** (không phải icon thường):

| primitive DSH | gói của ta | ghi chú |
|---|---|---|
| `FishLogo` | ui-sidebar, ui-brand-official | **logo cá DSH đang render thật** (xem §3) |
| `BrandWordmark` | ui-brand-official | **"deepseek HARNESS" đang render thật** |
| `FISH_LOGO_PATH`, `FISH_LOGO_VIEWBOX` | ui-conversation | hero fish + SMIL swim animation (`parts/82-client-skeleton-EmptyHero.ts:76-85`) |
| `SHIELD_OUTLINE_PATH` | ui-sidebar-browser | nền khiên cho icon tổng hợp |
| `FileTypeIcon` | 8 gói (ui-chat, ui-conversation, ui-deliverables, ui-plan, ui-sidebar-documentpreview, ui-sidebar-files, ui-settings-account, ui-trajectory) | glyph theo loại tệp |
| `ReferenceIconRegular` | ui-chat, ui-conversation, ui-schedule | glyph @file/@session |
| `PermissionIconReadOnlyRegular` | ui-permission | glyph chế độ quyền |
| `PluginArtworkDefault` | ui-plugin-market | artwork plugin |
| `PluginArtworkTerminal` | ui-sidebar-terminal | artwork terminal |
| `GuideArtworkBrowser` | ui-sidebar-browser | artwork hướng dẫn |
| `GuideArtworkFiles` | ui-sidebar-files | artwork hướng dẫn |

**Top icon dùng nhiều gói nhất**: `IconChevronDownOutlineRegular` 17 gói · `IconWarningOutlineRegular` 9 ·
`IconChevronRightOutlineRegular` 9 · `IconCloseOutlineRegular` 8 · `IconCheckOutlineRegular` 8 ·
`IconSearchOutlineRegular` 7. Danh sách đủ 89 dòng: [`icon-mapping-dsh-gbh.md` §4](icon-mapping-dsh-gbh.md).

### 2.2 SVG viết cứng trong `src/` của ta

| chỉ số | số đo |
|---|---|
| file `packages/*/*/src/**` có `viewBox` | **25 file** |
| tổng số lần `viewBox` | **34** |
| file chứa **artwork thương hiệu DSH** (fish path `M22.9168` hoặc wordmark `M68.416 18.2447`) | **0** |

⇒ Artwork viết cứng trong src của ta là **glyph chung** (chevron, caret, calendar, terminal…), **không phải**
asset thương hiệu DSH. Nguồn thương hiệu duy nhất còn lại là **module primitives của vỏ** (mục 1).

### 2.3 Nửa vỏ (host) — title/favicon/manifest không nằm trong client bundle

| hạng mục | số đo |
|---|---|
| gói của ta vẫn `import * as FrontendStatic from "@deepseek-ai/dsh-host-frontend-static"` | 1 (`packages/host/web-runtime/src/index.ts:13`) |
| `dist/index.html` phục vụ | lấy từ `@deepseek-ai/dsh-web-frontend` (`packages/host/web-runtime/src/dist.ts:13`) |
| đường sửa **không cần thay dist** (đã có trong repo) | `webServer.tapIndex(transform)` + route đặt tên đè fallback (`packages/host/webserver/src/index.ts:448`, `renderIndexInjections`) |

## 3. Đo trên DOM thật — TRƯỚC (app 5439, 18/10/2026 20:45)

Mở `ready-url.txt` bằng Playwright + Chrome, chờ 9 s, đọc đúng các slot đang render:

| slot | markup đo được | kết luận |
|---|---|---|
| `sidebar.brand.mark` | `<svg width="24" height="17.658…" viewBox="0 0 23.16 17.04"><path d="M22.9168 1.43018…">` | = `FISH_LOGO_PATH` của DSH |
| `sidebar.brand.name` | `<svg width="156" height="24" viewBox="26 0 156 24">` | = `BrandWordmark` — chữ **"deepseek HARNESS"** |
| `conversation.hero.brand.mark` | `<svg class="pXSMma_fish" … viewBox="0 0 23.16 17.04">` | = fish DSH trong hero |

| chỉ số trang | TRƯỚC |
|---|---|
| số lần fish path `M22.9168` trong HTML tài liệu | **2** |
| `#root` ký tự | **67.167** |
| lỗi console | **0** |
| `<svg>` trong #root / path `d` khác nhau | **42 / 65** |
| `<img>` (logo raster) trong #root | **0** |

Ảnh bằng chứng (chụp phần tử, scale 3×): [brand-before-row.png](assets/brand-before-row.png) ·
[brand-before-name.png](assets/brand-before-name.png) · [brand-before-hero.png](assets/brand-before-hero.png) ·
markup gốc: [brand-before-slots.json](assets/brand-before-slots.json).

### 3b. Đo trên lab cách ly — SAU khi đổi brand (18/10/2026, `lab:row ui-brand-official`)

Lab dùng home + cổng riêng (5460), KHÔNG đụng app 5439; probe Playwright `channel: "chrome"`:

| slot | TRƯỚC (app 5439) | SAU (lab, bundle mới) |
|---|---|---|
| `sidebar.brand.mark` | `<svg viewBox="0 0 23.16 17.04">` = **cá DSH** | `<svg width="24" height="24" viewBox="0 0 128 128">` = **logo hố đen GBH** (gradient id `gbh1ring`/`gbh1arc`) |
| `sidebar.brand.name` | `<svg viewBox="26 0 156 24">` = **"deepseek HARNESS"** | `<span …>Galaxy Blackhole</span>` |
| `conversation.hero.brand.mark` | cá DSH (`pXSMma_fish`) | **vẫn cá DSH** — fallback trong `ui-conversation`, **không thuộc row brand** (xem ghi chú dưới) |

| chỉ số | TRƯỚC | SAU |
|---|---|---|
| số lần fish path `M22.9168` trong HTML tài liệu | **2** | **1** (chỉ còn hero) |
| `#root` textContent (cùng trang, cùng phép đo) | — (app có workspace/session nên khác trạng thái) | **163** ký tự khi có brand · **147** khi bỏ 2 slot brand ⇒ brand **+16 ký tự**, **KHÔNG nhỏ đi** |
| lỗi console | 0 | **0** |
| did-not-activate | 0 | **0** |
| overlay phủ màn hình | 0 | **0** |
| `<img>` trong #root | 0 | 0 |

Ảnh: [brand-after-row.png](assets/brand-after-row.png) · [brand-after-mark.png](assets/brand-after-mark.png) ·
markup: [brand-after-slots.json](assets/brand-after-slots.json) · probe thô: [lab-after-probe.json](assets/lab-after-probe.json).

> **Ghi chú hero**: `conversation.hero.brand.mark` là slot `single/root` do `ui-conversation` (bản de-bundle nguyên văn)
> giữ fallback cá DSH; **không** đăng ký thêm occupant trong row `ui-brand-official` được vì sẽ **thừa slot** so với
> bundle gốc (vi phạm parity B của recipe). Oracle A giải bài này bằng **gói brand riêng** (`@galaxy-stack/gbh-brand`
> đăng ký cả 3 slot) — ta sẽ làm tương tự ở pha sau (`@galaxy-blackhole/gbh-brand`); ghi ở [asset-plan.md](asset-plan.md) §3b.

> **Đối chiếu oracle A** (blackhole web 4001): brand là **logo hố đen Galaxy** (`galaxy-code/web/brand/logo.svg`)
> + chữ "Galaxy Blackhole" (component `GbhBrandMark`/`GbhBrandName` trong `galaxy-code/web/brand/lib/client.js`).
> Vì vậy app của ta **đang lệch oracle đúng ở vùng brand** — khớp với ghi chú "(9) lệch `brandIdenti`/`brandMark`"
> trong `docs/HANDOVER.md`.

## 4. Ba lớp asset DSH phải xử lý

| lớp | nội dung | phạm vi sửa | rủi ro |
|---|---|---|---|
| **L1 — brand nhìn thấy** | fish logo + wordmark "deepseek HARNESS" (2 slot sidebar; hero là fallback của ui-conversation) | `packages/client/ui-brand-official` (2 slot giữ nguyên) | thấp — **đây là thứ đang lệch oracle** |
| **L2 — bộ icon runtime** | 89 icon × 31 gói lấy từ module primitives của vỏ | cần **module thay thế trong bảng module của vỏ** (không thể sửa bằng 1 package client) | cao — chạm hợp đồng C1/C2 |
| **L3 — vỏ tài liệu** | `<title>DeepSeek Harness</title>`, favicon.svg/favicon-dark.svg, manifest "DSH" | host: `tapIndex` hoặc route đè `/favicon.svg`; triệt để cần **dist frontend của ta** | trung bình — không đổi bố cục |

## 5. Việc còn lại (cần Lead chốt phạm vi)

1. **L1**: đổi `ui-brand-official` sang `GbhIcon`/`GbhWordmark` (bộ GBH) — cần ảnh A/B + đo lại 3 số, và cần mở
   vùng ghi `tests/client/ui-brand-official.test.ts` để cập nhật test.
2. **L2**: dựng `packages/client/ui-primitives` (registry 89 icon đang dùng + `GbhIcon`) — chưa mount, không đổi UI;
   muốn **thay thật** phải có quyết định kiến trúc về bảng module của vỏ.
3. **L3**: chủ sở hữu host (`packages/host/web-runtime` hoặc gói mới) thay title/favicon/manifest.
4. **Cổng kiểm**: script `tools/check/no-dsh-assets.ts` quét asset (fish path, wordmark, "DeepSeek Harness", favicon DSH)
   trong repo ta — cần mở vùng ghi `tools/check/`.
5. **C7**: mở `tests/contract/c7-tokens-icons.test.ts` để thay 2 mục `todo` bằng phép kiểm thật (icon GBH + nguồn artwork).
