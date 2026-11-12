<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bằng chứng task-18: hero brand GBH (gói ui-brand) + lớp vỏ L3 (shell-identity) — số đo TRƯỚC/SAU, lab, sự cố single-slot
-->

# Task-18 — Bằng chứng: hero brand + lớp vỏ (title/favicon/manifest)

Trạng thái: **XONG phần đo** (2 gói + test + 2 lượt lab). Còn chờ Lead gom **một lượt boot** app 5439 để đo
`check:app` (8)(9) trên app thật.

## 0. Sự cố ĐĂNG KÝ TRÙNG SLOT (18/10/2026, 22:12–22:24) — đã sửa

| mục | TRƯỚC (bản đầu của gói ui-brand) | SAU (bản hiện tại) |
|---|---|---|
| slot gói ui-brand đăng ký | `sidebar.brand.mark` + `sidebar.brand.name` + `conversation.hero.brand.mark` | **chỉ** `conversation.hero.brand.mark` |
| lỗi console | 1: `single slot "sidebar.brand.mark" already has a registration at priority 0 (registered by @galaxy-blackhole/gbh-client-ui-brand-official)` | **0** |
| pageError | 1 (reviewer, lượt 22:12–22:24) | **0** |
| sidebar | crash ⇒ `#root` 22.204 (số của reviewer) | lành ⇒ `#root` 163 textContent (metric của lab này) |

**Nguyên nhân**: `sidebar.brand.mark`/`sidebar.brand.name` là slot `single` (một chủ). Row `ui-brand-official`
của ta **đã giữ** hai slot đó; gói mới `ui-brand` đăng ký thêm ⇒ tầng nạp ném lỗi ⇒ sidebar chết.
**Bài học ghi trong mã**: xem JSDoc `SLOT_HERO_MARK` ở `packages/client/ui-brand/src/ids.ts`.

**Rollback**: `package.json` giữ `gbh.row_unmounted_ly_do` (đúng khối `gbh.row` cũ + lý do + trạng thái) và
`gbh.rollback.cachGo` — gỡ bằng cách đổi tên key `row` thành `row_unmounted_ly_do` rồi mount lại, **không cần sửa mã**.

## 1. Hai gói mới

| gói | loại | việc | test |
|---|---|---|---|
| `packages/client/ui-brand` | client, **không thay row stock** (id riêng `ui-brand`, `disabled: false`) | cấp dấu hố đen cho **slot hero** `conversation.hero.brand.mark` (slot duy nhất chưa có chủ; bundle `ui-conversation` chỉ có fallback CÁ) | 6 ca / 24 expect |
| `packages/host/shell-identity` | host, id riêng `shell-identity` | đè `/favicon.svg` + `/favicon-dark.svg` + `/manifest.webmanifest` bằng asset GBH; `tapIndex` đổi `<title>` | 6 ca / 42 expect |

Ràng buộc đã giữ: **không** đổi `require` trong 53 bundle client; **không** chạm bootstrap/module-loader
(artifact `shell-identity/lib/index.js` không chứa `__ModuleLoader__` · `staticModules` · `__DSH_BOOT__`).

## 2. Số đo lab (`tools/lab/row.ts`, home cách ly, cổng 5461)

| chỉ số | Lượt A — VẮNG row `ui-brand` (`lab:row ui-settings-general`) | Lượt B — CÓ row (`lab:row ui-settings-general`) | Lượt C — `lab:row ui-brand` |
|---|---|---|---|
| consoleErrors | **0** | **0** | **0** |
| pageErrors | **0** | **0** | **0** |
| did-not-activate | 0 | 0 | 0 |
| `#root` textContent | 163 | 163 | 163 |
| hero `conversation.hero.brand.mark` | CÁ DSH (`viewBox 0 0 23.16 17.04`, path `M22.9168`) | **hố đen 34×34 (`0 0 128 128`)** | **hố đen 34×34** |
| `fishPathHits` toàn document | 1 | **0** | **0** |
| sidebar mark + name | 128 viewBox + "Galaxy Blackhole" | y hệt | y hệt |
| `<title>` HTTP | "Galaxy Blackhole" | "Galaxy Blackhole" | "Galaxy Blackhole" |
| favicon sha256 | `105ca4ce…` (GBH) | `105ca4ce…` | `105ca4ce…` |
| manifest | `name: Galaxy Blackhole` | y hệt | y hệt |

Ảnh A/B: [brand-before-hero-lab.png](assets/brand-before-hero-lab.png) (lượt A — hero còn cá) ·
[brand-after-sidebar-lab.png](assets/brand-after-sidebar-lab.png) (lượt B) ·
[brand-after-hero-lab.png](assets/brand-after-hero-lab.png) (lượt C — hero hố đen).

## 3. Vì sao chọn đường "route đè + tapIndex" (L3) thay vì ship dist

- Đường A (đã chọn): **3 route đặt tên** thắng fallback tĩnh + **1 tap chuỗi** cho `<title>` ⇒ giữ nguyên dist
  frontend của kernel (không phải build lại vỏ, không lệch bản DSH), rollback = gỡ 1 khối patch.
- Đường B (ship dist riêng): phải build + đồng bộ toàn bộ frontend mỗi lần kernel đổi ⇒ đắt, dễ lệch, không cần thiết
  cho 3 asset.
- Bằng chứng HTTP thật nằm trong `tests/host/shell-identity.test.ts` (3 route 200 + bytes sha256 + POST 405) và
  trong 3 lượt lab ở §2 (fetch favicon/manifest/title từ chính app đang chạy).

## 4. Trạng thái hiện tại (18/10/2026, sau trao đổi với Lead)

- `packages/client/ui-brand/package.json`: **ĐANG GỠ `gbh.row`** (đổi thành `gbh.row_unmounted_ly_do`) theo yêu cầu
  của Lead — vì `ui-renderer` vừa bị rollback (mount renderer làm app suy giảm: `#root` 46.224 · 45 slot ·
  60 console error) nên cần **tách biến** trước khi bật thêm gói mới.
- `packages/host/shell-identity`: `gbh.row` **đang BẬT** (chỉ sửa `<title>`/`favicon`/`manifest`, không chạm slot
  hay module-loader) — đã chứng minh trong 3 lượt lab ở §2.
- Test vẫn phủ cả **hai trạng thái** của row (bật/tạm gỡ): `tests/client/ui-brand.test.ts` ca
  “manifest: id mới KHÔNG thay row stock; trạng thái row (bật/gỡ) + đường rollback đều ghi rõ”.

## 5. Việc còn lại (chờ Lead)

1. Khi Lead boot xác nhận app **lành sau rollback ui-renderer** và có **cửa sổ boot sạch**: bật lại row
   `ui-brand` (đổi key `row_unmounted_ly_do` → `row`), rồi đo lại **2 lượt lab** (ui-settings-general + ui-brand)
   và `check:app` (8)(9) trên app thật — kỳ vọng: 0 pageError · `#root` không nhỏ hơn mốc hiện tại · hero = hố đen.
2. Nếu boot xấu: gỡ theo §0 (rollback) rồi báo lại — không cần sửa mã.
