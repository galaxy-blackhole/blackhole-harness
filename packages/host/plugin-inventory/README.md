<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-host-plugin-inventory — ban viet lai cua dsh-host-plugin-inventory
-->

# @galaxy-blackhole/gbh-host-plugin-inventory

Bản viết lại của Galaxy Blackhole cho row `plugin-inventory`: service remote `pluginInventory` với một endpoint `list`,
trả ảnh chụp trạng thái entry hiện tại của cây Loader (không cache — đọc thẳng mỗi lần gọi).

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Hợp đồng hành vi + kiểu dữ liệu | `@deepseek-ai/dsh-host-plugin-inventory@0.2.1-alpha.4` — `lib/types/index.d.ts` + `types.d.ts` (đọc trong `apps/host/node_modules`, chỉ đọc) |
| Cơ chế đăng ký remote | seam `@deepseek-ai/dsh-typert-protocol`: `TypertRemoteService` + decorator `@Remote("list")`, `serviceKey = "pluginInventory"` |
| Trạng thái fiber | cordis `FiberState` là **enum SỐ**: PENDING=0 · LOADING=1 · ACTIVE=2 · FAILED=3 · DISPOSED=4 (⇒ `null`) · UNLOADING=5 |
| Cơ chế thay row | cặp disable + insert, metadata `gbh` trong package.json — [ADR 0004](../../../docs/ADR/0004-mount-package-cua-ta-vao-profile.md) §2 và §11 |
| Test hành vi | `tests/host/plugin-inventory.test.ts` (7 test, có ca BYTE theo §8) |

**Vì sao cần peer `@deepseek-ai/dsh-typert-protocol`** (luật §3b của `packages/README.md`): lớp gateway phải kế thừa
đúng base class của seam RPC để Gateway của kernel discovery được; khai là `peer` (không bao giờ là dependency) và khai trong
`gbh.peers` để mount symlink nó về bản kernel đang chạy — đúng MỘT instance. Ở M3 kernel của ta phơi cùng tên gói đó.

## Bằng chứng SAU (bảng do Lead đo độc lập trên app đang chạy)

| Chỉ số | TRƯỚC (DSH stock) | SAU (gói của ta) | Diễn giải |
|---|---|---|---|
| HTTP | 200 | **200** | ok |
| `result.ok` | true | **true** | ok |
| Kích thước | 125.693 B | **126.011 B** | +318 B, hợp lý |
| Số entry | 215 | **216** | +1 = đúng row `plugin-inventory-ours` được insert |
| `fiberPhase: active` | 178 | **178** | **KHÔNG ĐỔI — điểm quan trọng nhất** |
| `enabled: false` | 37 | **38** | +1 = đúng row stock bị disable |
| Khoá snapshot | entries · agentPresets · managementAvailable | **y hệt** | hình dạng không đổi |

Tự đo lại (17/10/2026, sau khi peer typert được symlink): `entries = 216 · active = 178 · disabled = 38` ✓ khớp bảng trên.

Cách tái lập (envelope: `method` dạng gạch chéo và `payload` bọc đúng một trường `args`):

```bash
URL=$(cat ~/.galaxy/blackhole/ready-url.txt)
curl -sL -c /tmp/j.txt -b /tmp/j.txt -o /dev/null "$URL"
printf '%s' '{"type":"client-request","rpcId":"probe","method":"pluginInventory/list","payload":{"args":{}}}' > /tmp/b.json
curl -s -c /tmp/j.txt -b /tmp/j.txt -X POST -H 'content-type: application/json' \
  --data-binary @/tmp/b.json http://127.0.0.1:5439/api/pluginInventory/list
```

## Ca an ninh / lỗi (đã đo)

| Ca | Kết quả |
|---|---|
| Không cookie | **401** (thân 12 B, không rò dữ liệu) |
| Endpoint không tồn tại (`pluginInventory/khongCo`) | **404** `not found` — lỗi rõ ràng, không treo |

## Khác biệt đã giải thích (không do gói này)

- Hai id entry đổi giữa các lần boot là **cặp động của `directory-picker`** (`dsh-host-directory-picker-native` + `dsh-client-ui-directory-picker-native`) — chooser mount runtime với id ngẫu nhiên mỗi lần boot, cùng hai module.
- Preset `custom` xuất hiện ở lượt TRƯỚC rồi biến mất: đó là **trạng thái trên đĩa** (`~/.galaxy/blackhole/.agent-presets/custom/…`, nay không còn tồn tại), không phải hành vi của gói này (gói chỉ ĐỌC cây Loader).

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-host-plugin-inventory` (shasum `en c16579da05f8...` · `zh d1b18974f7f1...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
