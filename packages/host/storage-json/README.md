<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Gói viết lại row storage-json (@deepseek-ai/dsh-storage-json): backend KV lưu bằng tệp JSON. Ghi nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU và phần CHƯA làm.
-->

# `@galaxy-blackhole/gbh-storage-json` — row `storage-json` (MỘT MẶT, host-only)

Bản viết lại của Galaxy Blackhole cho row **`storage-json`** của DSH. **`gbh.row` do LEAD khai NGOÀI phiên
viết gói** (mtime `10:48` ngày 18/10/2026): `id: storage-json` + `config{ root: {js: "dshHomePath('storages')"} }` +
`tests`, **không** `moduleIds`/`aliases` (row MỘT MẶT); patch đã sinh cặp disable+insert `storage-json-ours`.
Phiên viết gói **không tự khai** — trạng thái an toàn cho tới khi Lead chốt ba phép tiền-mount.

## 0. Bước 0 — bốn phép (đo trên FILE, không suy từ tên thư mục)

| phép kiểm | kết quả |
|---|---|
| (i) cặp `- id: storage-json` + `name: '@deepseek-ai/dsh-storage-json'` | **CÓ THẬT** — `.parity/dumps/2026-10-18T01-31-57/ours.yml:164-165` |
| (ii) `dsh.client` trong `package.json` GỐC · `lib/client.js` | **KHÔNG có** · **KHÔNG tồn tại** ⇒ row **MỘT MẶT** |
| (iii) `disabled:` | **KHÔNG có** (kể cả dạng `!!js` điều kiện) ⇒ row **đang bật** |
| (iv) `config:` + `inject:` GỐC (từ `ours.yml` ĐANG CHẠY) | `config: { root: !!js dshHomePath('storages') }` · **`inject:` KHÔNG có** |

`config` là biểu thức `!!js` nhưng **không dùng `ctx.<X>`** (chỉ `dshHomePath`) ⇒ luật *config dùng
`ctx.X` thì `inject` phải chứa `X`* **không áp dụng**. Seam `storage` là **export của chính gói**
(`inject = ["storage"]`, nguyên văn bản gốc), không phải của patch.

## 1. Năm câu hỏi bắt buộc

| # | câu hỏi | trả lời (đo được) |
|---|---|---|
| 1 | Row này có **đang BẬT** không? | **CÓ.** Không mục `disabled` nào cho `storage-json` trong `ours.yml` của dump mới nhất. |
| 2 | Thuần host hay có mount surface client? | **Thuần host.** Gói gốc không có khoá `dsh`, không có `lib/client.js`; bản thân gói không chạm `loader.create/resolve`, không slot, không HTTP route. |
| 3 | Cần **seam** nào? | Kernel cordis (`Context`, `ctx.effect`, `ctx.provide`) + **seam kho** `ctx.storage.backend.register` khai **theo CẤU TRÚC** (`src/hub.ts`). Không `TypertRemoteService`. `node:` builtins: `fs/promises`, `path`, `crypto`. |
| 4 | **Hành vi đo được** là gì? | (a) backend `json` **đăng ký** trên kho + khoá vòng đời `storage.backend.json`; (b) **tệp đơn vị** công bố nguyên tử, nội dung **người-đọc-được**; (c) **cây tệp** của bố trí `per-record` + `global.json` + tệp `.bak.<YYYYMMDDHHmm>`; (d) **ma trận lỗi** (`malformed-medium` · `version-mismatch` · `closed` + lỗi `Error` thường). Tất cả đo **TRƯỚC/SAU** trên đĩa thật, đối chứng với chính bundle gốc. |
| 5 | Package gốc có `dsh.client` không? | **KHÔNG** (`python3 -c "…get('client')"` ⇒ `False`; `lib/client.js` ⇒ ENOENT). `locale/` thì **CÓ** (`en.json` + `zh.json`) ⇒ luật **000e** áp dụng: chép **byte-for-byte**, khai `exports["./locale/*.json"]`. |

