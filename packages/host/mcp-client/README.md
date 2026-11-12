<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port @deepseek-ai/dsh-mcp-client → gbh-mcp-client: 1 lát nguyên văn, cổng byte delta 0, test hành vi createMcpToolDefinition, draft
-->

# @galaxy-blackhole/gbh-mcp-client — host plugin (`draft`)

Port 1:1 `@deepseek-ai/dsh-mcp-client` **0.2.1-alpha.4** (`lib/index.js` **835 dòng / 25.5 KB**): copy NGUYÊN VĂN, **cổng byte delta 0**
(sha256 `758d8fc473b700b5d351158d06ce9f9e92c16e8b25497b08bb7bd2122a87f5dd`). Dump 0 row ⇒ `gbh.draft`, không mount/flip.

| Phép đo | KẾT QUẢ |
|---|---|
| artifact | **byte-identical** stock (cmp + sha) |
| export surface | `{Config, apply, createMcpToolDefinition, inject, name}` khớp |
| **hành vi thật** | `createMcpToolDefinition`: metadata · `output.render` · `taskRequired` lỗi · kết quả MCP không hợp lệ · execute thành công — tất cả A≡B |
| test A/B | **11 ca / 0 fail** |
| provenance | `{stock, version, sha}` |

## Nợ kỹ thuật
- Không ship `.d.ts`/`./src/*`; exports chỉ `.` + `./package.json`.
