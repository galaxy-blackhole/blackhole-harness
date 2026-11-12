<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói anonymous-user-id — vendor 1:1 @deepseek-ai/dsh-anonymous-user-id (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-anonymous-user-id

Bản viết lại **1:1** của `@deepseek-ai/dsh-anonymous-user-id` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-anonymous-user-id'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-anonymous-user-id` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `8645c437702f29583b1b17dc69b7ee20a027317163fc43e44ebb4df4998490f0` |
| `lib/index.js` | **78** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/anonymous-user-id/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
