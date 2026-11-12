<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port dsh-tool-workflow → @galaxy-blackhole/gbh-tool-workflow: row TOP-LEVEL PARK trong
      `gbh.row_unmounted_ly_do` (disabled: true, dump-now2 dòng 418–420) + row LỒNG `gbh.nested`
      (preset-standard 978 · preset-ptc 1143 · preset-cordis 1405); KHÔNG `gbh.row`, KHÔNG mount/flip;
      de-bundle nguyên văn + CỔNG BYTE delta 0, test A/B trên Context cordis thật (không mạng/không shell thật)
-->

# @galaxy-blackhole/gbh-tool-workflow — row PARK + row LỒNG (dsh-tool-workflow)

Port 1:1 `@deepseek-ai/dsh-tool-workflow` (`lib/index.js` **442 dòng**, **MỘT MẶT**) thành lát NGUYÊN VĂN ghép lại có
**CỔNG BYTE delta 0**. Trạng thái hiện tại: **CHƯA mount / CHƯA flip** — chỉ khai metadata.

## Vị trí đo được trong `/tmp/dump-now2.txt` (19/10/2026)

Đo bằng script bun cắt block theo depth (KHÔNG đoán); dump **2.297 dòng**:

| Site | Dòng | Thụt / depth | Preset (dòng · config.id · order) | Khoá đo được |
|---|---|---|---|---|
| **TOP-LEVEL** | **418–420** | 0 / 0 | — | `- id: tool-workflow` · `name: '@deepseek-ai/dsh-tool-workflow'` · `disabled: true` **LITERAL** (không `!!js`) · KHÔNG `config`, KHÔNG `inject` |
| LỒNG | **978–979** | 10 / 2 | `preset-standard` (835–998 · `standard` · 1) | id + name · **KHÔNG** `disabled`/`config`/`inject` |
| LỒNG | **1143–1145** | 10 / 2 | `preset-ptc` (999–1168 · `ptc` · 2) | id + name + **`disabled: true` LITERAL** · KHÔNG `config`/`inject` |
| LỒNG | **1405–1406** | 10 / 2 | `preset-cordis` (1266–1437 · `cordis` · 4) | id + name · **KHÔNG** `disabled`/`config`/`inject` |

- Cả ba entry lồng ở depth 2 vì nằm trong nhóm `cordis:group` **`delegation`** (`isolate.workflowEngine: true`):
  block 953–979 · 1117–1145 · 1380–1406 — mỗi entry là CON CUỐI của nhóm.
- `preset-minimal` (1169–1265) **KHÔNG** có entry `tool-workflow`.
- **ĐÍNH CHÍNH số đo**: preset TẮT entry lồng là **preset-ptc (dòng 1143)**, KHÔNG phải preset-cordis;
  preset-cordis (dòng 1405) BẬT (không khai `disabled`).
- Dump oracle cũ `.parity/dumps/2026-10-18T01-31-57/oracleA_nopatch.yml` cho CÙNG cấu trúc: top-level 320–322
  (`disabled: true`) · lồng 772 (BẬT) · 937 (`disabled: true`) · 1199 (BẬT).
- §4f: stock **MỘT MẶT** — `package.json` gốc không có `dsh.client`, `lib/client.js` không tồn tại
  ⇒ mount không làm rơi nửa browser nào.

## Metadata — PARK top-level + LỒNG preset, KHÔNG `gbh.row`

`gbh.row_unmounted_ly_do` (row top-level; **chưa flip**):

```json
{
  "ly_do": "CHƯA mount/flip — row stock TOP-LEVEL đang TẮT (disabled: true) nhưng cùng id còn sống trong 3 preset (standard BẬT · ptc TẮT · cordis BẬT) ⇒ flip row lúc này chỉ thay bản top-level đang tắt, 3 entry lồng vẫn trỏ bundle stock; muốn BẬT phải kèm insertDisabled: true + mount tầng preset qua gbh.nested. Chờ lab:row + boot-smoke + check:app 11/11 của lượt boot Lead (LUẬT BOOT: mỗi lượt một row mới — §4f CONVERSION-RUNBOOK). Gói MỘT MẶT: stock KHÔNG có dsh.client / lib/client.js.",
  "row": {
    "id": "tool-workflow",
    "disabled": true,
    "moduleIds": ["@galaxy-blackhole/gbh-tool-workflow"],
    "aliases": ["@deepseek-ai/dsh-tool-workflow"],
    "tests": ["tests/host/tool-workflow.test.ts"]
  }
}
```

