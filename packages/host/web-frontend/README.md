<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 21/10/2026
 desc Báo cáo port @deepseek-ai/dsh-web-frontend → gbh-web-frontend: gói TÀI NGUYÊN TĨNH, dist/ 90 tệp chép nguyên văn.
-->

# @galaxy-blackhole/gbh-web-frontend — tài nguyên tĩnh (task-207)

Stock `@deepseek-ai/dsh-web-frontend` 0.2.1-alpha.4 **không có `lib/`**, chỉ có **`dist/` (90 tệp, ~5.9 MB)** + LICENSE,
và **không có row nào** trong dump/parity (grep 0) ⇒ đây là **asset package**, không phải plugin.

Đã chép **NGUYÊN VĂN** `dist/` + LICENSE; `exports` mirror stock (`./dist/*`, `./package.json`); **không khai `gbh.row`**
(tránh check:rows chặn), `gbh.draft` ghi rõ lý do, `gbh.provenance` trỏ stock.

| Phép đo | KẾT QUẢ |
|---|---|
| dist | **90 tệp · 5.9 MB** · index/manifest/favicon trùng byte |
| exports | `./dist/*` · `./package.json` = stock |
| test | **3 ca / 0 fail** |
