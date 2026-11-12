<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port @deepseek-ai/dsh-win32-process → gbh-win32-process: binding Win32/koffi, copy nguyên văn byte-identical, draft, KHÔNG mount
-->

# @galaxy-blackhole/gbh-win32-process — binding Win32/koffi (`draft`)

Port 1:1 `@deepseek-ai/dsh-win32-process` **0.2.1-alpha.4** (`lib/index.js` **761 dòng**): copy NGUYÊN VĂN, **cổng byte delta 0**
(sha256 `622bc3a9e97c46e784fe41c9a0a8535da2808019e4ac3f66d17cdad70c9a…`). Dump 0 row ⇒ `gbh.draft`, **không mount**.

## ⚠️ Nhánh WIN32 không quan sát được trên darwin
Gói dùng **koffi** để gọi Windows API (job object, handle, token). Trên macOS **koffi không load** ⇒ import bundle
ném lỗi (`Cannot find module`/`koffi`/`dylib`), nên test ở đây chỉ kiểm **byte-identical + export surface dạng văn bản +
hằng số + metadata**; các ca hành vi win32 chỉ chạy được trên Windows. Test có ca khẳng định **lý do** này (không phải
lỗi logic của ta) và README ghi rõ.

| Phép đo | KẾT QUẢ |
|---|---|
| artifact | **byte-identical** stock (cmp + sha) |
| export surface | ≥20 tên khớp stock (văn bản) |
| test A/B | **≥9 ca / 0 fail** (byte · assemble · export tokens · hằng số · win32-unobservable · provenance · draft · exports · README) |
