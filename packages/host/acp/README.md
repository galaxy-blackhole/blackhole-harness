<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port @deepseek-ai/dsh-acp → gbh-acp: 2 lát nguyên văn, cổng byte delta 0, test export/Config/hành vi lỗi apply, draft
-->

# @galaxy-blackhole/gbh-acp — host plugin (`draft`)

Port 1:1 `@deepseek-ai/dsh-acp` **0.2.1-alpha.4** (`lib/index.js` **1.467 dòng / 55 KB**): **2 lát NGUYÊN VĂN** (cắt tại `^//#region` dòng 646),
**cổng byte delta 0** (sha256 `9df25827fbf2ac7c0b168f22e5bea151153c1492ef118511be96688dc3039989`). Dump 0 row ⇒ `gbh.draft`, không mount/flip.

| Phép đo | KẾT QUẢ |
|---|---|
| artifact | **byte-identical** stock (cmp + sha) |
| export surface | `{Config, apply, inject, name}` + `inject` A≡B |
| **hành vi** | `apply({})` và `apply(ctx thiếu sessionPersistence)` ném **cùng message** ở A và B |
| test A/B | **9 ca / 0 fail** |
| provenance | `{stock, version, sha}` |

## Nợ kỹ thuật
- Không ship `.d.ts`/`./src/*`; exports chỉ `.` + `./package.json`.
