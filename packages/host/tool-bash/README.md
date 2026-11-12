<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port dsh-tool-bash → gbh-tool-bash: row LỒNG preset (gbh.nested kind:'preset'), de-bundle 1 lát
      nguyên văn + CỔNG BYTE delta 0, test A/B trên Context cordis thật (không mạng)
-->

# gbh-tool-bash — row LỒNG trong preset (dsh-tool-bash)

Port 1:1 `@deepseek-ai/dsh-tool-bash` (`lib/index.js` **731 dòng**, bundle MỘT khối, single-faced) thành **1 lát
NGUYÊN VĂN** ghép lại có **CỔNG BYTE delta 0** — không port typed.

## Vị trí row (LỒNG, KHÔNG phải gbh.row)
Plugin nằm trong `config.plugins` của các preset; top-level row của stock đã `disabled: true` bởi patch dsh-web-app.
`gbh.nested = { kind: 'preset', pluginId: 'tool-bash', stockId: '@deepseek-ai/dsh-tool-bash', presets: ["preset-standard","preset-ptc","preset-cordis"] }` — **KHÔNG** khai `gbh.row`.
Presets ĐO TỪ DUMP `.parity/dumps/2026-10-18T01-31-57/ours.yml`.

## Số đo
| Phép đo | Kết quả |
|---|---|
| build (cổng byte) | **28.064 B · delta 0** · sha256 `a1215d7bcaf82c0755be48321ef6bb45075f1cb33296d6263009e9d10fd596f6…` |
| test A/B | **21 ca / ? expect / 0 fail** (tests/host/tool-bash.test.ts) |
| tsc scoped | build.ts + assemble.ts + manifest.ts **0 lỗi** |
| locale | en/zh byte-for-byte từ stock |

## Nợ kỹ thuật
- Lát giữ `// @ts-nocheck` (precedent api-terminal-controller/session-persistence) vì là asset nguyên văn.
- Không copy `lib/types/*.d.ts`, không khai `devDependencies` (chỉ `dependencies` + `peerDependencies` đúng range stock).
- Row LỒNG: cần Lead mount preset để kiểm tool xuất hiện trong phiên (không có boot-smoke riêng cho nested row).
