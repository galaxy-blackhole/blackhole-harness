<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Kế hoạch chuyển icon/asset DSH → GBH theo 3 lớp L1/L2/L3: phạm vi, điều kiện nghiệm thu, việc cần Lead chốt (task-9)
-->

# Kế hoạch chuyển icon/asset DSH → Galaxy Blackhole

> Số đo nguồn: [`asset-inventory-dsh.md`](asset-inventory-dsh.md) · bảng ánh xạ: [`icon-mapping-dsh-gbh.md`](icon-mapping-dsh-gbh.md).
> **Chưa đổi icon nào đang chạy trong tài liệu này** — đây là kế hoạch + phạm vi chờ Lead chốt.

## 0. Lead đã chốt (18/10/2026) — trạng thái thực hiện

| # | quyết định | trạng thái |
|---|---|---|
| D1 | dựng `packages/client/ui-primitives` (registry + `GbhIcon` + asset thương hiệu + test), **KHÔNG** khai `gbh.row`, **KHÔNG** mount | **XONG** — 201 entry (189 icon + 12 họ tổ hợp) · 103 artwork (100 tĩnh + 3 động + 2 alias) · 13 test pass |
| D2 | đổi brand hiển thị trong `ui-brand-official` (giữ nguyên 2 slot + số lượng) | **XONG** — 8 test pass · `accept-row`: test 0 fail · `chan=0` · lab 0 lỗi console · 0 did-not-activate · `#root` 24.602 ký tự (xem §3b) |
| D3 | mở vùng ghi `tests/client/ui-brand-official.test.ts` + `tests/client/ui-primitives.test.ts` | **XONG** — 8 + 13 ca pass |
| D4 | mở `tests/contract/c7-tokens-icons.test.ts` + fixture; cập nhật `docs/contracts/C7-tokens-icons.md` nếu đổi phát biểu | **XONG** — C7 đã cập nhật §1.4–1.6/§2/§3/§5 (2 mục `todo` được thay bằng test thật ở `tests/client/ui-primitives.test.ts` + `tests/check/no-dsh-assets.test.ts`) |
| D5 | thêm **duy nhất** `tools/check/no-dsh-assets.ts` (N1–N4) + test; không sửa file khác trong `tools/check/`; báo `tm-evidence` | **XONG** — script + `tests/check/no-dsh-assets.test.ts` 9 ca pass; đã báo `tm-evidence` |
| D6 | **chưa** làm L3; viết `docs/reports/shell-identity-plan.md` (2 đường, rủi ro, nghiệm thu) | **XONG** — `docs/reports/shell-identity-plan.md` (89 dòng) |
| D7 | **KHÔNG** đổi require trong 53 bundle; cung cấp module + test; việc thay bảng `staticModules` do chủ `packages/client/modules` + shell làm ở wave sau | **GHI RÀNG BUỘC** — xem §5 (pha 4) |

## 1. Trạng thái & phạm vi đã đo

| lớp | nội dung | đổi hình? | ảnh hưởng UI đang chạy |
|---|---|---|---|
| **L1** | brand nhìn thấy: fish logo + wordmark "deepseek HARNESS" (2 slot sidebar) | **CÓ** (cá → hố đen) | **CÓ** — đây chính là chỗ đang lệch oracle A |
| **L2** | 89 icon × 31 gói lấy từ module primitives của DSH | KHÔNG (parity giữ hình) | không, nếu thay đúng 1:1 |
| **L3** | `<title>DeepSeek Harness</title>`, favicon DSH, manifest "DSH" | **CÓ** (chrome trình duyệt) | không đổi bố cục |

## 2. Pha 1 — gói `packages/client/ui-primitives` (bộ icon GBH + `GbhIcon`) — KHÔNG mount

**Mục tiêu**: có **một chỗ duy nhất** định nghĩa bộ icon GBH (C7 §1.5) và chứng minh 1:1 với DSH.

| việc | chi tiết |
|---|---|
| registry | 89 icon **đang dùng** (100% icon mà 53 bundle tham chiếu) + 14 primitive bảng A; mỗi entry: `name`, `viewBox`, `defaultSize`, `strokeWidth`, cây node SVG 1:1 |
| `GbhIcon` | `renderGbhIcon(runtime, name, props)` (hàm thuần, test được không cần React) + `createGbhIcon(runtime)` trả component; `currentColor`; `aria-hidden` |
| brand | `GBH_LOGO_VIEWBOX`/`GBH_LOGO_PATHS` (từ `logo.svg`, ghi sha256 nguồn) + `createGbhWordmark` (chữ) |
| bảng tra cũ | `DSH_TO_GBH_ICON: Record<DSH name, GBH name>` — để 53 gói đổi bằng một phép tra, không phải nhớ tên |
| nguồn gốc | mỗi file registry ghi JSDoc: `vendor/dsh-client-ui-primitives/lib/index.js` + artwork component name (G4) |
| mount | **KHÔNG khai `gbh.row`, KHÔNG có entry trong `--dump-config`** ⇒ không đổi UI, không đổi cây plugin |

