<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row shortcuts cua DSH (M5 — row NEN: 10 row phu thuoc)
-->

# @galaxy-blackhole/gbh-client-shortcuts

Bản viết lại của row **`shortcuts`** — **sổ lệnh bàn phím của app**: đăng ký lệnh, chuẩn hoá và kiểm tổ hợp
phím vật lý, định tuyến phím DOM + phím native (Desktop), lưu tuỳ chọn theo revision. Row **HAI MẶT**: nửa
host nhúng cấu hình vào trang, nửa browser phơi **service `shortcuts`** cho 10 row khác; phần protocol còn
phơi thành **gốc chung `./protocol`** để tầng Node/Desktop dùng cùng.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `shortcuts` (điểm chi phí 8, **bán kính nổ 10**) | `@galaxy-blackhole/gbh-client-shortcuts` |
| Package | `@deepseek-ai/dsh-client-shortcuts` `0.2.1-alpha.4` | `@galaxy-blackhole/gbh-client-shortcuts` `0.1.0` |
| File gốc đã đọc (CHỈ ĐỌC) | `…/dsh-client-shortcuts/lib/{index.js,protocol.js,client.js}` + `lib/types/**` | `packages/client/shortcuts/{build.ts,src/**,src/client/**}` |
| Kích thước | **3.179 dòng JS** (client 2.632 · protocol 524 · host 23) — trong đó **1.522 dòng là THƯ VIỆN nhúng** (util-values 635 · schemastery 633 · cosmokit 254) ⇒ code thật ≈ **1.150 dòng** | **2.311 dòng TS** (src 2.212 + build 99) + **1.069 dòng test** |
| Hai mặt? | **CÓ** — nửa host nhúng `__DSH_SHORTCUTS_CONFIG__` vào trang | đủ hai nửa trong MỘT package |
| **Ba đầu ra build** | `lib/index.js` (host ESM) · `lib/protocol.js` (`exports["./protocol"]`) · `lib/client.js` | **y hệt**: host **874 B** · protocol **17.186 B** · client **39.833 B** (IIFE) |
| Export nửa HOST | `Config` (schema schemastery) · `apply(ctx, config)` | **y hệt** (builder tự chặn nếu thiếu) |
| Bề mặt nửa CLIENT | **export LỚP SERVICE** (`module.exports = ShortcutsService`), không phải `{apply,inject}` | **y hệt** (factory trả lớp service, Loader tự `ctx.plugin(...)`) |
| `dsh.client.inject` | 1 gói: `@deepseek-ai/dsh-client-locale` (row nền tôi đã viết lại trước đó) | **y hệt** |
| Service phơi cho row khác | `shortcuts` (cordis Service, `static inject = ["locale"]`) | **y hệt** |
| Id module bundle | **1** | **1** = tên package ta + `gbh.row.moduleIds` |
| Peer | `@deepseek-ai/cordis` (+ `schemastery` cho nửa host) | `@deepseek-ai/cordis` · `@deepseek-ai/schemastery` (§3b). `Branded` của `dsh-brand` thay bằng kiểu branded cục bộ — chỉ là kiểu, không có mã chạy |

## 2. Vì sao là row NỀN

**10 row** inject service này: `ui-open-in-app` · `ui-theme` · `ui-shortcuts` · `ui-layout` · `ui-sidebar` ·
`ui-sidebar-right` · `ui-sidebar-terminal` · `ui-sidebar-files` · `ui-settings-general` · `ui-workspace`.
Chúng gọi `register` · `registerFixed` · `observeFixedInput` · `describeBinding` · `edit` và đọc
`catalog`/`config`/`fixedCatalog`. Sai ở đây ⇒ **mọi phím tắt của app** hỏng, kèm lỗi
`Duplicate shortcut command` khi hai row đăng ký trùng.

## 3. Cách kiểm của row này (nổ 10 ⇒ phải chứng minh HỆ QUẢ)

