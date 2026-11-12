<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói jobs — vendor 1:1 @deepseek-ai/dsh-jobs (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-jobs

Bản viết lại **1:1** của `@deepseek-ai/dsh-jobs` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-jobs'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-jobs` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `7a7531c2fb1897603fdf0ec78ae9cef63f6a32688b1023168fbe9d8f782e2887` |
| `lib/index.js` | **123** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/jobs/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