## 2. Nguồn đối chiếu (G4) — CHỈ ĐỌC

| bản gốc (kernel) | của ta | ghi chú |
|---|---|---|
| `lib/index.js` 610 dòng | `src/index.ts` · `src/single-unit.ts` · `src/per-record-unit.ts` · `src/format.ts` · `src/atomic.ts` · `src/hub.ts` | viết lại theo **sáu module** đúng ranh giới `//#region` của bản gốc (`index` · `single-unit` · `per-record-unit` · `format` · `atomic`); `hub.ts` là **seam** của ta |
| `lib/types/index.d.ts` | `src/index.ts` + `src/hub.ts` | `name` · `inject` · `Config` · `JsonStorageBackend` · `apply` |
| `lib/types/atomic.d.ts` · `format.d.ts` · `single-unit.d.ts` · `per-record-unit.d.ts` | `src/atomic.ts` · `src/format.ts` · `src/single-unit.ts` · `src/per-record-unit.ts` | hành vi + mọi câu lỗi **nguyên văn** |
| `locale/{en,zh}.json` | `locale/{en,zh}.json` | **byte-for-byte** (`shasum e193c667…` · `a691d5f3…`) |

## 3. Peer và seam (bảng §3b của `packages/README.md`)

| peer | bậc | vì sao |
|---|---|---|
| `@deepseek-ai/cordis` | **bậc 1** | `Context` + `ctx.effect`/`ctx.provide`; kernel cấp MỘT thể hiện |
| `@deepseek-ai/schemastery` | **bậc 1** | schema `Config` lúc chạy (`z.object({ root })`) |

`gbh.peers ⊆ peerDependencies` **2/2**, so **PHẦN TỬ**, có **3 ĐỐI CHỨNG ÂM** trong test. `dependencies` **RỖNG**.

**Vì sao KHÔNG import `@deepseek-ai/dsh-storage` (gói kho) — lý do ĐO ĐƯỢC:**

1. Profile của app **KHÔNG có** gói đó: `ls ~/.galaxy/blackhole/profiles/node_modules/@deepseek-ai/dsh-storage`
   ⇒ **ENOENT** (chỉ có `@galaxy-blackhole/gbh-storage`, tức kho của ta đã thay row `storage`). Bundle của ta
   nằm ở `profiles/node_modules/@galaxy-blackhole/gbh-storage-json/lib/index.js`, nên một
   `import "@deepseek-ai/dsh-storage"` sẽ **chết lúc nạp entry**.
2. Không thể khai peer `@galaxy-blackhole/gbh-storage` để bù: `apps/cli/src/mount.ts` chỉ symlink peer từ
   `apps/host/node_modules`, mà ở đó **không có** `@galaxy-blackhole/*` ⇒ mount trả `ok: false` với
   `"thieu peer trong kernel"` ⇒ gói **không được mount**.

⇒ Nên: **ba hằng của seam viết tại chỗ** — `UNIT_NAME_RE` (`/^[a-z][a-z0-9_]*$/`, y hệt), `storageBackendServiceKey`
(`storage.backend.<tên>`), `StorageError` (cùng `name`/`code`/`cause`) — còn **bề mặt kho khai theo CẤU TRÚC**
(`src/hub.ts`) và cast ở **ĐÚNG MỘT ranh giới**. Đây là tiền lệ đã được chấp nhận ở `host/storage-domain` và
`host/session-projection-cache`.

