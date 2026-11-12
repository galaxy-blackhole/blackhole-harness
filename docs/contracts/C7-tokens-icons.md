<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Hop dong C7: token --dsw-* va icon — luat style cua DSH, khong Tailwind/component lib, bo icon GBH qua GbhIcon
-->

# C7 — Token `--dsw-*` + icon

> **Trạng thái: ĐÓNG BĂNG MỘT PHẦN.** Đã đóng băng: nguồn phát token, các luật cấm, và tình trạng hiện tại của repo.
> Danh sách token cụ thể + chỉ số icon thuộc **M5** (khi ta viết UI đầu tiên).

## 1. Phát biểu hợp đồng

1. **Token `--dsw-*` là nguồn giá trị duy nhất.** Plugin `dsh-client-ui-theme` phát ra bộ biến
   (static scale + semantic alias) khi boot; mọi component của ta chỉ đọc token, không tự đặt giá trị.
2. **Style**: CSS Modules + `clsx`. **Cấm Tailwind** và mọi thư viện component (antd, MUI, Chakra, Radix, Bootstrap, styled-components, emotion).
3. **Không màu/số literal** trong component — chỉ token `--dsw-alias-*`.
4. **Icon parity giữ SVG gốc của DSH** — nay **sở hữu bởi GBH** trong `packages/client/ui-primitives`
   (sổ artwork `GBH_ARTWORKS`: 100 artwork tĩnh + 3 động + 2 alias · 189 icon + 12 entry họ tổ hợp).
   Nguồn đối chiếu: `galaxy-vscode-extension/vendor/dsh-client-ui-primitives/lib/index.js` (DSH 0.2.0-rc.2, MIT);
   kiểm version với vỏ đang chạy 0.2.1-alpha.4: **153/153 chuỗi path có mặt byte-identical**.
   `lucide-react` **chỉ** dùng cho UI mới của Blackhole (không tồn tại trong DSH).
5. **Primitive `GbhIcon` ĐÃ CÓ** — `createGbhIcon(jsxRuntime)` / `renderGbhIcon` / `renderGbhArtwork`
   (nhận jsx runtime qua tham số, không import React). Đổi bộ icon = sửa **một** sổ `GBH_ICONS`/`GBH_ARTWORKS`.
6. **Asset thương hiệu DSH bị THAY, không port**: `FishLogo`, `BrandWordmark`, `FISH_LOGO_PATH`,
   `FISH_LOGO_VIEWBOX` → `GBH_LOGO_ARTWORK` (logo hố đen, nguồn `blackhole-desktop-electron/…/brand/logo.svg`,
   sha256 `d7fac4b4…`) + `GBH_WORDMARK_TEXT` ("Galaxy Blackhole"). Không còn path fish/wordmark DSH trong phần ta sở hữu
   (cổng N1 `tools/check/no-dsh-assets.ts`).

## 2. Nguồn chứng minh

