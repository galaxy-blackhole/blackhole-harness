<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói timeout — vendor 1:1 @deepseek-ai/dsh-timeout (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-timeout

Bản viết lại **1:1** của `@deepseek-ai/dsh-timeout` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-timeout'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-timeout` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `f9a79fd5194bb4d6321e6d2d5b5eb72f99c683452e1defbb75fad52f76aed667` |
| `lib/index.js` | **149** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/timeout/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
