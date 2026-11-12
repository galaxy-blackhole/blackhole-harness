<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói bash-local — vendor 1:1 @deepseek-ai/dsh-bash-local (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-bash-local

Bản viết lại **1:1** của `@deepseek-ai/dsh-bash-local` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-bash-local'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-bash-local` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `6d9b4426b8455198b79de398f57c0f5693e7292411059b66d5ac5eba608b59cb` |
| `lib/index.js` | **332** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/bash-local/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
