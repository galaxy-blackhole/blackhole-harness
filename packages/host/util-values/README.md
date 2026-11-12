<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói util-values — vendor 1:1 @deepseek-ai/dsh-util-values (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-util-values

Bản viết lại **1:1** của `@deepseek-ai/dsh-util-values` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-util-values'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-util-values` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `4322a2aacdfe38476d2bbc62338120beea1e1660346d7db5b6c1e1f927a26b7c` |
| `lib/index.js` | **923** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/util-values/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
