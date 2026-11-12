<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói credentials — vendor 1:1 @deepseek-ai/dsh-credentials (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-credentials

Bản viết lại **1:1** của `@deepseek-ai/dsh-credentials` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-credentials'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-credentials` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `1b6afdb04e966285e0732eb766eb0a12f3f9c0821c8caacfd192ce1ac88bee7a` |
| `lib/index.js` | **151** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/credentials/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
