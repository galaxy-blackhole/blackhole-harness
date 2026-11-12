<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port dsh-tool-cordis → @galaxy-blackhole/gbh-tool-cordis: CHỈ khai gbh.nested (row LỒNG trong
      preset-cordis, dump-now2 dòng 1418) — CHƯA mount/flip; de-bundle nguyên văn + CỔNG BYTE delta 0,
      test A/B trên Context cordis thật (không mạng/không shell thật)
-->

# @galaxy-blackhole/gbh-tool-cordis — row LỒNG (dsh-tool-cordis)

Port 1:1 `@deepseek-ai/dsh-tool-cordis` (`lib/index.js` **100 dòng**, single-faced) thành lát NGUYÊN VĂN ghép lại có
**CỔNG BYTE delta 0**. Trạng thái hiện tại: **CHƯA mount/flip** — chỉ khai metadata `gbh.nested`.

## 1. Vị trí row — đo từ `/tmp/dump-now2.txt` (19/10/2026)

Đo bằng script bun cắt block theo **thụt lề** (không đoán theo thứ tự), đối chiếu cả `- id:` lẫn `name:`:

| Vị trí | Dòng dump | Thụt lề · depth danh sách | id | name | Ngữ cảnh | config | inject | disabled |
|---|---|---|---|---|---|---|---|---|
| **LỒNG** | **1418–1419** | 6 · 1 (con trực tiếp thứ **18/23** của `config.plugins`) | `tool-cordis` | `@deepseek-ai/dsh-tool-cordis` | preset **`preset-cordis`** (row top-level dòng **1266**, block 1266–1437) | **không** | **không** | **không** |
| TOP-LEVEL (KHÁC row) | 615–616 | 0 · 0 | `cordis-inspect-providers` | `@deepseek-ai/dsh-tool-cordis/host` | bundle `@deepseek-ai/dsh-web-app`; subpath `./host` | **không** | **không** | **không** |

**KHÔNG có dòng `- id: tool-cordis` ở thụt lề 0** trong toàn dump ⇒ **KHÔNG khai `gbh.row` / `gbh.row_unmounted_ly_do`**.
Entry lồng chỉ có đúng 2 khoá `id` + `name`; **không config, không inject, không disabled** — nên `gbh.nested` cũng không
được bịa các khoá đó.

Dòng 615–616 là **row top-level của một plugin KHÁC** (id `cordis-inspect-providers`, name là subpath `./host`), không phải
row `tool-cordis`. Patch thay row chỉ phát **specifier của package** (`@galaxy-blackhole/gbh-tool-cordis` → main bundle),
không phát subpath `/host`; khai `gbh.row` cho id này sẽ nạp **sai nửa** (tool agent thay vì host provider). Vì vậy row host
top-level **vẫn dùng bản stock** và chỉ `gbh.nested` được khai. Subpath `./host` của gói ta vẫn được mirror đầy đủ để
sẵn sàng cho task mount riêng.

## 2. Metadata đã khai (`package.json`, KHÔNG mount/flip)

```json
"gbh": {
  "nested": {
    "kind": "preset",
    "pluginId": "tool-cordis",
    "stockId": "@deepseek-ai/dsh-tool-cordis",
    "presets": ["preset-cordis"]
  },
  "provenance": {
    "stock": "@deepseek-ai/dsh-tool-cordis",
    "version": "0.2.1-alpha.4",
    "sha": "ce0cd4d8983532c920cab7713dc51874f6d710c2c46c4a095167bfa980becdb0"
  },
  "tests": ["tests/host/tool-cordis.test.ts"],
  "draft": "CHƯA mount/flip … dòng 1418 … preset-cordis … dòng 615–616 là row KHÁC …"
}
```

