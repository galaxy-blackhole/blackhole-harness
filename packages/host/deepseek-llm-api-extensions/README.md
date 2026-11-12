<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-deepseek-llm-api-extensions — bảng nguồn đối chiếu G4, lý do peer, 5 câu hỏi, bảng TRƯỚC/SAU, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-deepseek-llm-api-extensions

Bản viết lại của Galaxy Blackhole cho row **`deepseek-llm-api-extensions`** của DSH
(`@deepseek-ai/dsh-deepseek-llm-api-extensions`, bundle MỘT FILE **110 dòng** `lib/index.js`, đọc từ
`apps/host/node_modules/@deepseek-ai/dsh-deepseek-llm-api-extensions/` — **CHỈ ĐỌC**).

**Vai trò**: **mở rộng API LLM DeepSeek**. Đây là **sổ đăng ký**: mỗi plugin đóng góp sở hữu **MỘT trường
top-level độc lập** của thân request DeepSeek (`thinking`, `cache`, …), còn adapter chính thức chạy
**MỘT giao dịch chuẩn bị (`prepare`) + chấp nhận (`accept`) chung** cho mọi trường của một request.

> ⚠️ **Gói CHƯA khai `gbh.row`** — boot do Lead thực hiện (đúng luật *"KHAI `gbh.row` = NHẬN RỦI RO MOUNT"*).
> Gói **không thể làm hỏng app**: `bh host` chỉ sinh patch từ package CÓ `gbh.row`, và `check:rows` chỉ
> kiểm package CÓ `gbh.row`.

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| lớp `DeepSeekLlmApiExtensionRegistry` | `lib/index.js` dòng 36–108 | `src/registry.ts` | dựng **cả hai** bản cài trên **Context cordis THẬT** (mỗi bản một `Context`) rồi so từng hành vi — 12 ca |
| `register(field, provider)` | `lib/index.js` dòng 45–62 · `lib/types/index.d.ts` dòng 22 | `src/registry.ts` | cùng câu lỗi cho tên rỗng/khoảng trắng/đăng ký trùng; cùng phạm vi `ctx.effect`; hàm dọn trả về **giải phóng đúng trường** ở cả hai bên |
| `prepare(request)` | `lib/index.js` dòng 63–107 | `src/registry.ts` | cùng `fields` (kể cả **prototype `null`** + đóng băng), cùng thứ tự + `this` của lời chốt, cùng cảnh báo |
| `freezeJson` | `lib/index.js` dòng 8–14 | `src/registry.ts` | ca "nhân bản + đóng băng": sửa object gốc sau `prepare` **không** đổi `fields`; mọi tầng đều `Object.isFrozen` |
| `acceptAll` | `lib/index.js` dòng 16–23 | `src/registry.ts` | 0 lỗi ⇒ `accept()` không ném và **gọi lặp lại không chốt lại**; 1 lỗi ⇒ **đúng lý do đó**; 2 lỗi ⇒ `AggregateError` cùng thông điệp |
| `abortable` | `lib/index.js` dòng 25–34 | `src/registry.ts` | tín hiệu đã huỷ ⇒ ném **ngay** (đồng bộ, trước khi gọi provider); huỷ GIỮA lúc chờ ⇒ ném `signal.reason` |
| `warnedFields` | `lib/index.js` dòng 39 | `src/registry.ts` | trường hỏng ghi cảnh báo **MỘT lần**, lần hỏng sau im lặng — cùng chuỗi định dạng `%o` |
| kiểu dữ liệu (`lib/types/types.d.ts`) | 49 dòng, 6 kiểu | `src/types.ts` | chép **ngữ nghĩa** từng kiểu; chỉ mượn kiểu, không import gói nào |
| `declare module "@deepseek-ai/cordis"` | `lib/types/index.d.ts` dòng 9–13 | `src/index.ts` | **module augmentation** (có thân, hợp nhất `interface Context`) — KHÔNG phải shim ambient (luật 000d-2); cùng khuôn 10 gói host khác của ta |
| tập export lúc chạy | `export { DeepSeekLlmApiExtensionRegistry, … as default }` | `lib/index.js` | **đo trên ARTIFACT**: tập tên export của ta **BẰNG ĐÚNG** tập gốc — `DeepSeekLlmApiExtensionRegistry` + `default` (0 thiếu · 0 thừa) |
| `locale/{en,zh}.json` | `locale/en.json` · `locale/zh.json` | `locale/*.json` | chép **byte-for-byte** — `shasum` hai bên khớp `689c5a08…` / `bd494542…` (luật 000e) |
| **hợp đồng với gói khác** | `dsh-llm-deepseek/lib/index.js` dòng 2306 (`prepareExtensions`) · `dsh-session-log-deepseek` dòng 139 · `dsh-plugin-package-inventory-deepseek` dòng 146 | (không đổi) | **ĐO ĐƯỢC**: adapter gọi `ctx.get("deepseekLlmApiExtensions")?.prepare(request)`; hai gói đóng góp đăng ký trường `dsh_session_log` / `dsh_plugin_packages`. Test dựng **đúng hình dạng** hai nhà cung cấp đó trên CẢ HAI bản cài |

## 2. Peer — vì sao, và thuộc seam nào

