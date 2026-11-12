<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói home-paths — vendor 1:1 @deepseek-ai/dsh-home-paths (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-home-paths

Bản viết lại **1:1** của `@deepseek-ai/dsh-home-paths` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-home-paths'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-home-paths` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `9877a6117c5def69b61fae12f70a7a7400894a9dc4a9f7069ce4cc58aeb66e9d` |
| `lib/index.js` | **168** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/home-paths/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
