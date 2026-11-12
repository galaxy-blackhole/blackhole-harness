<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port @deepseek-ai/dsh-sandbox-windows-acl → gbh-sandbox-windows-acl: ACL sandbox Win32, index + runner + chunk types copy nguyên văn, draft, KHÔNG mount
-->

# @galaxy-blackhole/gbh-sandbox-windows-acl — ACL sandbox Win32 (`draft`)

Port 1:1 `@deepseek-ai/dsh-sandbox-windows-acl` **0.2.1-alpha.4**: `lib/index.js` (2 dòng re-export) + `lib/runner.js` +
**chunk `lib/types-Cl_DXjhk.js` (1.411 dòng — port NGUYÊN DẠNG KHAI BÁO, không de-bundle)**. **Cổng byte delta 0** cho
cả 3 tệp (index sha256 `83379e9c6e8bb725d0ed48ad086fc666bfe151c8c1a345e29e3da5…`). Dump 0 row ⇒ `gbh.draft`, **không mount**.

## ⚠️ Nhánh WIN32 không quan sát được trên darwin
Gói dùng **koffi**/Windows ACL APIs. Trên macOS koffi không load ⇒ import ném lỗi; test kiểm byte-identical từng tệp +
export surface văn bản + hằng số (`ACL_DIAGNOSIS_SKILL`, `AclSandbox`, `AclWriteGrant`) + metadata, và có ca khẳng định
lý do win32-unobservable.

| Phép đo | KẾT QUẢ |
|---|---|
| artifact | **index + runner.js + types chunk byte-identical** |
| exports | `.` · `./package.json` · `./runner` |
| test A/B | **≥9 ca / 0 fail** |
