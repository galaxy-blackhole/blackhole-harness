<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README @galaxy-blackhole/gbh-host-webserver — port 1:1 gói cấp HTTP server (node:http + node:https + compression)
-->

# @galaxy-blackhole/gbh-host-webserver

Port 1:1 của `@deepseek-ai/dsh-host-webserver` — **gói giữ HTTP server của cả app** (tạo `node:http`/`node:https` server, đăng ký route,
nén `gzip`/`br`). Đây là gói **rủi ro cao nhất trong toàn bộ đợt port**: hỏng gói này là app chết, không chỉ một entry.

## 1. Đo 4 bước (§4f)

| phép đo | kết quả |
|---|---|
| artefact | **1**: `lib/index.js` **538 dòng** (ESM) + `lib/types/` |
| nửa client | **KHÔNG** (`dsh: null`) ⇒ không phải gói hai mặt |
| exports gốc | `.` · `./src/*` · `./package.json` · `./locale/*.json` |
| id stock trong artefact | **1** lần, **dòng 102 trong JSDoc** ⇒ artefact byte-identical, **0** lần đổi tên |
| row trong dump | `- id: webserver` · `inject: [webStartup]` · **config 6 khoá** |

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| lib/index.js | chỉ trong stock | **byte-identical** (538 dòng, 4 lát) |
| row `webserver` | stock bật | **PARK** với **config 6 khoá CHÉP NGUYÊN** (giữ `!!js ctx.webStartup…`) |
| test | không | `tests/host/host-webserver.test.ts` (A/B ≥12 ca, có ca **khoá route/mã trạng thái/header** + `listen(0)` so `address()`) |
| ca chống tái phát | — | mở rộng `tests/host/row-config-parity.test.ts` cho row `webserver` (deep-equal config stock) |

## 3. Vì sao config phải chép NGUYÊN

Bài học `tool-todo` (19/10): thiếu một khoá config ⇒ boot đỏ `ValidationError "$.<trường> missing required value"`. Với `webserver`, thiếu
`compressionLevel` hay đổi `host`/`port` sẽ **đổi cổng hoặc cách nén của cả app** ⇒ test row-config-parity bắt buộc deep-equal với dump oracle.

## 4. Nợ

1. Khai `gbh.row` chỉ sau khi test xanh → Lead chạy `boot-smoke host-webserver` **RIÊNG LẺ** (không gộp lô) → Lead thêm dòng `packages/README.md §4`.
2. Chưa port `lib/types` sang `.d.ts` riêng — build chép nguyên cây `lib/types` của bản gốc.
