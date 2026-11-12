<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port dsh-tool-terminal → @galaxy-blackhole/gbh-tool-terminal: ROW LỒNG cordis:group (gbh.nested kind:'group'),
      de-bundle nguyên văn + CỔNG BYTE delta 0, test A/B dùng PTY/process GIẢ 100%
-->

# @galaxy-blackhole/gbh-tool-terminal — row LỒNG group (`dsh-tool-terminal`)

Port 1:1 `@deepseek-ai/dsh-tool-terminal` (`lib/index.js` **654 dòng**, bundle MỘT khối, single-faced) thành lát NGUYÊN VĂN
ghép lại có **CỔNG BYTE delta 0** — không port typed, không sửa thân bundle.

## Vị trí row (LỒNG, KHÔNG phải gbh.row)
`gbh.nested = { kind: 'group', pluginId: 'optional-tool-terminal', stockId: '@deepseek-ai/dsh-tool-terminal', presets: ["optional-persistent-terminals"] }`.
`presets` ở đây là **ID NHÓM** `cordis:group` (không phải preset id): `persistent-shell` nằm trong `config.plugins`
của preset (xử lý RUNTIME bởi `agent-preset-registry`), `optional-persistent-terminals` là nhóm TOP-LEVEL (xử lý bằng
khối patch của `renderGroupRewriteBlocksSingle` 2 pha). Cả hai nhóm đều có `isolate.terminals: true` — khối insert giữ nguyên `isolate`.

## Số đo
| Phép đo | Kết quả |
|---|---|
| build (cổng byte) | **20.052 B · delta 0** · sha256 `e7584529…` · `cmp` với stock = IDENTICAL |
| test A/B | **19 ca / 174 expect / 0 fail** (`tests/host/tool-terminal.test.ts`) |
| Context | cordis THẬT; PTY/process **GIẢ 100%** (handle pid/kill/signal/onData/exitCode/timeout) — không shell/spawn thật |
| tsc scoped | `build.ts` + `src/assemble.ts` + `src/manifest.ts` = 0 lỗi (tsc 5.9 · bun runtime) |
| locale | en/zh byte-for-byte với locale của **bundle nhóm** `@deepseek-ai/dsh-experimental-terminal-bundle` (stock row KHÔNG có locale) |

## Đường lùi (nếu mount làm treo phiên)
1. Xoá khối `gbh.nested` khỏi `packages/host/tool-terminal/package.json` (giữ file, chỉ bỏ khai báo).
2. `bun run apps/cli/src/main.ts host --dump-config` (BẮT BUỘC: patch regen; nếu không, overlay cũ còn khối insert).
3. `scripts/restart-host.sh` → app về row stock.

## Nợ kỹ thuật
- Lát giữ `// @ts-nocheck` (asset nguyên văn). Artefact 654 dòng; giới hạn 1000 áp cho tệp nguồn (`part-00.ts` 667 dòng).
- Không copy `lib/types`/exports `./src/*` của stock (đề chốt 3 khoá exports, nguồn chỉ `lib/index.js`).