## 4. Bảng TRƯỚC / SAU (đo trên ARTIFACT + đĩa THẬT)

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| Tập export trên `lib/index.js` (nạp THẬT hai bên) | 5 | **5 = 5** (0 thiếu · 0 thừa) |
| prototype `JsonStorageBackend` | `close · constructor · openUnit` | **trùng 3 = 3** |
| thuộc tính riêng của thể hiện | `closed · kv · open · opening · root` | **trùng tập** |
| `String(Config)` · `apply.length` · `inject` | `{ root: string }` · 2 · `["storage"]` | **trùng từng ký tự** |
| Import ngoài trong artifact | **2** (`schemastery` + `dsh-storage`) | **1** (`schemastery`) |
| `grep -c "id: @deepseek-ai"` · `__ModuleLoader__` | 0 · 0 | **0 · 0** |
| Tệp `single` công bố (byte) | in 2 dấu cách, `unit`/`global`/`tables`, xuống dòng cuối | **trùng từng byte** |
| Cây `per-record` (byte) | `<tên>/<bảng>/<khoá>.json` + `global.json` | **trùng từng byte** |
| Bootstrap LEGACY (6 ca) | mồi / bỏ qua theo dấu phiên bản | **trùng cả cây tệp** |
| Ma trận lỗi | 8 dạng medium hỏng + 4 mô tả sai + đóng | **cùng name/code/message** |
| Test của gói | — | **19 test / 161 expect / 0 fail** |
| `check:rows` | — | **0 dòng `chan`** (gói ĐÃ vào phép kiểm export/slot của row) |
| `gate --no-tests` | — | **7/7 XANH** |

**Bề mặt service** = tập export (row host không có slot): `Config` · `JsonStorageBackend` · `apply` ·
`inject` · `name`.

**Hành vi đã đối chứng trực tiếp với chính bundle gốc** (mỗi bên một gốc tạm + `Context` cordis THẬT):

* **`single`**: mở **không tạo tệp** (tạo lười ở lượt ghi đầu) · ghi/xoá/global công bố **cùng byte** ·
  xoá-khoá-vắng là no-op · **`close()` XẢ lượt ghi đang chạy** · mở lại sau `close` được, mở trùng bị từ chối ·
  backend đã đóng ⇒ mọi lượt mở hỏng với `json backend is closed`;
* **`per-record`**: đơn vị **không chạm đĩa** lúc mở (nạp lười) · mỗi bản ghi một tài liệu
  (`{version, record}`, in đẹp) · `backupRecord` đổi tên ⇒ bản ghi **biến mất khỏi lượt đọc**, byte còn trên đĩa ·
  khoá KHÔNG an toàn (`../x`, `a.b`, `a/b`) bị **từ chối trước khi chạm đĩa**;
* **bootstrap LEGACY**: chỉ mồi khi cây **chưa có đường-dẫn-tài-liệu** nào **và** dấu phiên bản nằm trong tập
  chấp nhận; tệp legacy **giữ nguyên**; tài liệu ngoại lai (hỏng/cũ/thiếu dấu) đọc như **VẮNG**;
* **`apply`**: cùng vết `register:json → unregister:json`, cùng khoá vòng đời `storage.backend.json`,
  backend **đóng THẬT** sau `dispose` (không chỉ gỡ khỏi sổ).

**C6 — danh tính** (so bằng `not.toBe`, KHÔNG so sâu): hai backend có `open`/`opening`/`kv` **riêng**; hai đơn vị
cùng tên **không chia sẻ** trạng thái (ghi bên này không lan sang bên kia); `loadAll()` trả **vật thể MỚI** mỗi lượt.

## 5. Phần CHƯA làm

- **`gbh.row`** — do **LEAD** khai, không do phiên viết gói. Test có **1 ca canh HAI CHIỀU**: vắng `gbh.row` vẫn là
  trạng thái hợp lệ; **có** thì phải đúng `id` + `config` + `tests` của row trong `ours.yml` và **không** được có
  `moduleIds`/`aliases`.
- **`lab:row` · mount · `check:app` · bảng TRƯỚC/SAU trên app 5439** — thuộc lượt boot của Lead.
- **Windows**: nhánh `fsyncDirectory` bỏ qua trên `win32` (đúng bản gốc), **chưa đo** trên Windows thật.
- **Nén/băm tệp**: bản gốc không có, ta cũng không thêm.
