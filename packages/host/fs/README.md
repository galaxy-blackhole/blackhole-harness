<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói fs — vendor 1:1 @deepseek-ai/dsh-fs (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-fs

Bản viết lại **1:1** của `@deepseek-ai/dsh-fs` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-fs'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-fs` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `b165659f1eff0607222a7fe761bc56bae03fec8337c2e25affd064a3047dacb9` |
| `lib/index.js` | **98** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/fs/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