| Nguồn | Chi tiết |
|---|---|
| Upstream (gói đã cài) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-theme` — bootstrap bảng màu từ Host, ThemeRuntime sáng/tối, phát token `--dsw-*` |
| Hành vi đo được (17/10/2026) | Entry `@deepseek-ai/dsh-client-ui-theme` có trong đồ thị boot với 6 cạnh inject: `client-connection, client-locale, client-shortcuts, client-ui-renderer, client-ui-settings, api-remotes` |
| Quét repo | 0 thư viện UI bị cấm, 0 khai báo `lucide-react`, 0 file component/style của ta (chưa có UI) |
| Quét runtime | `lucide-react` **không** được cài trong runtime; module `dsh-client-ui-primitives` do **vỏ web** cấp trong `staticModules` (không phải gói npm) |
| Fixture + test | `tests/contract/fixtures/c7-style-icons.json` · `tests/contract/c7-tokens-icons.test.ts` — 4 test + 2 mục `todo` (nay có test thật thay thế, xem §3) |
| Bộ icon GBH | `packages/client/ui-primitives` (registry + `GbhIcon` + asset thương hiệu) — **chưa mount** (không khai `gbh.row`) |
| Cổng asset | `tools/check/no-dsh-assets.ts` — N1 fish/wordmark · N2 chuỗi "DeepSeek Harness" · N3 icon chưa khai · N4 sha256 asset |
| Báo cáo | `docs/reports/asset-inventory-dsh.md` · `docs/reports/icon-mapping-dsh-gbh.md` · `docs/reports/asset-plan.md` |

## 3. Test snapshot tương ứng

| Test | Canh điều gì |
|---|---|
| entry theme trong đồ thị boot | nguồn phát token còn được nạp, cạnh inject không đổi |
| không Tailwind/component lib | quét mọi `package.json` của workspace |
| `lucide-react` chưa được khai | nếu xuất hiện, phải nằm đúng chỗ (UI mới của Blackhole) — hiện chưa có |
| không màu literal | quét `.css/.tsx` trong `ui/, packages/client-ui/, apps/desktop/ui/` |
| ~~2 mục `todo`~~ → **đã thay bằng test thật** | `tests/client/ui-primitives.test.ts` (sổ artwork 1:1 với vỏ + phủ 89/89 icon bundle đang dùng + `GbhIcon` render + sha256 asset thương hiệu) · `tests/check/no-dsh-assets.test.ts` (N1–N4) |

## 4. Điều gì làm hợp đồng VỠ

| Thay đổi | Hậu quả |
|---|---|
| Thêm Tailwind hoặc thư viện component | Lớp style khác cơ chế ⇒ mỗi lần so ảnh phải truy nguyên trong hai hệ CSS; mục tiêu G1 (giống hệt) mất thước đo |
| Đặt màu/kích thước literal trong component | UI mới lệch tông với plugin DSH; đổi theme không ăn |
| Vẽ lại icon DSH theo bộ khác | Icon lệch pixel; parity G1 hỏng dù chức năng đúng |
| Dùng `lucide` cho icon parity | Cùng lý do trên; và mất khả năng đối chiếu về nguồn SVG gốc |
| Bỏ entry theme khỏi cây plugin | Không còn bảng token ⇒ mọi component không có biến để đọc |
| Đổi tên biến `--dsw-*` thành tên khác | Plugin UI của DSH (và theme của ta) không tìm thấy token |

## 5. Việc còn lại

- [x] **Icon GBH sở hữu + 1:1**: `packages/client/ui-primitives` (189 icon + 12 entry họ tổ hợp; 100 artwork tĩnh + 3 động + 2 alias);
      test đối chiếu **153/153** path với vỏ đang chạy. *Chưa mount — xem cảnh báo dưới.*
- [x] **Asset thương hiệu GBH**: logo hố đen + favicon + chữ "Galaxy Blackhole" (sha256 ghi trong `GBH_LOGO_SOURCE_SHA256`/`GBH_FAVICON_SOURCE_SHA256`).
- [x] **Cổng N1–N4**: `tools/check/no-dsh-assets.ts` + `tests/check/no-dsh-assets.test.ts`.
- [ ] **L2 — thay NGUỒN icon runtime**: 53 bundle vẫn `require("@deepseek-ai/dsh-client-ui-primitives")`;
      phải cấp module của ta ở bảng `staticModules` của vỏ/modules TRƯỚC, rồi mới đổi literal trong bundle
      (đổi trước = `require missed the module table` ⇒ app trắng). Kế hoạch: `docs/reports/asset-plan.md` §5.
- [ ] **L3 — title/favicon/manifest**: vỏ vẫn phục vụ `<title>DeepSeek Harness</title>` + favicon cá DSH + manifest "DSH";
      hai đường + nghiệm thu: `docs/reports/shell-identity-plan.md`.
- [ ] **Chuỗi thương hiệu DSH trong nguồn**: **16 file** còn "DeepSeek Harness" (system prompt 3 · web-runtime 1 ·
      shell-env 2 · llm-deepseek-account 2 · subprocess 2 · ui-layout 2 · locale 6 gói) — thuộc chủ các gói đó;
      cổng N2 là **ratchet**: mỗi lần dọn xong phải hạ trần trong `tests/check/no-dsh-assets.test.ts`.
- [ ] **`gate:style`** (màu literal, Tailwind, icon) — hiện đã có phần "không thư viện cấm" trong test C7.
