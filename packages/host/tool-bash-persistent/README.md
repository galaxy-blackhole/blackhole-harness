<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port dsh-tool-bash-persistent → @galaxy-blackhole/gbh-tool-bash-persistent: entry LỒNG trong preset
      minimal (gbh.nested kind:'preset', qua nhóm cordis:group `persistent-shell`), de-bundle nguyên văn + CỔNG BYTE
      delta 0, test A/B dùng PTY/process GIẢ 100% — TRẠNG THÁI: CHƯA mount/flip
-->

# @galaxy-blackhole/gbh-tool-bash-persistent — entry LỒNG trong preset (`dsh-tool-bash-persistent`)

Port 1:1 `@deepseek-ai/dsh-tool-bash-persistent` (`lib/index.js` **394 dòng**, bundle MỘT khối, single-faced) thành lát
NGUYÊN VĂN ghép lại có **CỔNG BYTE delta 0** — không port typed, không sửa thân bundle.

## Vị trí row — ĐO 19/10/2026 từ `/tmp/dump-now2.txt` (dump MỚI NHẤT, 2.297 dòng)

| # | Vị trí | Dòng | Depth | Thụt lề | Tổ tiên / ghi chú | disabled | config | inject |
|---|---|---|---|---|---|---|---|---|
| 1 | **TOP-LEVEL** | — | — | — | **KHÔNG CÓ**: không có `- id: tool-bash-persistent` và không có `- id: persistent-bash` ở thụt lề 0 | — | — | — |
| 2 | **LỒNG trong preset** | **1211** (`- id: persistent-bash`) | 2 | 10 | `preset-minimal` (dòng 1169, depth 0, preset id `minimal`, order 3) › `persistent-shell` (`cordis:group`, dòng 1198, depth 1, `isolate.terminals: true`) › `persistent-bash` | `!!js process.platform === 'win32'` (dòng 1213) | `timeoutMs: 300000` + `description` (dòng 1214-1235) | — (không có) |

- `name` của entry: `'@deepseek-ai/dsh-tool-bash-persistent'` (**dòng 1212**); stock id xuất hiện **ĐÚNG 1 lần** trong dump.
- Ba preset còn lại — `preset-standard` (dòng 835), `preset-ptc` (dòng 999), `preset-cordis` (dòng 1266) — **KHÔNG** chứa entry.
- Nhóm TOP-LEVEL `optional-persistent-terminals` (dòng 1463, `disabled: true` bởi patch của ta) **KHÔNG** chứa entry
  (con của nó là `optional-tool-terminal`) ⇒ **không** khai nhóm này.
- Nguồn của nhóm: patch preset stock `apps/host/node_modules/@deepseek-ai/dsh-web-app/presets/minimal.patch.yml:34-51`
  (chỉ preset minimal có nhóm `persistent-shell`).
- Đối chiếu dump cũ `.parity/dumps/2026-10-18T01-31-57/ours.yml`: **CÙNG cấu trúc** — dòng 1137 `preset-minimal` ·
  1166 `persistent-shell` · 1179 `persistent-bash`.

### Metadata đã khai (`package.json`)

```json
"gbh": {
  "tests": ["tests/host/tool-bash-persistent.test.ts"],
  "peers": ["@deepseek-ai/dsh-agent", "@deepseek-ai/dsh-output-retention", "@deepseek-ai/dsh-terminal", "@deepseek-ai/dsh-timeout", "@deepseek-ai/dsh-tools", "@deepseek-ai/cordis", "@deepseek-ai/dsh-working-directory", "@deepseek-ai/schemastery"],
  "nested": {
    "kind": "preset",
    "pluginId": "persistent-bash",
    "stockId": "@deepseek-ai/dsh-tool-bash-persistent",
    "presets": ["preset-minimal"]
  }
}
```

- **KHÔNG** `gbh.row`, **KHÔNG** `gbh.row_unmounted_ly_do`: stock không có row TOP-LEVEL nào ⇒ **không bịa row** (luật §4f/§4d).
- `kind: 'preset'` (không phải `'group'`): entry nằm trong `config.plugins` của preset ⇒ `agent-preset-registry`
  (`rewriteNestedNames`) thay `name` lúc chạy, giữ nguyên `id`/`config`/`disabled`/`group` ở mọi độ sâu. Đã kiểm bằng
  chính hàm thật trên `config.plugins` của `preset-minimal` (dump-now2): **1 entry** `persistent-bash` đổi
  `name` → `@galaxy-blackhole/gbh-tool-bash-persistent`, `id`/`disabled`/`config` giữ nguyên, nhóm `persistent-shell`
  giữ `group: true` + `isolate.terminals: true`.
