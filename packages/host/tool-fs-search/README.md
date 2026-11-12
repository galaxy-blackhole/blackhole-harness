<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port dsh-tool-fs-search → gbh-tool-fs-search: row LỒNG preset (gbh.nested kind:'preset'), de-bundle 2 lát
      nguyên văn + CỔNG BYTE delta 0, test A/B trên Context cordis thật (không mạng)
-->

# gbh-tool-fs-search — row LỒNG trong preset (dsh-tool-fs-search)

Port 1:1 `@deepseek-ai/dsh-tool-fs-search` (`lib/index.js` **1272 dòng**, bundle MỘT khối, single-faced) thành **2 lát
NGUYÊN VĂN** ghép lại có **CỔNG BYTE delta 0** — không port typed.

## Vị trí row (LỒNG, KHÔNG phải gbh.row)
Plugin nằm trong `config.plugins` của các preset; top-level row của stock đã `disabled: true` bởi patch dsh-web-app.
`gbh.nested = { kind: 'preset', pluginId: 'tool-fs-search', stockId: '@deepseek-ai/dsh-tool-fs-search', presets: ["preset-standard","preset-ptc","preset-cordis"] }` — **KHÔNG** khai `gbh.row`.
Presets ĐO TỪ DUMP `.parity/dumps/2026-10-18T01-31-57/ours.yml`.

## Số đo
| Phép đo | Kết quả |
|---|---|
| build (cổng byte) | **55.688 B · delta 0** · sha256 `8d64d2e8a5310b442ae66bc0daf7d6957ec095dbe43cabd9eb208f7370e381ed…` |
| test A/B | **25 ca / ? expect / 0 fail** (tests/host/tool-fs-search.test.ts) |
| tsc scoped | build.ts + assemble.ts + manifest.ts **0 lỗi** |
| locale | en/zh byte-for-byte từ stock |

## Nợ kỹ thuật
- Lát giữ `// @ts-nocheck` (precedent api-terminal-controller/session-persistence) vì là asset nguyên văn.
- Không copy `lib/types/*.d.ts`, không khai `devDependencies` (chỉ `dependencies` + `peerDependencies` đúng range stock).
- Row LỒNG: cần Lead mount preset để kiểm tool xuất hiện trong phiên (không có boot-smoke riêng cho nested row).
