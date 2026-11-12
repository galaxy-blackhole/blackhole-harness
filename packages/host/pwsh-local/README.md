<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói pwsh-local — vendor 1:1 @deepseek-ai/dsh-pwsh-local (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-pwsh-local

Bản viết lại **1:1** của `@deepseek-ai/dsh-pwsh-local` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-pwsh-local'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-pwsh-local` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `8b7b57eb7f6c597caa5ee72e4dfd88cec7b5ac51e450ed3521b6b6b29306b88e` |
| `lib/index.js` | **429** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/pwsh-local/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