**Nghiệm thu pha 1**

```bash
bun test tests/client/ui-primitives.test.ts      # 100% pass
bun run gate --no-tests                          # 7/7 XANH
bun run apps/cli/src/main.ts host --dump-config  # số entry KHÔNG đổi (gói chưa mount)
```

**Vì sao chưa mount**: bảng module của vỏ (`staticModules`) mới là nơi cấp id `@deepseek-ai/dsh-client-ui-primitives`;
53 bundle đang `require` đúng id đó. Thay module = **việc của shell/modules** (pha 4), không phải của một gói client.

## 3. Pha 2 — đổi brand trong `packages/client/ui-brand-official` (L1) — CẦN LEAD DUYỆT

**Thay đổi**: 2 slot **giữ nguyên tên + số lượng** (parity B của recipe vẫn đạt), chỉ đổi **nội dung**:

| slot | TRƯỚC | SAU |
|---|---|---|
| `sidebar.brand.mark` | `primitives.FishLogo` (cá DSH) | `GbhIcon name="gbh-logo"` (hố đen GBH) |
| `sidebar.brand.name` | `primitives.BrandWordmark` ("deepseek HARNESS") | `GbhWordmark` ("Galaxy Blackhole") |

**Bằng chứng TRƯỚC (đã đo, 18/10/2026)**: fish path hits **2**, `#root` **67.167** (innerHTML, app 5439),
console **0**, ảnh `assets/brand-before-row.png`.

**KẾT QUẢ ĐO SAU (lab cách ly cổng 5460, 21:16 18/10/2026)** — `accept-row`: **DAT**
(test 8 pass/0 fail · `chan=0` · 0 lỗi console · 0 did-not-activate · 0 overlay):
`sidebar.brand.mark` → `<svg viewBox="0 0 128 128">` logo hố đen · `sidebar.brand.name` → `<span>Galaxy Blackhole</span>` ·
fish path hits **2 → 1** (còn hero, xem §3b) · `#root` textContent **147 → 163** (brand +16 ký tự, KHÔNG nhỏ đi) ·
console **0 → 0**. Ảnh A/B: `assets/brand-before-row.png` → `assets/brand-after-row.png`.

### 3b. Vì sao hero vẫn còn cá DSH (không phải thiếu sót của pha 2)

`conversation.hero.brand.mark` là slot `single/root`; fallback cá nằm trong **bundle nguyên văn** của `ui-conversation`
(`src/parts/82-client-skeleton-EmptyHero.ts:116-119`). Row `ui-brand-official` **chỉ được có đúng 2 slot** như bundle gốc
(recipe B) ⇒ **không** đăng ký thêm hero ở đây. Oracle A làm bằng **gói brand riêng** (`@galaxy-stack/gbh-brand`
đăng ký `sidebar.brand.mark`, `sidebar.brand.name`, `conversation.hero.brand.mark`); ta làm tương tự ở pha sau:
gói `@galaxy-blackhole/gbh-brand` (không phải row) — cần Lead mở vùng ghi `packages/client/ui-brand`.

**Nghiệm thu pha 2 (bắt buộc đủ)**

```bash
bun test tests/client/ui-brand-official.test.ts        # cập nhật kỳ vọng: KHÔNG còn require primitives DSH
bun run check:rows | grep ui-brand-official            # 0 dòng chan
bun run lab:row ui-brand-official                      # 0 lỗi console · 0 "did not activate"
bun run gate --no-tests                                # 7/7 XANH
# probe DOM thật (Playwright, channel chrome): fish hits 2 → 0 ở 2 slot sidebar;
#   #root KHÔNG NHỎ HƠN 67.167; 0 lỗi console; ảnh AFTER cho brand mark/name
```

**Rủi ro & cách chặn**: (a) nếu đăng ký ném giữa đường ⇒ cờ idempotent phải bật SAU khi đăng ký xong (đã có);
(b) logo GBH **vuông** nên `height = size` (fish cao = size×17.04/23.16) — nếu copy tỉ lệ cũ sẽ méo;
(c) chỉ đổi **nội dung 2 slot**, không thêm slot thứ 3 (thêm slot hero sẽ vi phạm parity B của row).

## 4. Pha 3 — vỏ tài liệu: title / favicon / manifest (L3) — CẦN CHỦ SỞ HỮU HOST

Ba đường, ưu tiên từ rẻ tới triệt để:

| # | cách | đổi được gì | hạn chế |
|---|---|---|---|
| 3a | `webServer.tapIndex(html => …)` từ một plugin host của ta | `<title>`, 2 `<link rel="icon">`, `manifest` — **đổi ngay trong HTML phục vụ** | không đổi file dist trên đĩa |
| 3b | route đặt tên `/favicon.svg`, `/favicon-dark.svg`, `/manifest.webmanifest` (route thắng fallback) | trả asset GBH cho trình duyệt | vẫn còn file DSH trong dist |
| 3c | **dist frontend của ta** (`@galaxy-blackhole/gbh-web-frontend`) | xoá hẳn asset DSH khỏi đĩa | là gói lớn (thuộc M-wave frontend) |

