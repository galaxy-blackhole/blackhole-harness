<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói @galaxy-blackhole/gbh-tool-pwsh — port 1:1 tool `pwsh` của DSH sang Galaxy Blackhole
-->

# @galaxy-blackhole/gbh-tool-pwsh

Bản viết lại **1:1** của `@deepseek-ai/dsh-tool-pwsh` **0.2.1-alpha.4** (bundle `lib/index.js`, 736 dòng).
Tool hướng model: chạy `pwsh -Command` qua seam `ctx.shell`, tiền cảnh + `run_in_background`, job registry,
môi trường `DSH_*`, chính sách sandbox theo lời gọi và escalate qua `ctx.approval`.

## 1. Provenance

| Trường | Giá trị |
| --- | --- |
| `gbh.provenance.stock` | `@deepseek-ai/dsh-tool-pwsh` |
| `gbh.provenance.version` | `0.2.1-alpha.4` |
| `gbh.provenance.sha` | `94c7f68c425e62c8006907b3f4fea771935321581fd2327b7ee1f0ba8d15eec1` (sha256 của stock `lib/index.js`, 31.025 B) |

Gói **HOST-ONLY**: `package.json` của stock KHÔNG có `dsh.client`, nên không có nửa client.

## 2. Vùng bundle → module TS

| Vùng `#region` của bundle gốc | Module của ta | Nội dung |
| --- | --- | --- |
| `lib/types/background.js` (dòng 7–127) | `src/background.ts` | `sandboxNotes` · `processOutcome` · `processSources` · `ringDelta` · `processJob` |
| `lib/types/render.js` (dòng 128–213) | `src/render.ts` | `streamText` · `renderPwshResult` · `renderPwshPromoted` · `renderPwshJobRead` |
| `lib/types/index.js` (dòng 214–735) | `src/index.ts` | `name` · `inject` · `Config` · `validatePwshArgs` · `pwshDescription` · `resolveWorkdir` · `canonicalPwshResult` · `toolAborted` · `BACKGROUND_OUTPUT_PROPERTIES` · `apply` |
| — (chỉ kiểu, không có mã chạy) | `src/types.ts` | seam CẤU TRÚC của shell · jobs · sandbox-policy · agent · exec (ADR 000d) |

Chuỗi lỗi, hằng số, thứ tự tham số, schema `Config`/`output.schema`, mô tả tool và locale đều **NGUYÊN VĂN**.
Chỉ thêm kiểu và hai chỗ bọc cast tài liệu hoá (`approveEscalation` + `result.value` của presenter) — không đổi runtime.

## 3. Bề mặt export

```
Config · apply · inject · name
```

Bốn tên, đúng như bundle gốc (`export { Config, apply, inject, name };`).

## 4. Build & test

```bash
cd packages/host/tool-pwsh && bun run build.ts   # src/index.ts → lib/index.js (Bun.build, ESM node, gói ngoài external)
bun test tests/host/tool-pwsh.test.ts            # 24 ca A/B với bundle gốc
```

## 5. Row trong dump

Row **TOP-LEVEL** `tool-pwsh` (dump `.parity/dumps/2026-10-18T01-31-57/stock.normalised.json`, `order: 47`) =
`disabled: true` LITERAL, **KHÔNG** `config`, **KHÔNG** `inject`. Vì vậy gói khai `gbh.row_unmounted_ly_do`
(row `disabled: true`, chưa flip) — **KHÔNG** khai `gbh.row` và **KHÔNG** mount.

## 6. Locale

`locale/en.json` + `locale/zh.json` chép **byte-for-byte** từ stock, phơi qua `exports["./locale/*.json"]`.
