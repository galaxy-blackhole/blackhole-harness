<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc Chữ ký REVIEW-3 cho hàng đợi docs/tien-do/review-hang-doi-15.txt (21 gói; 3 gói batch dev-5 bỏ ra).
      Append-only. KY kèm tệp:dòng; TRA LAI kèm cách sửa.
-->

# Chữ ký review-3 — hàng đợi 15

Bỏ ra (của dev-5, không tự chấm): `host/translator` · `host/util-values` · `host/util-workspace-path`.

| package | vai | thời điểm | việc đã làm | kết quả tóm tắt |
|---|---|---|---|---|
| host/shell | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 4/4 khớp khít stock; `types = ./lib/types/index.d.ts` TỒN TẠI; 3 tệp src, header 3/3, max 255; 0 dấu vết |
| host/shell-env | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 5/5 khớp khít stock; types TỒN TẠI; 3 tệp, header đủ, max 198 |
| host/skill | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 8/8 khớp khít stock; types TỒN TẠI; 5 tệp, header đủ, max 576 |
| host/skill-badge | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 3/3 khớp khít stock; types TỒN TẠI; 1 tệp 68 dòng, header đủ |
| host/skill-office | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 4/4 khớp khít stock; types TỒN TẠI; 1 tệp 68 dòng, header đủ |
| host/spill | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — DE-BUNDLE: export 3/3 khớp khít stock; types TỒN TẠI; `lib/**` là artefact §2d |
| host/storage | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 6/6 khớp khít stock; types TỒN TẠI; 4 tệp, header đủ, max 106 |
| host/subagent | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 25/25 khớp khít stock; types TỒN TẠI; 28 tệp src, header 28/28, max 764 |
| host/subagent-fork-in-process | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 4/4 khớp khít stock; types TỒN TẠI; 2 tệp, max 107 |
| host/subprocess-local | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 2/2 khớp khít stock; types TỒN TẠI; 27 tệp, header đủ, max 597 |
| host/system-prompt | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 9/9 khớp khít stock; types TỒN TẠI; 5 tệp, max 326 |
| host/timeout | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — DE-BUNDLE: export 6/6 khớp khít stock; types TỒN TẠI; `lib/**` artefact §2d |
| host/timeout-policy | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — Gói GBH-native (stock KHÔNG cài trong node_modules) ⇒ R5 = N/A; 4 tệp src, header 4/4, max 109; `types = ./lib/types/index.d.ts` TỒN TẠI |
| host/tool-schedule | review-3 | 2026-11-08 11:50 | Đọc mã + so dòng `export {…}` của `lib/index.js` ta vs stock + kiểm tồn tại tệp `types` + quét header/độ dài | **KY** — export 3/3 khớp khít stock; types TỒN TẠI; 5 tệp, max 669 |
| host/terminal | review-3 | 2026-11-08 11:50 | Đọc `package.json` (khối exports) + kiểm `lib/types/index.d.ts` tồn tại + so `package.json` của stock | **TRA LAI dev-4 — THIẾU điều kiện `types`**: `package.json:11-15` khai `"." : "./lib/index.js"` (dạng CHUỖI, không có `types`) trong khi `lib/types/index.d.ts` **CÓ THẬT** và stock khai `"types": "lib/types/index.d.ts"` ⇒ consumer TS resolve theo id gói KHÔNG thấy kiểu. Fix (luật types của Lead): `"." : { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" }`. Phần khác ĐẠT: export runtime 5/5 khớp khít stock, 3 tệp src header đủ, max 372 |
| host/tool-bash | review-3 | 2026-11-08 11:50 | Đọc `package.json` (khối exports) + kiểm `lib/types/index.d.ts` tồn tại + so `package.json` của stock | **TRA LAI dev-4 — THIẾU điều kiện `types`**: `package.json:8-12` `"." : "./lib/index.js"` (chuỗi) trong khi `lib/types/index.d.ts` CÓ THẬT, stock khai `types: lib/types/index.d.ts` ⇒ consumer TS mất kiểu. Fix: đổi thành object có `types` như trên. Khác ĐẠT: export 4/4 khớp stock, 3 tệp src, max 744 |
| host/tool-bash-persistent | review-3 | 2026-11-08 11:50 | Đọc `package.json` (khối exports) + kiểm `lib/types/index.d.ts` tồn tại + so `package.json` của stock | **TRA LAI dev-4 — THIẾU điều kiện `types`**: y hệt `host/tool-bash` (`package.json:8-12`, `lib/types/index.d.ts` CÓ THẬT, stock khai types) ⇒ consumer TS mất kiểu. Fix: object có `types`. Khác ĐẠT: export 4/4 khớp stock, 3 tệp src, max 407 |
| host/subagent-model-selection-settings | review-3 | 2026-11-08 11:50 | Đọc `package.json` (khối exports) + kiểm `lib/types/index.d.ts` tồn tại + so `package.json` của stock | **TRA LAI dev-4 — THIẾU điều kiện `types`** (ca nhẹ): `exports["."]` = `"./lib/index.js"` (chuỗi) và `lib/types/index.d.ts` KHÔNG tồn tại; `types` cấp cao nhất = `src/index.ts` (TỒN TẠI). Fix: `"." : { "types": "./src/index.ts", "default": "./lib/index.js" }` — theo luật Lead: chỉ trỏ `src` khi `lib/types` thiếu. Khác ĐẠT: 1 tệp src 145 dòng, header đủ |

