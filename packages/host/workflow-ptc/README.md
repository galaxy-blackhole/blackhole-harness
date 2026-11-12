<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port dsh-workflow-ptc → @galaxy-blackhole/gbh-workflow-ptc: row LỒNG (`gbh.nested = { kind:'group', pluginId:'optional-ralph-workflow', stockId:'@deepseek-ai/dsh-workflow-ptc', presets:['optional-ralph'] }` — stock nằm ở **HAI nơi**: (a) group TOP-LEVEL `optional-ralph` (có `isolate.workflowEngine: true`) → **khối patch 2 pha**; (b) plugin trong `config.plugins` của preset-standard/ptc/cordis → **registry runtime** (sau khi bỏ skip kind group ở lỗ hổng #2). Test chứng minh cả 2 nhánh.), de-bundle nguyên văn
      + CỔNG BYTE delta 0, test A/B trên Context cordis thật (không mạng/không shell thật)
-->

# @galaxy-blackhole/gbh-workflow-ptc — row LỒNG (dsh-workflow-ptc)

Port 1:1 `@deepseek-ai/dsh-workflow-ptc` (`lib/index.js` **670 dòng**, single-faced) thành lát NGUYÊN VĂN ghép lại có
**CỔNG BYTE delta 0**.

## Vị trí row (LỒNG, KHÔNG phải gbh.row)
`gbh.nested = { kind:'group', pluginId:'optional-ralph-workflow', stockId:'@deepseek-ai/dsh-workflow-ptc', presets:['optional-ralph'] }` — stock nằm ở **HAI nơi**: (a) group TOP-LEVEL `optional-ralph` (có `isolate.workflowEngine: true`) → **khối patch 2 pha**; (b) plugin trong `config.plugins` của preset-standard/ptc/cordis → **registry runtime** (sau khi bỏ skip kind group ở lỗ hổng #2). Test chứng minh cả 2 nhánh.

## Isolate (ADR 0011)
Khối insert `optional-ralph-ours` GIỮ `isolate: { workflowEngine: true }` — mất isolate là mất cách ly engine.

## Số đo
| Phép đo | Kết quả |
|---|---|
| build (cổng byte) | **66.267 B · delta 0** · sha256 `c7718bc3…` · `cmp` với stock = IDENTICAL |
| test A/B | **23 ca / 311 expect / 0 fail** |
| Context | cordis THẬT; seam/process GIẢ 100% — không mạng, không spawn/shell thật |
| tsc scoped | `build.ts` + `src/assemble.ts` + `src/manifest.ts` = 0 lỗi |

## Đường lùi (nếu mount làm hỏng phiên)
1. Bỏ khối `gbh.nested` trong `packages/host/workflow-ptc/package.json`.
2. `bun run apps/cli/src/main.ts host --dump-config` (BẮT BUỘC — patch regen, nếu không overlay cũ còn khối insert).
3. `scripts/restart-host.sh`.

## Nợ kỹ thuật
- Lát giữ `// @ts-nocheck` (asset nguyên văn); `lib/index.js` là artefact sinh tự động.
- Không ship `.d.ts`/`lib/types/index.js` hay subpath `./src/*`; exports mirror đúng các subpath RUNTIME stock có.
