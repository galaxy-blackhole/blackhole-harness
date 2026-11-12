<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói launch-environment — vendor 1:1 @deepseek-ai/dsh-launch-environment (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-launch-environment

Bản viết lại **1:1** của `@deepseek-ai/dsh-launch-environment` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-launch-environment'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-launch-environment` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `6aab33b43d6caa4ee483f7d796a17afb400fca02b7a259fb55d486626e6bb7f0` |
| `lib/index.js` | **82** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/launch-environment/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
