<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói attachment — vendor 1:1 @deepseek-ai/dsh-attachment (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-attachment

Bản viết lại **1:1** của `@deepseek-ai/dsh-attachment` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-attachment'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-attachment` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `9cd6c01a6cca9431f789be334afdfe4f5cf647224bb394cc0215056796520f58` |
| `lib/index.js` | **344** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/attachment/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