- `gbh.row`: **KHÔNG có**. `gbh.row_unmounted_ly_do`: **KHÔNG có** (không có row top-level `tool-cordis` để park).
- `gbh.nested.presets`: đúng **`['preset-cordis']`** — entry chỉ xuất hiện trong preset này; **chỉ MỘT preset** nên không có
  khác biệt `disabled` giữa các preset (và entry cũng không khai `disabled`).
- `gbh.nested` **không** có `config`/`inject`/`disabled` vì dump-now2 không khai khoá nào.
- `gbh.draft` ghi lại số đo dòng 1418 + 1266 + 615–616 và trạng thái **CHƯA mount/flip**.

## 3. Subpath `./host` (JS KHÔNG BUNDLE)

Stock có `exports['./host']` → `lib/types/host.js`, và cả cây `lib/types/*.js` (6 tệp: index·host·present·providers·api-catalog·config)
là **runtime thật** với import tương đối. Gói ta **copy NGUYÊN VĂN byte-identical 6 tệp** vào `lib/types/` (tổng **678.089 B**)
+ mirror `./host` → `./lib/types/host.js` + `./host/locale/*.json` → `./locale/host/*.json`; test có ca `import` thật
`lib/types/host.js` với ctx giả `cordisInspect`+`tools` và ca byte-identical từng tệp.

## 4. Số đo

| Phép đo | Kết quả |
|---|---|
| build (cổng byte) | **3.687 B · delta 0** · sha256 `ce0cd4d8…` · `cmp` với stock = IDENTICAL |
| 6 tệp `lib/types/*.js` | **678.089 B** · byte-identical từng tệp (sha256 trong log build) |
| test A/B | **27 ca / 222 expect / 0 fail** (so stock ⟷ ours trên cùng fixture) |
| cổng parity mới `tests/host/row-config-parity.test.ts` | **58 ca / 139 expect / 0 fail** (đã thêm ca `tool-cordis`) |
| Context | cordis THẬT; seam/process GIẢ 100% — không mạng, không spawn/shell thật |
| tsc scoped | `tsc -p packages/host/tool-cordis/tsconfig.json` = **0 lỗi** (strict, gồm `build.ts` + `src/**/*.ts`) |
| lint scoped | header · file-length · jsdoc · dep-guard = **0 vi phạm** |

## 5. Build + kiểm tra (không mount)

```bash
cd galaxy-blackhole/blackhole-tauri
~/.bun/bin/bun run packages/host/tool-cordis/build.ts   # ghi lib/index.js + lib/types + locale, so từng byte
~/.nvm/versions/node/v26.9.0/bin/node node_modules/typescript/lib/tsc.js -p packages/host/tool-cordis/tsconfig.json
~/.bun/bin/bun test tests/host/tool-cordis.test.ts tests/host/row-config-parity.test.ts
```

**CHƯA mount/flip**: không thêm/xoá dòng nào trong `~/.galaxy/blackhole/app.patch.yml`, không stage gói vào profile,
không restart host. Gói chỉ là bản port + metadata `gbh.nested`; muốn mount phải qua `lab:row`/boot-smoke riêng.

## 6. Đường lùi (nếu mount làm hỏng phiên)

1. Bỏ khối `gbh.nested` trong `packages/host/tool-cordis/package.json`.
2. `bun run apps/cli/src/main.ts host --dump-config` (BẮT BUỘC — patch regen, nếu không overlay cũ còn khối insert).
3. `scripts/restart-host.sh`.

## 7. Nợ kỹ thuật

- Lát giữ `// @ts-nocheck` (asset nguyên văn); `lib/index.js` là artefact sinh tự động.
- Không ship `.d.ts`/`lib/types/index.js` hay subpath `./src/*`; exports mirror đúng các subpath RUNTIME stock có.
- Row top-level `cordis-inspect-providers` (`./host`) **chưa thể thay** bằng cơ chế `gbh.row` hiện tại vì patch chỉ phát
  specifier gốc package, không phát subpath; cần task mount riêng cho nửa host nếu muốn bỏ stock hoàn toàn.
