<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói tmux-context — vendor 1:1 @deepseek-ai/dsh-tmux-context (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-tmux-context

Bản viết lại **1:1** của `@deepseek-ai/dsh-tmux-context` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-tmux-context'` |
| Hệ quả | consumer inline ⇒ `gbh.draft` (thư viện) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-tmux-context` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `52f3325bc4d98051315a2951db179efcfe3a51af3291e2b2279004c922f947f9` |
| `lib/index.js` | **2300** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/tmux-context/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