**Đề nghị**: làm 3a+3b trong một gói host nhỏ (chủ sở hữu: Lead chỉ định), 3c để sau.
Nghiệm thu: `curl -sL -c/-b` trang chủ thấy `<title>Galaxy Blackhole</title>`, `/favicon.svg` trả GBH,
`/manifest.webmanifest` name GBH; 0 tham chiếu "DeepSeek Harness"/"DSH".

## 5. Pha 4 — thay **nguồn** bộ icon runtime (L2) — CẦN QUYẾT ĐỊNH KIẾN TRÚC

Hiện 53 bundle `require("@deepseek-ai/dsh-client-ui-primitives")`; id này do **vỏ** cấp trong `staticModules`
(`packages/client/modules/src/client/system.ts:246` — `this.seed = new Map(Object.entries(options.staticModules))`).

| bước | nội dung | ai làm |
|---|---|---|
| 4a | Vỏ/modules cấp **cùng khoá** `@deepseek-ai/dsh-client-ui-primitives` nhưng value là **module của ta** (bơm từ `ui-primitives`) | chủ `packages/client/modules` + shell |
| 4b | Đo lại 3 số + đối chiếu DOM (`#root`, số svg/path, 0 lỗi console) + ảnh A/B | người đo (task-7) |
| 4c | Sau khi 4b xanh: đổi literal trong 53 `build.ts` sang `@galaxy-blackhole/gbh-client-ui-primitives` (alias ngược cho plugin ngoài) | từng chủ gói, theo write scope |

**Vì sao phải 4a trước 4c**: đổi tên require trong bundle trước khi có module thay thế ⇒
`require("…") missed the module table` ⇒ slot rỗng ⇒ **React #130 / app trắng**.

## 6. Pha 5 — cổng kiểm "không còn tham chiếu DSH trong asset"

Script `tools/check/no-dsh-assets.ts` (đề nghị mở vùng ghi `tools/check/`), 4 luật:

| luật | phép kiểm | ngưỡng |
|---|---|---|
| N1 | không có **fish path** `M22.9168` / **wordmark** `M68.416 18.2447` trong file nguồn của ta | 0 |
| N2 | không có chuỗi thương hiệu `DeepSeek Harness` / `DSH` trong asset/HTML ta phục vụ | 0 (trừ tài liệu lịch sử có chú thích) |
| N3 | mọi tên icon trong `src/**` + `lib/client.js` phải có trong registry GBH **hoặc** trong allowlist "stock chưa chuyển" kèm gói | 0 tên lạ |
| N4 | asset thương hiệu trong repo ta phải truy được về nguồn GBH (sha256 ghi trong JSDoc) | 100% |

## 7. Việc cần Lead chốt (chặn tiến độ)

| # | cần chốt | mặc định tôi đề nghị |
|---|---|---|
| D1 | Mở vùng ghi `packages/client/ui-primitives` (đã có trong `writeScopes` của task-9) | **đồng ý** — pha 1 |
| D2 | Cho phép **đổi brand hiển thị** (pha 2) — cá DSH → hố đen GBH | **đồng ý** — đây là chỗ đang lệch oracle A |
| D3 | Mở vùng ghi `tests/client/ui-brand-official.test.ts` + `tests/client/ui-primitives.test.ts` (cập nhật/thêm test) | đồng ý |
| D4 | Mở vùng ghi `tests/contract/c7-tokens-icons.test.ts` (+ fixture) | đồng ý — thay 2 `todo` |
| D5 | Mở vùng ghi `tools/check/` cho script N1–N4 | đồng ý |
| D6 | Chủ sở hữu pha 3 (title/favicon/manifest) | giao `tm-host-core` hoặc mở gói `packages/host/shell-identity` cho tôi |
| D7 | Pha 4a (bảng module) ai làm + khi nào | chủ `modules`/shell; tôi cung cấp module + test |

## 8. Đề nghị ký (khi xong pha 1+2)

```
row: ui-brand-official
package gốc DSH : @deepseek-ai/dsh-client-ui-brand-official (47 dòng bundle)
package GBH     : @galaxy-blackhole/gbh-client-ui-brand-official
test            : tests/client/ui-brand-official.test.ts (N pass) + tests/client/ui-primitives.test.ts (M pass)
đo DOM          : fish hits 2 → 0 (2 slot sidebar) · #root 67.167 → ≥67.167 · console 0 → 0
lab             : bun run lab:row ui-brand-official = 0 lỗi console · 0 did-not-activate
gate            : bun run gate --no-tests = 7/7 XANH
đề nghị          : Lead cập nhật ma trận + nhờ reviewer ký độc lập
```
