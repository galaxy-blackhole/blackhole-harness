<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc Chữ ký REVIEW-3 cho hàng đợi docs/tien-do/review-hang-doi-9.txt (28 gói; 3 gói batch dev-5 bỏ ra cho reviewer khác).
      Append-only. Mỗi dòng KY đều kèm tệp:dòng đã đọc (luật của Lead).
-->

# Chữ ký review-3 — hàng đợi 9

Chính sách áp dụng: §2b/§2c/§2d/§2e/§2f + luật types của Lead (giữ `./lib/types/index.d.ts` khi tệp CÓ THẬT; chỉ dùng `./src/index.ts` khi tệp thiếu). 3 gói thuộc batch dev-5 bị BỎ RA: `host/translator` · `host/util-values` · `host/util-workspace-path`.

| package | vai | thời điểm | việc đã làm | kết quả tóm tắt |
|---|---|---|---|---|
| host/gbh-experimental-session-inspector | review-3 | 2026-11-08 11:10 | Đọc `package.json` + `lib/index.js` (6 dòng) + `README.md` + kiểm `lib/types/index.d.ts` | KY — gói de-bundle: `lib/index.js:6` là dòng `export {…}` và tập export **TRÙNG KHÍT stock** (0 thiếu · 0 thừa); `exports["."].types = ./lib/types/index.d.ts` **TỒN TẠI**; `README.md:1` mở `<!--` (header 5 dòng đủ); `lib/**` là artefact 1:1 §2d; R6: 0 import @deepseek-ai trong mã tay |
| host/gbh-tool-call-timeout-policy | review-3 | 2026-11-08 11:10 | Đọc `package.json` + `lib/index.js` (144 dòng) + README | KY — `lib/index.js:144` export **khớp khít stock** (4/4, 0 thừa); types trỏ tệp TỒN TẠI; README header OK; R4/R6: 0 dấu vết trong mã tay |
| host/home-paths | review-3 | 2026-11-08 11:10 | Đọc `package.json` + `lib/index.js` (168 dòng) + `.debundled` + README | KY — `lib/index.js:168` export 16/16 **khớp khít stock**; types TỒN TẠI; `.debundled` ghi rõ bản sao nguyên văn (§2d); README header OK |
| host/jobs | review-3 | 2026-11-08 11:10 | Đọc `package.json` + `lib/index.js` (123 dòng) + `.debundled` + README | KY — `lib/index.js:123` export 3/3 **khớp khít stock**; types TỒN TẠI; bản sao nguyên văn (§2d); README header OK |
| host/launch-environment | review-3 | 2026-11-08 11:10 | Đọc `package.json` + `lib/index.js` (82 dòng) + `.debundled` + README | KY — `lib/index.js:82` export 4/4 **khớp khít stock**; types TỒN TẠI; bản sao nguyên văn (§2d); README header OK |
| host/native-command | review-3 | 2026-11-08 11:10 | Đọc `package.json` + `lib/index.js` (930 dòng, chỉ đọc dòng export + vùng đầu) + `.debundled` + README | KY — `lib/index.js:930` export 12/12 **khớp khít stock**; types TỒN TẠI; bản sao nguyên văn (§2d); README header OK |
| host/output-retention | review-3 | 2026-11-08 11:10 | Đọc `package.json` + `lib/index.js` (301 dòng) + README | KY — `lib/index.js:301` export 5/5 **khớp khít stock**; types TỒN TẠI; README header OK; R4/R6: 0 dấu vết trong mã tay |
| host/gbh-libreoffice-kit-darwin-x64 | review-3 | 2026-11-08 11:10 | Đọc `package.json` + toàn bộ tệp gói (README.md, prebuilds.json) | **TRA LAI dev-2 — R1**: `README.md:1` là `# gbh-libreoffice-kit-darwin-x64` (KHÔNG có khối header 5 dòng trong 10 dòng đầu). Fix: prepend `<!-- author Bùi Trọng Hiếu / email kevinbui210191@gmail.com / create date 15/10/2026 / modify date 08/11/2026 / desc … -->`. Ghi chú: gói PLATFORM (chỉ `prebuilds.json`, `lib/` rỗng) ⇒ R2/R3/R5 n/a; KHÔNG có `types`/`exports` nên luật types không áp |
| host/gbh-node-addon-system-darwin-x64 | review-3 | 2026-11-08 11:10 | Đọc `package.json` + toàn bộ tệp gói (README.md, README.zh.md, LICENSE, prebuilds.json) | **TRA LAI dev-2 — R1**: `README.md:1` là `---` (front-matter YAML của stock) ⇒ KHÔNG có khối header 5 dòng. Fix: prepend `<!-- …5 dòng… -->` TRƯỚC front-matter. Ghi chú: gói PLATFORM (`lib/` rỗng, chỉ `prebuilds.json`) ⇒ R2/R3/R5 n/a |

## Lượt 2 — KIỂM LẠI 2 ca R1 platform (2026-11-08 11:40)

| package | vai | thời điểm | việc đã làm | kết quả tóm tắt |
|---|---|---|---|---|
| host/gbh-libreoffice-kit-darwin-x64 (kiểm lần 2) | review-3 | 2026-11-08 11:40 | Kiểm lại sau khi Lead/dev-4 vá: đọc tệp:dòng nêu trong kết quả | **KY — R1 ĐÓNG**: `README.md` nay có khối header 5 dòng trong 10 dòng đầu (`create date 15/10/2026` + author) — kiểm bằng `head -10 \| grep`. Gói PLATFORM (chỉ `prebuilds.json`, `lib/` rỗng) ⇒ R2/R3/R5 n/a; không có `types`/`exports` nên luật types không áp |
| host/gbh-node-addon-system-darwin-x64 (kiểm lần 2) | review-3 | 2026-11-08 11:40 | Kiểm lại sau khi Lead/dev-4 vá: đọc tệp:dòng nêu trong kết quả | **KY — R1 ĐÓNG**: `README.md` nay có khối header 5 dòng (đặt TRƯỚC front-matter `---`) — kiểm bằng `head -10 \| grep "create date 15/10/2026"`. Gói PLATFORM (`lib/` rỗng, `prebuilds.json`) ⇒ R2/R3/R5 n/a |
