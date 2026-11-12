<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói command-feedback — vendor 1:1 @deepseek-ai/dsh-command-feedback (provenance + sha), quyết định manifest ĐO từ dump
-->

# @galaxy-blackhole/gbh-command-feedback

Bản viết lại **1:1** của `@deepseek-ai/dsh-command-feedback` bằng **vendor nguyên byte** toàn bộ `lib/**` (index.js + types/*.js + *.d.ts).

## 0. Row trong dump ⇒ khai `gbh.row`

| trường | giá trị |
|---|---|
| row id (lấy theo `name` trong dump, KHÔNG theo tên thư mục) | `command-feedback` |
| `disabled` (dump) | true ⇒ thêm `insertDisabled: true` để mirror row stock đang tắt |
| `config` / `inject` | **không khai** — dump không có hai trường này (không bịa) |

## 1. Provenance

| trường | giá trị |
|---|---|
| stock | `@deepseek-ai/dsh-command-feedback` |
| version | `0.2.1-alpha.4` |
| sha256 `lib/index.js` | `2fb4e8eea117765b77e41513d21f7ed19663e2c01476f1c7dd9c3fdff561ed53` |
| `lib/index.js` | **175** dòng, byte-identical |

## 2. Build & test

```bash
bun run packages/host/command-feedback/build.ts   # vendor lại từ kernel + CỔNG SHA
bun test tests/host/host-utils-cluster.test.ts   # 9 ca A/B cho gói này
```
