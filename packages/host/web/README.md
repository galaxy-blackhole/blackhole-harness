<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-web — bảng nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-web

Bản viết lại của Galaxy Blackhole cho row **`web`** của DSH (`@deepseek-ai/dsh-web`, bundle **MỘT FILE
143 dòng** `lib/index.js`, đọc từ `apps/host/node_modules/@deepseek-ai/dsh-web/` — CHỈ ĐỌC).

**Vai trò**: seam truy cập web **`ctx.web`** — sổ đăng ký provider **tìm kiếm** và **tải về**, phép **CHỌN
provider tại thời điểm gọi** (không phụ thuộc thứ tự đăng ký), từ vựng request/result, và taxonomy lỗi
`WebError`. Row này **không tự gọi mạng**: nó chỉ chọn và gọi provider do row khác đăng ký
(`web-search-deepseek` · `web-fetch-http` · …).

> ✅ **MỘT MẶT** — đã kiểm `lib/client.js` **KHÔNG tồn tại** (`ls lib/` chỉ có `index.js` + `types/`) và
> `dsh.client` vắng trong `package.json` gốc.
>
> ⚠️ **`gbh.row` được khai NGOÀI phiên viết gói** (mtime `07:35:48` — KHÔNG phải phiên này; phiên này giữ nguyên trạng thái KHÔNG khai). Gói **không thể làm hỏng
> app**: `bh host` chỉ sinh patch từ package CÓ `gbh.row`, và `check:rows` chỉ kiểm package CÓ `gbh.row`.
> Ca **test canh** *"CHƯA khai gbh.row"* đã bị **gỡ khỏi file test bởi chính lượt sửa ngoài phiên** đó (file test còn **8 ca**).

## 0. Trả lời năm câu bắt buộc (trước khi viết)