> **Tổng hàng đợi-15: 14 KY · 4 TRA LAI** (18/18 gói đã chấm). Cả 4 ca trả lại là CÙNG MỘT LỚP: `exports["."]` là CHUỖI nên thiếu điều kiện `types` ⇒ consumer TS mất kiểu dù tệp `.d.ts` có thật (3 gói) hoặc phải trỏ `src` (1 gói). Sửa 1 dòng/gói: đổi `".": "./lib/index.js"` thành `".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" }`.

## Lượt 2 — KIỂM LẠI 4 ca thiếu điều kiện `types` (2026-11-08 11:44)

| package | vai | thời điểm | việc đã làm | kết quả tóm tắt |
|---|---|---|---|---|
| host/terminal (kiểm lần 2) | review-3 | 2026-11-08 11:44 | Kiểm lại sau khi dev-4 sửa manifest: đọc khối `exports` + kiểm TỒN TẠI từng đích + đọc 2 assertion test đã đổi | **KY — R5/types ĐÓNG**: `exports["."]` nay `{ "types": "./lib/types/index.d.ts", "default": "./lib/index.js" }`; tôi kiểm **tồn tại thật**: `lib/types/index.d.ts` OK · `lib/index.js` OK · (`src/index.ts` không có — đúng vì gói de-bundle). Test `tests/host/terminal.test.ts:968-970` đã đổi sang `toEqual({types, default})` + comment nêu đúng luật — nhất quán với manifest |
| host/tool-bash (kiểm lần 2) | review-3 | 2026-11-08 11:44 | Kiểm lại sau khi dev-4 sửa manifest: đọc khối `exports` + kiểm TỒN TẠI từng đích + đọc 2 assertion test đã đổi | **KY — ĐÓNG**: `exports["."]` nay object có `types` → `./lib/types/index.d.ts` **TỒN TẠI**; `lib/index.js` TỒN TẠI. Export runtime 4/4 khớp khít stock; 3 tệp src header đủ, max 744 |
| host/tool-bash-persistent (kiểm lần 2) | review-3 | 2026-11-08 11:44 | Kiểm lại sau khi dev-4 sửa manifest: đọc khối `exports` + kiểm TỒN TẠI từng đích + đọc 2 assertion test đã đổi | **KY — ĐÓNG**: `exports["."]` nay object có `types` → `lib/types/index.d.ts` **TỒN TẠI**; test `tests/host/tool-bash-persistent.test.ts:845-847` đã đổi sang `toEqual({types, default})` + comment; export 4/4 khớp stock, max 407 |
| host/subagent-model-selection-settings (kiểm lần 2) | review-3 | 2026-11-08 11:44 | Kiểm lại sau khi dev-4 sửa manifest: đọc khối `exports` + kiểm TỒN TẠI từng đích + đọc 2 assertion test đã đổi | **KY — ĐÓNG**: `exports["."]` nay `{ "types": "./src/index.ts", "default": "./lib/index.js" }`; kiểm: `lib/types/index.d.ts` **MISS** (đúng) · `src/index.ts` **OK** ⇒ áp ĐÚNG luật Lead "chỉ trỏ src khi lib/types thiếu"]. R5 = N/A (gói GBH-native, stock không cài) |