| Peer | Vì sao thuộc seam | Ghi chú |
|---|---|---|
| `@deepseek-ai/cordis` | vòng đời plugin + `Service` · `ctx.effect` · `ctx.logger` | bảng §3b. **Bản gốc cũng chỉ khai đúng peer này** (`~4.0.5-alpha.2`); ta khai `~4.0.5` theo quy ước repo. Bản gốc **kế thừa lớp `Service` THẬT** của kernel, nên phải là **CÙNG một lớp** — test khẳng định `Object.getPrototypeOf(OurClass) === Object.getPrototypeOf(StockClass)` |

`gbh.peers = ["@deepseek-ai/cordis"]` ⊆ `peerDependencies` (**so PHẦN TỬ**, có **đối chứng âm**: một peer
giả không có trong `peerDependencies` **phải** bị phép kiểm bắt). Không có peer nào khác: gói **không**
phục vụ route, **không** dùng `schemastery` (bản gốc không có `Config`), **không** dùng typert.

## 3. Năm câu hỏi bắt buộc

| # | Câu hỏi | Trả lời (đo được) |
|---|---|---|
| 1 | Row có **đang BẬT**? | **CÓ.** `.parity/dumps/2026-10-17T23-54-01/ours.yml` có cặp `- id: deepseek-llm-api-extensions` + `name: '@deepseek-ai/dsh-deepseek-llm-api-extensions'`, **không** `disabled: true`; `presence-table.md` ✓ ở cả ba cột |
| 2 | Thuần host hay có mount surface client? | **Thuần host.** `lib/client.js` **KHÔNG tồn tại** (chỉ `lib/index.js` + `lib/types/`); `dsh.client` = **false** |
| 3 | Cần seam nào? | `@deepseek-ai/cordis` (`Service`, `ctx.effect`, `ctx.logger`) — **trong** bảng §3b. Không `node:` builtin nào |
| 4 | Hành vi đo được là gì? | Service `ctx.deepseekLlmApiExtensions` có mặt trong cây plugin · `register` giữ **một** nhà cung cấp mỗi trường · `prepare` trả `fields` đã nhân bản + đóng băng và `accept()` kết toán **một lần** |
| 5 | Package gốc có `dsh.client`? | **KHÔNG** (`package.json` gốc không có khoá `dsh`) ⇒ **MỘT MẶT** ⇒ thay được bằng disable + insert |

## 4. TRƯỚC/SAU

Chưa có lượt boot lab/mount (thuộc Lead — xem §6). Phép đo **đã chạy** là đối chứng tầng dịch vụ trên
**Context cordis THẬT**, hai bản cài độc lập:

| Phép đo | Bản gốc | Bản của ta |
|---|---|---|
| service sau khi cấp | `ctx.get("deepseekLlmApiExtensions")` ≠ thực thể (cordis bọc) | **y hệt** (`≠`, cùng cơ chế) |
| lớp cha | `Service` của cordis | **CÙNG** lớp (cùng `Object.getPrototypeOf`) |
| `fields` của `prepare` | prototype **`null`**, `Object.isFrozen` = true | **y hệt** |
| đăng ký trùng | `… field "x" is already registered` | **cùng chuỗi** |
| tên rỗng / có khoảng trắng | `… field must be a non-blank trimmed string` | **cùng chuỗi** |

## 5. Test

`bun test tests/host/deepseek-llm-api-extensions.test.ts` — xem số ca/expect trong báo cáo của row.
Bốn lớp ca bắt buộc của recipe (hành vi chính · **byte** → ở đây là **nhân bản + đóng băng** vì gói không
phục vụ route · đường lỗi · vòng đời) **cộng** ba phép kiểm riêng của M6:

* **ARTIFACT**: tập export của `lib/index.js` ta **=** tập của bundle gốc, và `grep -c "id: @deepseek-ai"` = **0**.
* **`gbh.peers ⊆ peerDependencies`** — so **phần tử**, kèm **đối chứng âm** (xoá-một-tên · peers rỗng · thừa tên).
* **C6 (danh tính)**: hai thực thể sổ đăng ký có `providers`/`warnedFields` **ĐỘC LẬP** (`not.toBe`) — phép so
  sâu không bắt được lớp lỗi chia sẻ tham chiếu; sửa vật này **không lan** sang vật kia.

**Không có ca an ninh** (không cookie/401): gói **không đăng ký route HTTP nào** — cùng lý do đã ghi ở các
gói host khác (`llm-retry`, `sandbox-policy`).

## 6. CHƯA làm

1. **Chưa khai `gbh.row`** — chờ lượt boot của Lead (điều kiện: `lab:row` 0 lỗi console · 0 `did not activate`).
2. **Chưa mount / chưa đo TRƯỚC–SAU trên app 5439** — bảng §4 hiện chỉ có phép đo tầng dịch vụ.
3. **Chưa phát hành subpath `./types`** như bản gốc (`exports["./types"]`): bản gốc ship
   `lib/types/types.js` (`export {}`) + `types.d.ts` để **hai gói đóng góp khai kiểu** bằng
   `declare module '@deepseek-ai/dsh-deepseek-llm-api-extensions/types'` (`dsh-session-log-deepseek`,
   `dsh-plugin-package-inventory-deepseek` — đo ngày 18/10/2026). Đó là **tầng KIỂU, 0 require lúc chạy**
   (đo: 0 file `.js` nào import subpath đó), và gói gốc **vẫn còn trên đĩa** nên hai khai báo kiểu đó vẫn
   phân giải được. Gói của ta khai kiểu ngay trong `src/types.ts` + `export type *` từ `src/index.ts`.