| # | Câu hỏi | Trả lời ĐO ĐƯỢC |
|---|---|---|
| 1 | Row đang BẬT? | **CÓ** — `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng 400–404 có cặp `- id: web` + `name: '@deepseek-ai/dsh-web'` với `config: { searchProvider: auto, fetchProvider: http }` và **không** có `disabled` |
| 2 | Thuần host hay có mount surface client? | **Thuần host** — `lib/index.js` 143 dòng; `lib/` có `index.js` + `types/`, **KHÔNG có `lib/client.js`** |
| 3 | Cần seam nào? | **KHÔNG gọi seam dịch vụ nào của DSH** — chỉ `Service`/`ctx.effect` của cordis, `z` (schemastery) cho `Config`, và `HarnessError` của `dsh-llm` (cùng lớp cho `instanceof`) + `process.env` |
| 4 | Hành vi ĐO ĐƯỢC là gì? | Sáu ca **chọn provider** (mã lỗi + thông điệp) · biên `maxResults` trên `sources[]` · `fetch` ngoài 2xx **là kết quả** · đăng ký/gỡ provider · biến môi trường chỉ là nguồn **dự phòng** |
| 5 | Package gốc có `dsh.client` không? | **KHÔNG** — `python3 -c "import json;print(bool((json.load(open('…/package.json')).get('dsh') or {}).get('client')))"` ⇒ `False` ⇒ **MỘT MẶT**, thay được ngay |

**Luật 000e (locale)**: bản gốc **CÓ** `locale/en.json` + `locale/zh.json` ⇒ đã chép **byte-for-byte**
(`shasum` hai bên khớp: `en` `e8b04a31…` · `zh` `708ea629…`), và `"./locale/*.json"` có trong `exports`.

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `WebError` | `lib/index.js` dòng 19 · `lib/types/types.d.ts` dòng 124 | `src/types.ts` | ca ARTIFACT: `Object.getPrototypeOf(WebError)` của **hai bên** phải CÙNG lớp `HarnessError` của kernel; `code`/`name` khớp |
| từ vựng request/result + provider | `lib/types/types.d.ts` (9 kiểu) | `src/types.ts` | khai **đúng hình dạng** (readonly như gốc); chạy thật qua provider giả trong test |
| `WebRuntime` · `Config` | `lib/index.js` dòng 41–117 | `src/index.ts` | ca ARTIFACT: tập export + `Object.getOwnPropertyNames(prototype)` + `String(Config)` khớp gốc |
| `registerSearchProvider` · `registerFetchProvider` · `registerProvider` | `lib/index.js` dòng 67–87 | `src/index.ts` | ca "đăng ký": id trùng (`WEB_DUPLICATE_PROVIDER`) · disposer gỡ provider · hai sổ **độc lập** |
| `resolveProvider` | `lib/index.js` dòng 119–132 | `src/selection.ts` | ca "chọn provider": **6 ca** so **TỪNG CHỮ** mã lỗi + thông điệp với gốc |
| `capSources` | `lib/index.js` dòng 134–141 | `src/selection.ts` | ca "biên maxResults": 5 tổ hợp (vắng · bằng · nhỏ hơn · lớn hơn · 0) + hợp đồng "cắt ⇒ object MỚI" |
| `search` · `fetch` | `lib/index.js` dòng 97–116 | `src/index.ts` | ca "fetch": ngoài 2xx **là kết quả**, thân đi qua **nguyên vẹn từng ký tự** (chuỗi tiếng Việt) |
| fallback `$DSH_WEB_*` | `lib/index.js` dòng 57–58 | `src/index.ts` | ca "biến môi trường": env dự phòng + **Config thắng env**, hai bên cùng kết quả |
| `context.web` augmentation | `lib/types/index.d.ts` dòng 13–17 | `src/index.ts` | `declare module "@deepseek-ai/cordis"` **CÓ THÂN** (không phải ambient rỗng — luật 000d/000d-2) |
| tập export lúc chạy | `export { WebError, WebRuntime, WebRuntime as default }` | `lib/index.js` | **đo trên ARTIFACT**: tập tên **BẰNG ĐÚNG** tập gốc (`WebError` · `WebRuntime` · `default`) |
| `locale/en.json` · `locale/zh.json` | `locale/` của gói gốc | `locale/` | chép **byte-for-byte**, `shasum` khớp |

## 2. Peer — vì sao, và thuộc bậc nào của §3b

| Peer | Vì sao | Bậc trong §3b |
|---|---|---|
| `@deepseek-ai/cordis` | `Service` (đăng ký `ctx.web`) + `ctx.effect` (vòng đời provider) — **cùng một** kernel cấp | **Bậc 1** |
| `@deepseek-ai/schemastery` | schema `Config` để Settings/config-editor render được hai trường | **Bậc 1** |
| `@deepseek-ai/dsh-llm` | `WebError extends HarnessError` — **cần CÙNG lớp** để `instanceof` hoạt động ở ranh giới gói (tầng tool bắt `HarnessError` để lấy `code`) | **Bậc 2** (seam dịch vụ DSH) |

Ba tên này nằm ở **cả** `peerDependencies` **và** `gbh.peers` với **cùng một tập** ⇒ `gbh.peers ⊆
peerDependencies` **0 tên lệch**, có **đối chứng âm** (xoá-một-tên ⇒ phép kiểm THẤY · peerDeps rỗng ⇒ THẤY
· **thừa** tên ⇒ vẫn ⊆). Không khai vào `dependencies` (sẽ tạo thể hiện thứ hai).

## 3. Bảng TRƯỚC / SAU

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| Tập export trên ARTIFACT | `WebError` · `WebRuntime` · `default` | **Y HỆT** (3 = 3, 0 thiếu · 0 thừa) |
| `grep -c 'id: @deepseek-ai' lib/index.js` | — | **0** (row host, không đăng ký id module) |
| Sáu ca chọn provider | mã lỗi + thông điệp của gốc | **BẰNG NHAU từng chữ** (kể cả `(alpha, beta)` trong `WEB_PROVIDER_AMBIGUOUS`) |
| Biên `maxResults` (5 tổ hợp) | cắt `sources[]` + `truncated` | **BẰNG NHAU**; object gốc **không bị sửa** |
| `fetch` ngoài 2xx | **kết quả**, không ném | **BẰNG NHAU** (thân chuỗi tiếng Việt nguyên vẹn) |
| `String(Config)` | `{ searchProvider?: string, fetchProvider?: string }` | **BẰNG NHAU** |
| TRƯỚC/SAU trên app 5439 (`parity:dump` · `check:app` (5)(8)) | — | **CHƯA đo** — gói chưa khai `gbh.row`, chờ lượt boot của Lead |

Lệnh tái lập (không cần boot app):

```bash
cd galaxy-blackhole/blackhole-tauri
~/.bun/bin/bun test tests/host/web.test.ts      # 9 pass · 0 fail · 68 expect
cd packages/host/web && ~/.bun/bin/bun run build.ts
grep -c 'id: @deepseek-ai' lib/index.js          # 0
```

## 4. Test — 9 ca, trong đó 6 phép ĐỐI CHỨNG với chính bundle gốc

| Ca | Nội dung |
|---|---|
| ARTIFACT | tập export ta = gốc · 0 id `@deepseek-ai` · prototype khớp · `Config` khớp · `WebError` của **cả hai** cùng lớp nền `HarnessError` của kernel |
| chọn provider | **6 ca** (configured-registered · configured-missing · configured-unavailable · auto-single · auto-ambiguous · auto-unavailable) — so **từng chữ** với gốc |
| biên `maxResults` | 5 tổ hợp + hợp đồng "cắt ⇒ object mới, không sửa kết quả provider" + **thứ tự đăng ký không đổi kết quả** |
| `fetch` | ngoài 2xx là **kết quả**; thân đi qua **nguyên vẹn từng ký tự**; cùng mã lỗi khi provider chưa đăng ký |
| đăng ký | id trùng · disposer gỡ provider · `search`/`fetch` là **hai sổ độc lập** |
| biến môi trường | env là nguồn **dự phòng**; **Config thắng env** — hai bên cùng kết quả |
| `gbh.peers ⊆ peerDependencies` | **so PHẦN TỬ** + **đối chứng âm** ba chiều (xoá-một-tên · xoá-sạch · thừa-tên) + `dependencies` rỗng |
| **test canh** | (đã gỡ cùng lượt khai `gbh.row` ngoài phiên — file test còn 8 ca) |
| **C6 — danh tính** | hai thể hiện service có `searchProviders`/`fetchProviders` là **HAI vật khác nhau** (so `toBe`, không so sâu); đăng ký bên này **không lan** sang bên kia; `searchProviderId` là trạng thái **riêng** từng thể hiện |

## 5. Phần CHƯA làm

1. **CHƯA mount** lên app 5439 (`gbh.row` do lượt sửa NGOÀI phiên khai lúc 07:35:48) ⇒ **CHƯA** có `parity:dump`/`check:app` TRƯỚC/SAU,
   **CHƯA** chạy `lab:row`. Đây là chủ ý: khai `gbh.row` = nhận rủi ro mount, và Lead giữ lượt boot.
2. Khi Lead mount, cần đối chiếu thêm: **config của row** phải giữ nguyên
   `{ searchProvider: auto, fetchProvider: http }` (đo từ `app.patch.yml` hiện tại) — gói của ta **không**
   tự đổi id provider nào.
3. **Khác biệt cơ chế CÓ Ý (đã ghi)**: bản gốc đăng ký provider bằng **generator effect**
   (`ctx.effect(function* () { store.set(...); yield () => store.delete(...) })`), ta dùng **effect trả
   disposer** (`ctx.effect(() => { store.set(...); return () => … })`). Cùng ngữ nghĩa: chèn lúc hiệu ứng
   chạy, gỡ lúc hiệu ứng bị dọn — nhưng **không generator**, để không phụ thuộc kiểu `Iterable` của cordis.
