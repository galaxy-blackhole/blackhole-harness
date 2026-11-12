<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README @galaxy-blackhole/gbh-client-ui-directory-picker-native
-->

# @galaxy-blackhole/gbh-client-ui-directory-picker-native

Port 1:1 `@deepseek-ai/dsh-client-ui-directory-picker-native` — gói **THƯ VIỆN** (được `@deepseek-ai/dsh-web-app` khai trong `dependencies`),
**KHÔNG có row trong dump oracle** ⇒ **không khai `gbh.row`** và **không khai `row_unmounted_ly_do`** (khoá đó ngụ ý 'đang chờ thay row' — sai ngữ nghĩa); chỉ khai `gbh.draft` + `gbh.tests`.

## Đo 4 bước (§4f)
| phép đo | kết quả |
|---|---|
| artefact | `lib/index.js` **12 dòng** (`export { apply }` — không có hành vi host) + `lib/client.js` **83 dòng** |
| id stock | index **0** lần · client **1** lần (dòng 2 = loader) |
| `dsh.client` gốc | `{ inject: [ui-renderer, ui-workspace], platform: 'web' }` |
| exports gốc | `.` · `./client` · `./src/*` · `./package.json` · `./locale/*.json` |
| row trong dump | **KHÔNG** (0 khớp) |

## BỘ BA + MỘT-ID
- `dsh.client` khớp **tuyệt đối** bản gốc · `exports['./client']` khớp gốc · **2 lời gọi `Bun.build` TÁCH RỜI** (`lib/index-entry.js` + `lib/client-entry.js`).
- MỘT-ID: `lib/client.js` đăng ký **đúng 1 id của ta**, **0** id stock; đổi 1 chỗ ⇒ **+5 B**; chuẩn hoá id ta→stock ⇒ **byte-identical**.

## Nợ
1. Không có row ⇒ không cần boot-smoke/mount; Lead xử lý ở tầng matrix (gói thư viện của `web-app`).
