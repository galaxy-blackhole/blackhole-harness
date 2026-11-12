<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port @deepseek-ai/dsh-app-boot → gbh-app-boot: kernel boot library, ghép 7 lát nguyên văn + worker JS copy nguyên văn, cổng byte delta 0, KHÔNG mount
-->

# @galaxy-blackhole/gbh-app-boot — kernel boot library (`draft`)

Port 1:1 `@deepseek-ai/dsh-app-boot` **0.2.1-alpha.4** (`lib/index.js` **4.566 dòng / 203.572 B**, 21 region) thành **7 lát
NGUYÊN VĂN** + copy **NGUYÊN VĂN** `lib/worker/profile-resolution-bootstrap.js`.

## Vì sao `draft` + KHÔNG mount
Đây là **thư viện boot của kernel** (profile resolution, loader, bundles, config-schema), không phải row trong composition.
Grep `name: '@deepseek-ai/dsh-app-boot'` trong dump = **0 match** ⇒ khai `gbh.draft`; **không** `gbh.row`; không mount/flip.
Nghiệm thu bắt buộc: **cổng byte delta 0** + **boot-smoke 6 chỉ số** trong home CÁCH LY (sai ở lib boot là chết boot).

## Số đo TRƯỚC → SAU
| Phép đo | KẾT QUẢ |
|---|---|
| `lib/index.js` | **203.572 B · `cmp` IDENTICAL stock** · sha256 `5135179ac810e4f626f32ec3bdc3293dc7d2028e8aa92e5e0c006f1a33b78e76` |
| `lib/worker/profile-resolution-bootstrap.js` | **byte-identical** stock |
| Subpath `./worker/profile-resolution-bootstrap` | mirror trong exports, import chạy được |
| export surface | 30+ tên khớp stock (kể cả hằng `DEFAULT_PROFILE_BUNDLES`/`PROFILE_TEMPLATES`/`ON_DEMAND_BUNDLES`) |
| test A/B | **10 ca / 0 fail** |
| provenance | `{ stock: '@deepseek-ai/dsh-app-boot', version, sha }` |

## Ghi chú build
`buildPackage(outDir?)` ghép 7 lát, **ném nếu lệch 1 byte**, rồi copy worker + so từng byte; idempotent.
**Không có sai lệch có chủ đích** — byte gate delta 0 tuyệt đối (điều kiện Lead đặt trước).
