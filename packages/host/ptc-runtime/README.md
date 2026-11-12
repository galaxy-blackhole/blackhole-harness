<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port @deepseek-ai/dsh-ptc-runtime → gbh-ptc-runtime: thư viện runtime PTC (175 dòng), copy nguyên văn byte-identical, draft
-->

# @galaxy-blackhole/gbh-ptc-runtime — thư viện (`draft`)

Port 1:1 `@deepseek-ai/dsh-ptc-runtime` **0.2.1-alpha.4** (`lib/index.js` **175 dòng / 5.561 B**): copy NGUYÊN VĂN, exports
`.` · `./package.json`; KHÔNG có row trong dump ⇒ `gbh.draft`, không mount.

| Phép đo | KẾT QUẢ |
|---|---|
| `lib/index.js` | **5.561 B · `cmp` IDENTICAL** · sha256 `a09ee10c5cbd1f30662324aa5929b23f54cbd955098701fcf90d6252e06987a8` |
| export surface | `{DUNDER_MEMBER, PORTABLE_RESERVED_WORDS, PtcRuntime (default), RESERVED_BINDING_GLOBALS, RESERVED_ERROR_MEMBERS}` khớp stock |
| test A/B | **8 ca / 0 fail** (byte+sha · export · hằng số · prototype lớp · provenance · draft · peers · exports) |
| provenance | `{ stock: '@deepseek-ai/dsh-ptc-runtime', version, sha }` |