- Chỉ khoá dump CÓ: entry top-level không `config`, không `inject` ⇒ khối park **không bịa** hai khoá đó.
- **Vì sao KHÔNG `gbh.row`:** row top-level đang TẮT; flip lúc này chỉ thay bản top-level đang tắt, còn 3 entry
  lồng vẫn trỏ bundle stock. Muốn BẬT phải kèm `insertDisabled: true` **và** mount tầng preset qua
  `gbh.nested`; chờ `lab:row` + boot-smoke + `check:app` 11/11 của lượt boot Lead (§4f RUNBOOK: mỗi lượt
  boot một row mới).

`gbh.nested` (row LỒNG; registry thay `name` lúc chạy):

```json
{
  "kind": "preset",
  "pluginId": "tool-workflow",
  "stockId": "@deepseek-ai/dsh-tool-workflow",
  "presets": ["preset-standard", "preset-ptc", "preset-cordis"],
  "topLevelDisabledInStock": true,
  "presetDisabledNote": "preset-ptc TẮT entry lồng (disabled: true LITERAL, dòng 1145) còn preset-standard (978–979) và preset-cordis (1405–1406) BẬT — KHÔNG khai disabled; preset-minimal (1169–1265) KHÔNG có entry. agent-preset-registry chỉ viết lại name, giữ nguyên id/config/disabled của từng preset ⇒ metadata không san phẳng khác biệt disabled."
}
```

- `agent-preset-registry` chỉ viết lại `name` (`nested-mount.ts` · `rewriteNestedNames`), giữ nguyên
  `id`/`config`/`disabled` của từng preset ⇒ khác biệt disabled **không bị san phẳng**: preset-ptc vẫn TẮT,
  preset-standard và preset-cordis vẫn BẬT.
- `presets` là **số đo mô tả** (3 preset có entry), không phải bộ lọc.

## Subpath `./types` (JS KHÔNG BUNDLE)

Stock có `exports['./types']` → `lib/types/types.js`; `types.js` import `./record.js` ⇒ **copy NGUYÊN VĂN 2 tệp**
(`types.js` 228 B, `record.js` 1.748 B) vào `lib/types/`, mirror `./types`; `build.ts` có
`mirrorTypeFiles(outDir)` để mỗi lượt build sinh lại mirror; test có ca import thật + byte-identical.

## Số đo (19/10/2026)

| Phép đo | Kết quả |
|---|---|
| build (cổng byte) | **17.100 B · delta 0** · sha256 `9d7ccb52…` · `cmp` với stock = IDENTICAL |
| build entry | `build.ts` là entry DUY NHẤT: `lib/index.js` + mirror 2 tệp `lib/types/*.js` |
| test A/B | **23 ca / 227 expect / 0 fail** |
| Context | cordis THẬT; seam/process GIẢ 100% — không mạng, không spawn/shell thật |
| tsc scoped | `build.ts` + `src/assemble.ts` + `src/manifest.ts` + test + harness = **0 lỗi** |
| lint scoped | header 0 · file-length 0 (test 889 dòng · harness 639 · part-00 453) · jsdoc 0 vi phạm · dep-guard 0 |

## CHƯA mount / CHƯA flip (trong phạm vi task này)

- **Không** khai `gbh.row`; **không** chạy `--dump-config`/`lab:row`/boot-smoke; **không** restart host 5439;
  **không** sửa `app.patch.yml`/profile. App vẫn dùng bundle stock.
- `gbh.row_unmounted_ly_do` + `gbh.nested` chỉ là **metadata**: đổi tên khoá thành `gbh.row` mới là mount thật,
  và mount row lồng phải qua cơ chế của `agent-preset-registry` (ADR 0007).

## Đường lùi (nếu mount làm hỏng phiên)

1. Bỏ khối `gbh.row_unmounted_ly_do` + `gbh.nested` trong `packages/host/tool-workflow/package.json`.
2. `bun run apps/cli/src/main.ts host --dump-config` (BẮT BUỘC — patch regen, nếu không overlay cũ còn khối insert).
3. `scripts/restart-host.sh`.

## Nợ kỹ thuật

- Lát giữ `// @ts-nocheck` (asset nguyên văn); `lib/index.js` là artefact sinh tự động.
- Không ship `.d.ts`/`lib/types/index.js` hay subpath `./src/*`; exports mirror đúng các subpath RUNTIME stock có.
- Cổng parity chung `tests/host/row-config-parity.test.ts` do agent khác phụ trách (ngoài phạm vi gói này);
  task này KHÔNG sửa tệp đó — metadata của gói được canh bởi chính test A/B `tests/host/tool-workflow.test.ts`.
