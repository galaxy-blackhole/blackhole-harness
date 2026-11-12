<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói cmdline — vendor 1:1 @deepseek-ai/dsh-cmdline (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-cmdline

Bản viết lại **1:1** của `@deepseek-ai/dsh-cmdline` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-cmdline'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-cmdline` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `7253190611566485f8b6f836fae6e0f2a7abbc59bb807c42e874844016e6d3a0` |
| `lib/index.js` | **152** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/cmdline/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
