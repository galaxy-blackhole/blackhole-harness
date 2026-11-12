<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguon goc tung asset trong goi ui-primitives + sha256 + ly do duoc phep giu hinh (C7 P1, G4)
-->

# Nguồn gốc asset — `@galaxy-blackhole/gbh-client-ui-primitives`

> Mọi asset trong gói này **truy được về nguồn** (G4) và **không còn asset thương hiệu DSH**.
> Bộ icon giữ **nguyên hình** của DSH theo C7 §1.4 (icon parity), nhưng **chủ sở hữu là GBH**.

## 1. Asset thương hiệu Galaxy Blackhole (thay asset DSH)

| file | nguồn | sha256 | ghi chú |
|---|---|---|---|
| `assets/gbh-logo.svg` | `galaxy-blackhole/blackhole-desktop-electron/host/cli/web/brand/logo.svg` | `d7fac4b4c9d2b4b876e0e354a6d650cea2249dddb84247179e94b58e564333d9` | bản sao **byte-identical**; bản trong `galaxy-code/web/brand/logo.svg` (oracle A) **cùng sha256** |
| `assets/gbh-favicon.svg` | `…/blackhole-desktop-electron/host/cli/web/brand/favicon.svg` | `105ca4ce73ac1dc8707715b700dd16113fb6b8e7fa39af9251d3ca44749c4fc3` | byte-identical, dùng cho lớp vỏ L3 sau này |

Hai file này là **asset**, không phải component: màu/gradient nằm trong asset (C7 P4), component chỉ đọc.

## 2. Bộ icon (`src/artwork-part-*.ts`, `src/artwork-dynamic.ts`)

| hạng mục | giá trị |
|---|---|
| nguồn đọc được | `galaxy-blackhole/galaxy-vscode-extension/vendor/dsh-client-ui-primitives/lib/index.js` — **DSH 0.2.0-rc.2, MIT** |
| kiểm version với vỏ đang chạy (0.2.1-alpha.4) | **153/153 chuỗi path `d` (≥30 ký tự) có mặt byte-identical**; 188/189 tên icon export có mặt |
| cách sinh | trích cây JSX của 100 artwork tĩnh + port tay 3 artwork động (mask + số học theo `strokeWidth`) |
| giấy phép | MIT (xem `vendor/dsh-client-ui-primitives/LICENSE`); giữ hình theo C7 §1.4 nên **pixel-parity không đổi** |
| tên icon | `GBH_ICONS` dùng tên GBH (kebab-case); bảng `DSH_TO_GBH_ICON` giữ ánh xạ 1-1 với tên DSH cũ |

## 3. Cố ý KHÔNG port ở pha này (ghi để không hiểu là thiếu sót)

| asset DSH | lý do |
|---|---|
| `FishLogo`, `BrandWordmark`, `FISH_LOGO_PATH`, `FISH_LOGO_VIEWBOX` | **asset thương hiệu DSH — bị THAY, không port** (dùng `GBH_LOGO_ARTWORK`/`GBH_WORDMARK_TEXT`) |
| `FileTypeIcon` / `CodeFileIcon` / `SiteGlyph` | là **hành vi** (phân loại loại tệp, bảng artwork 20×20, bảng host→site) chứ không phải một icon — thuộc pha thay module primitives (L2) |
| `PermissionIconAutoReview*` | **không có trong bản 0.2.0-rc.2** đã vendor (bản chạy 0.2.1-alpha.4 mới có) ⇒ phải trích từ vỏ khi làm L2 |
| `GuideArtworkBrowser`/`GuideArtworkFiles` | **đã port** (khai báo dạng `function` nên vòng trích đầu bỏ sót — đã bắt được ở vòng 2) |