- **Tầng protocol — A/B với chính `lib/protocol.js` gốc** (file ESM độc lập, import thẳng trong Bun):
  6 ca · **2.603 expect**: 15 hàm, ma trận 29 mã phím × 13 bộ phím bổ trợ × 3 thiết bị × 2 vỏ · mọi nhánh
  `invalid`/`future` của tài liệu tuỳ chọn · giải xung đột · `parseShortcutEdit` · `ShortcutPersistence`
  (saved/stale/not-ready/conflict/read-fail/write-fail + **nội dung ghi từng byte**).
- **Tầng dịch vụ — A/B với chính bundle gốc trong cùng một "gia" giả** (DOM/window/localStorage/cầu Desktop
  là stub **hẹp đúng bằng** những gì bundle gốc đụng tới): 6 ca. Ca 2 là **phép chứng minh hệ quả**: một
  "row phụ thuộc" đăng ký lệnh rồi **bấm phím qua chính adapter DOM** (Web) và **qua kênh native** (Desktop)
  — hai bên chạy/bỏ qua/tiêu thụ phím y hệt nhau, và lệnh THẬT SỰ chạy.
- **Lab cô lập chỉ đổi row này** (5463) — xem mục 5.

## 4. Đếm id module — và vì sao KHÔNG alias id stock

| Việc | Kết quả đo |
|---|---|
| Số `__ModuleLoader__.load({ id, factory })` trong bundle gốc | **1** |
| "525 dòng chunk lazy" trong `row:cost` là gì? | Không phải chunk tải lười: đó là **`lib/protocol.js` (524 dòng)** — **entry riêng** phơi qua `exports["./protocol"]` cho tầng Node/Desktop. Bundle browser vẫn 1 file, 1 `load()` |
| Bundle nào `require("@deepseek-ai/dsh-client-shortcuts")`? | **0** — grep **cả file** mọi `lib/*.js` đã cài |
| Kết luận | 1 id module = tên package ta + `moduleIds`. **Không alias**: đăng ký thêm id stock sẽ đưa cùng một factory vào bảng hai lần ⇒ service bị dựng hai lần |

## 5. Bảng TRƯỚC / SAU

**LAB CÁCH LY CHỈ ĐỔI ROW NÀY** (`bun run lab:row shortcuts` · home `/tmp/gbh-lab-shortcuts` · cổng **5463**):

| Chỉ số | Kết quả |
|---|---|
| Trang `/` | 200 · **49.589 B** |
| Entry · `mode` | 72 · `live` · **có id ta · không còn id stock** |
| `#root` · lỗi console | **89.015 ký tự** · **0 lỗi** — không có `Duplicate shortcut command` ⇒ 10 row phụ thuộc đăng ký được |
| Chữ của row KHÁC · khoá thô | "New Session"/"Plugins" hiện đúng · **0 khoá thô** |
| Bấm thử Meta+B / Meta+K / Escape | Không thấy thay đổi DOM — home lab trắng **không có phiên nào** nên phím tắt của sidebar/palette không có gì để đổi. Ghi thẳng: phép đo này **KHÔNG kết luận được** (khác với "đo được là không đổi") |

**Test**: 12 ca · **2.655 expect** — tất cả A/B với chính bundle gốc.

## 6. CÒN LẠI

1. **App 5439 chưa được xác nhận cho row này**: lab đã sạch + `gbh.row` đã khai, nhưng theo quy tắc mới của nhóm **chỉ Lead chạy `scripts/restart-host.sh`** ⇒ chờ Lead gom `shortcuts` vào lượt boot, rồi `bun run check:app` (đọc cả (6)(8)(9)(10)).
2. **Chưa đo trên vỏ Desktop thật**: nhánh native (`dshDesktop.keyboard`, `closeWindow`, `recording`) mới A/B với **cầu giả**; máy này không có preload Electron/Tauri để đo thật.
3. **Không có ảnh A/B pixel**: row không có UI riêng (0 primitive, 0 khoá từ điển) — giao diện của nó là giao diện của các row khác.
4. `dsh-brand`: dùng kiểu branded cục bộ thay vì `Branded` của kernel.
5. Chưa alias id stock (đo được 0 consumer).

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-shortcuts` (shasum `en ea4c006f7c54...` · `zh 2d4076ded159...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
