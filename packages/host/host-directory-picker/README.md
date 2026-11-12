<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README @galaxy-blackhole/gbh-host-directory-picker
-->

# @galaxy-blackhole/gbh-host-directory-picker

Port 1:1 `@deepseek-ai/dsh-host-directory-picker` (**44 dòng**) — gói **THƯ VIỆN BASE/LEGACY**.

## Vì sao KHÔNG có row
Bản **được mount thật** trong profile oracle là `@deepseek-ai/dsh-host-directory-picker-auto` (row `- id: directory-picker`), đã port ở
[packages/host/directory-picker-auto](../../host/directory-picker-auto). Gói `dsh-host-directory-picker` (bản base) **không xuất hiện trong dump**
⇒ port code 1:1 nhưng **không chiếm row**, không khai `gbh.row`/`row_unmounted_ly_do`.

## Số đo
| phép đo | kết quả |
|---|---|
| lib/index.js | **44 dòng** · **byte-identical** (3 lát) |
| id stock | **1** lần, ở **JSDoc dòng 13** ⇒ 0 lần đổi tên |
| exports | `DirectoryPicker` · `default` · `DirectoryPickerError` |
| row trong dump | **KHÔNG** |
