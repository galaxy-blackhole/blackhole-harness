<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc NỬA HOST của row typert — nguồn đối chiếu G4, vì sao CHỈ nửa host + KHÔNG khai gbh.row, số đo
-->

# @galaxy-blackhole/gbh-typert-registry (NỬA HOST)

Bản viết lại **1:1** phần **HOST** của `@deepseek-ai/dsh-typert-registry`: **sổ đăng ký lúc chạy** cho
reflection Typert đã sinh (schema Zod + mô hình package), **định nghĩa lời gọi Remote**, và **năm nhà cung
cấp đảo phụ thuộc** (tra cứu · Context Host/Client · kiểu tài nguyên). Sổ này **không** phân tích TypeScript,
**không** sinh schema.

## 0. Vì sao CHỈ nửa host và **KHÔNG** khai `gbh.row`

Row `typert` **đang BẬT** (`.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng 32–33) và gói gốc là gói **HAI
MẶT**: `dsh.client = { inject: [], platform: "web", immediately: true }` với **HAI** bản client
(`lib/client.browser.js` **655** dòng + `lib/client.node.js` **645** dòng) + `lib/types/client/*`.
Cặp `disable + insert` sẽ **xoá nửa client** khỏi đồ thị boot (sự cố typert-gateway: 63 entry pending, trang
**68 B**) ⇒ **KHÔNG mount được** cho tới khi có nửa client ⇒ gói **không khai `gbh.row`** (`gbh.draft` ghi rõ).

**Kiểm trùng tên TRƯỚC khi viết**: khoá service `typert` **chỉ** gói này cấp; hai gói đã port
(`api-job-controller` · `api-workspace-files`) **gọi vào** seam này (`ctx.typert.lookups.register`) nên hình
dạng phải khớp — đó là lý do gói này port sát từng thông điệp lỗi.

## 1. Nguồn đối chiếu (G4)

| Hành vi | Bản gốc (`lib/index.js`) | Bản của ta (`src/`) | Bằng chứng |
|---|---|---|---|
| Tập export | `TypertRegistry · default · typertEndpoint · typertKey · typertPackageKey` | **bằng** (5 = 5) | đo trên ARTIFACT |
| Khoá service | `super(ctx, "typert")` | y nguyên | dựng service |
| Năm khung nhìn | `local` · `remotes` · `lookups` · `contexts` · `resources` với **đúng** bộ phương thức (`get/hasSeen/list/subscribe`, `register/get/list/subscribe`, `register/configure/get/definitions/keys/subscribe`, `registerHost/configureHost/registerClient/getHost/getClient/subscribe`, `register/get/entries/subscribe`) | y nguyên | `Object.keys().sort()` **bằng** 5/5 |
| `register()` | đóng góp NGUYÊN TỬ: package-face + schema + lời gọi; trùng ⇒ từ chối **cả lô**; dọn ⇒ sạch | y nguyên | get/list/getPackage/listPackages + dọn **bằng** |
| Thông điệp lỗi | `typert: package face "X" is already registered` · `typert: schema "X" is already registered` · `typert: invalid face "server" — expected "host" or "client"` · 3 thông điệp `resolve()` | y nguyên **từng chữ** | 7 thông điệp **bằng** |
| `toJSONSchema()` | chiếu Zod sang JSON Schema, **KHÔNG** nhớ đệm | y nguyên | `first !== second`, `type: "object"` |
| `lookups` | `register` + `configure` ghép thành nhà cung cấp hiệu lực; trùng ⇒ ném; **đổi khai báo dây trong một vòng đời ⇒ ném** | y nguyên | 3 thông điệp + hình dạng ghép **bằng** |
| `contexts` | `registerHost`/`configureHost` ghép; `registerClient`/`getClient`; trùng ⇒ ném | y nguyên | **bằng** |
| `resources` | `register`/`get`/`entries`; `"global"` **bị giữ**; trùng ⇒ ném | y nguyên | **bằng** |
| Phát thay đổi | listener theo fiber; register ⇒ `local:demo/one`; thu hồi ⇒ phát lại; `resource:session` | y nguyên | thứ tự `["local:demo/one","resource:session","local:demo/one","resource:session"]` **bằng** |

## 2. Peer và lý do

| Peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 (kernel) | `Service` — **nạp lúc chạy** (lớp cơ sở), không chỉ kiểu |
| `@deepseek-ai/dsh-typert-protocol` | 2 (seam RPC) | **chỉ mượn KIỂU** (`TypertLocalRegistry`… và `InvocationDescriptor`) |
| `zod` | 1 (kernel) | `z.toJSONSchema` — **nạp lúc chạy**; schema phải CÙNG realm zod với bên tiêu thụ |

⇒ `gbh.peers` = 2 tên **⊆ `peerDependencies`**; `dependencies` **RỖNG**. Bốn khung nhìn ép kiểu **một lần ở
biên** sang hợp đồng của kernel (hợp đồng dùng kiểu tổng quát theo từng khoá; sổ này giữ kiểu cấu trúc hẹp).

## 3. Test — 12 ca · 48 expect · 0 fail

```bash
~/.bun/bin/bun test tests/host/typert-registry.test.ts
```

Giàn đo: **Context cordis THẬT** + `effect` dạng **GENERATOR** đúng như kernel (chạy thân tới `yield`, giữ hàm
dọn) + logger ghi vết. **Cùng một giàn** cho bản của ta và **bundle gốc**.

| Nhóm | Số ca | Đo cái gì |
|---|---|---|
| Bề mặt + dựng service | 2 | export (5 = 5) + 3 hàm khoá · 5 khung nhìn với đúng bộ phương thức |
| `register`/`resolve`/`toJSONSchema` | 4 | đăng ký–liệt kê–lọc–dọn · 3 lỗi trùng/face · 3 lỗi resolve · chiếu JSON Schema không nhớ đệm |
| tra cứu/Context/tài nguyên/thay đổi | 4 | ghép resolve · ghép Context · `global` bị giữ · thứ tự phát thay đổi |
| Quy ước repo | 2 | **không `gbh.row`** + 5 đối chứng dương gói HAI MẶT · peers + locale byte-for-byte |

## 4. TRƯỚC / SAU

| | TRƯỚC (row gốc, đang bật) | SAU (gói này) |
|---|---|---|
| Row trong app | `typert` = `@deepseek-ai/dsh-typert-registry` (bật, hai mặt) | **không mount** — chưa khai `gbh.row` |
| Nửa host | `lib/index.js` 632 (+ `lib/types/service.js` 668 bản trùng) | **`src/` 4 tệp** (`service` · `stores` · `types` · `index`), cùng bề mặt host |
| Tập export | 5 tên | **bằng** (5 = 5) |
| Test | — | **12 pass / 0 fail / 48 expect** |

## 5. Phần CHƯA làm (nói thẳng)

1. **HAI bản client** (`client.browser.js` 655 + `client.node.js` 645 + `lib/types/client/*`) — chưa có ⇒
   **không mount được**.
2. `declare module` khai `TypertRegistryContract` của bản gốc chưa được thay bằng cơ chế có kiểu (repo cấm
   `declare module`) — hiện ép kiểu tại biên khung nhìn; cần làm rõ khi nối Gateway.
3. Chưa đo đường thật qua Gateway (cần nửa client).

## 7. Bản viết tay cũ (giữ lại 19/10/2026)

Trước khi de-bundle, gói này là bản **viết tay** 4 module (`index` · `service` · `stores` · `types`). Nay chuyển nguyên văn vào
`src-handwritten/` — không build, không nằm trong artefact (quyết định của Lead: không xoá công người trước).

## 8. Đo đạc khoá (19/10/2026)

- **Ai cấp service `typert`**: grep toàn kernel ⇒ **DUY NHẤT** `@deepseek-ai/dsh-typert-registry/lib/index.js`. `typert-gateway` của ta cấp
  `typertGateway` (tên KHÁC) ⇒ không xung đột. Bản viết tay cũ của gói này cũng `super(ctx, "typert")` ⇒ nay artefact de-bundle giữ đúng vai trò đó.
- **Client KÉP** (mô hình mới của repo): `lib/client.browser.js` là script classic có `window.__ModuleLoader__.load` (đổi **đúng dòng 2** ⇒ **+5 B**,
  còn 1 id stock ở dòng 14 là JSDoc `@module` — giữ nguyên); `lib/client.node.js` là **ESM thuần** (không loader, id stock chỉ trong JSDoc) ⇒ **byte-identical**.
- `exports['./client']` giữ **NGUYÊN 3 nhánh**: `node` → `client.node.js` · `browser` → `client.browser.js` · `default` → `client.browser.js` (Lead chốt 19/10).
- `dsh.client = { inject: [], platform: 'web', immediately: true }` ⇒ nửa client nạp NGAY khi web boot: artefact hỏng là web chết ngay, nên cổng ownership ở đây kiểm
  **số lần id ta = 1** (bắt lỗi quên đổi dòng loader) chứ không dựa vào 'không còn id stock'.
