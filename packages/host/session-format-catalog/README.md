<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port @deepseek-ai/dsh-session-format-catalog → gbh-session-format-catalog: thư viện (draft),
      copy NGUYÊN VĂN index + 6 tệp lib/types/*.js + mirror subpath ./message-projections
-->

# @galaxy-blackhole/gbh-session-format-catalog — thư viện (`draft`)

Port 1:1 `@deepseek-ai/dsh-session-format-catalog` **0.2.1-alpha.4**: copy NGUYÊN VĂN `lib/index.js`
(**5.717 B** · sha `836bbb77…`) + **6 tệp** `lib/types/*.js`; exports mirror `.` · `./package.json` · `./message-projections`.
**Không phải row** ⇒ khai `gbh.draft`, KHÔNG `gbh.row`, không mount/boot.

## TRƯỚC → SAU
| Phép đo | TRƯỚC | SAU |
|---|---|---|
| index.js | — | **byte-identical** stock (sha trùng) |
| lib/types/*.js | — | **6/6 byte-identical** |
| export surface | — | 4 export runtime khớp stock |
| subpath `./message-projections` | — | import qua **specifier gói** chạy được |
| provenance | — | `{ stock, version: 0.2.1-alpha.4, sha }` |
| test A/B | — | **≥8 ca** (byte/sha/exports/types/locale/provenance + hành vi readHeader/createRestore + subpath specifier) |

## Đồng bộ
`bun run src/sync.ts` — quét ĐỘNG `lib/types/*.js` + `locale/**`, chép, in `bytes/delta/equal/sha`, đối chiếu
`gbh.provenance.sha` với sha stock, **ném nếu lệch 1 byte**.

## Nợ kỹ thuật
- Không ship `.d.ts`/`./src/*`; exports chỉ các subpath RUNTIME stock có.
- Gói là thư viện nên không có boot-smoke; tiêu chí nghiệm thu là test A/B + sync delta 0.