- Khai `'group'` là SAI ĐỊA CHỈ: `apps/cli/src/profile.ts` chỉ quét kernel **bundle patch** (manifest `dsh.bundle.patch`)
  cộng parity template — nó thấy `persistent-bash` trong `@deepseek-ai/dsh-sdk-minimal/cordis.patch.yml:140` (insert
  top-level, KHÔNG có nhóm cha) nên fail-soft đúng dòng log
  `[bh] row nhom: khong thay row cha cua @deepseek-ai/dsh-tool-bash-persistent ⇒ bo qua (fail-soft)` (dump-now2 dòng 16),
  trong khi row THẬT của app nằm trong `config.plugins` của `preset-minimal` — chỉ đường registry mới thấy.
- `presets: ["preset-minimal"]` = **ID ROW preset** đo được (không phải id nhóm `persistent-shell`, cũng không phải `minimal`).
- Entry **không có** `inject`; `disabled` là biểu thức `!!js process.platform === 'win32'` ⇒ **nếu sau này FLIP sang
  row** thì khai `row.disabled = true` (chỉ tắt trên win32; nền tảng khác BẬT). Ở dạng `nested`, metadata KHÔNG có khoá
  `disabled` — biểu thức vẫn nằm nguyên trong dump/patch preset.
- §4f: stock **MỘT MẶT** — `package.json` stock không có `dsh.client`, không có export `./client`; ba khoá exports
  (`.`, `./locale/*.json`, `./package.json`) khớp bản ta (thiếu điều kiện `types` — nợ kỹ thuật bên dưới).

### Trạng thái: **CHƯA mount / CHƯA flip**

Chưa copy gói vào profile, chưa sửa dump/patch, chưa chạy `check:rows` cho mount, chưa restart app.
`gbh.nested` mới là **KHAI BÁO metadata** — chưa có hiệu lực lúc chạy.

## Số đo

| Phép đo | Kết quả |
|---|---|
| build (cổng byte) | **16.069 B · delta 0** · sha256 `e5da0d699ca999f7372cc67ae913b1b881362b3232f5b01b003709e76390bc82` · `cmp` với stock = **IDENTICAL** · 394 dòng |
| test A/B | **20 ca / 194 expect / 0 fail** (`tests/host/tool-bash-persistent.test.ts`) — so CẢ stock lẫn ours trên cùng giàn |
| Context | cordis THẬT; PTY/process **GIẢ 100%** (handle pid/kill/signal/onData/exitCode/timeout) — không shell/spawn/mạng thật |
| kiểm cơ chế | `rewriteNestedNames` (hàm THẬT của `agent-preset-registry`) trên `config.plugins` của `preset-minimal` (dump-now2): đổi đúng **1** `name` sang gói ta, giữ `id`/`disabled`/`config` + `group`/`isolate` của nhóm |
| tsc | `tsc -p tsconfig.json` (`tsconfig.json` thêm 19/10/2026: `src/**/*.ts` + `build.ts`) = **0 lỗi** |
| lint scoped | header · file-length · jsdoc · dep-guard = **0 vi phạm / 0 cảnh báo** (6 file nguồn, chạy qua `GBH_LINT_ROOT`) |
| locale | en/zh byte-for-byte với stock |

## Đường lùi (nếu mount làm treo phiên)

1. Xoá khối `gbh.nested` khỏi `packages/host/tool-bash-persistent/package.json` (giữ file, chỉ bỏ khai báo).
2. `bun run apps/cli/src/main.ts host --dump-config` (BẮT BUỘC: patch regen; nếu không, overlay cũ còn khối insert).
3. `scripts/restart-host.sh` → app về row stock.

## Nợ kỹ thuật

- Lát giữ `// @ts-nocheck` (asset nguyên văn); `src/parts/part-00.ts` 406 dòng và artefact `lib/index.js` 394 dòng — đều ≤1000.
- Không copy `lib/types`/exports `./src/*` của stock (đề chốt 3 khoá exports, nguồn chỉ `lib/index.js`) ⇒ exports `.`
  của ta thiếu điều kiện `types`.
- Cùng stock id còn ở `packages/host/bundle-sdk-minimal/cordis.patch.yml:147` (bản sao từ
  `@deepseek-ai/dsh-sdk-minimal/cordis.patch.yml:140`) — insert top-level của bundle SDK-minimal, bundle này KHÔNG có
  trong dump-now2 ⇒ `gbh.nested` không phủ; nếu sau này mount SDK-minimal phải xử lý riêng (sửa patch của bundle đó).
- Gói anh em `packages/host/tool-pwsh-persistent` khai `kind:'group'` cho cùng hình dạng (row `persistent-pwsh` trong
  `persistent-shell` của preset-minimal) — ngoài phạm vi gói này; cần task riêng nếu muốn đồng bộ.
