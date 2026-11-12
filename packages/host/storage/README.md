<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Gói viết lại row storage (@deepseek-ai/dsh-storage): kho lưu trữ ctx.storage — sổ backend có tên + các dạng dữ liệu mount được. Ghi nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU và phần CHƯA làm.
-->

# `@galaxy-blackhole/gbh-storage` — row `storage` (MỘT MẶT, host-only)

Bản viết lại của Galaxy Blackhole cho row **`storage`** của DSH. Gói **ĐÃ khai `gbh.row`** (`id: storage`,
`tests` trỏ file test dưới đây) — **do Lead chốt** sau khi tự kiểm ba phép tiền-mount (tập export **6 = 6**,
`gbh.peers` ⊆ `peerDependencies`); lượt **mount + TRƯỚC/SAU** trên app 5439 vẫn thuộc Lead (xem §7 · §9).

## 0. Bước 0 — xác nhận ROW (đo trên file, không suy từ tên thư mục)

| phép kiểm | kết quả |
|---|---|
| cặp `- id: storage` + `name: '@deepseek-ai/dsh-storage'` | **CÓ THẬT** — `.parity/dumps/2026-10-17T23-54-01/ours.yml:150-151` (`order: 32`) |
| row đang BẬT | **BẬT** — không có mục `disabled` nào cho `storage` trong `profiles/blackhole/*.patch.yml`; `presence-table.md:35` ghi **✓ ✓ ✓** (oracle · ours · stock) |
| `lib/client.js` của gói gốc | **KHÔNG TỒN TẠI** ⇒ row **MỘT MẶT** (nửa host thuần) |
| số dòng bản gốc | `lib/index.js` **140 dòng** (khớp `row:cost`: 141 dòng tính cả header, **0 inject · 0 primitive · 0 khoá từ điển · không trạng thái sống**) |

## 1. Năm câu hỏi bắt buộc

| # | câu hỏi | trả lời (đo được) |
|---|---|---|
| 1 | Row này có **đang BẬT** không? | **CÓ.** `- id: storage` nằm trong `ours.yml` của dump mới nhất, không bị patch nào tắt; ```bh host --dump-config``` sẽ in đúng cặp đó. |
| 2 | Thuần host hay có mount surface client? | **Thuần host.** Không có `lib/client.js`, `package.json` gốc **không** có khoá `dsh`; bản thân gói không chạm `loader.create/resolve`, không `slots`, không HTTP route. |
| 3 | Cần **seam** nào? | **Chỉ kernel cordis**: `extends Service` (`ctx.storage`), `Context` cho khai báo hợp nhất. **Không** `TypertRemoteService`, **không** `node:` builtin nào (gói gốc cũng không import module ngoài cordis). Peer duy nhất ⇒ **Bậc 1** của bảng §3b. |
| 4 | **Hành vi đo được** là gì? | Bốn thứ đo được TRƯỚC/SAU: (a) service `ctx.storage` có mặt với `name === "storage"`; (b) `storage.backend.register/get/names` — đăng ký + giải + câu lỗi `duplicate-backend`/`backend-not-found`; (c) `storage.mount/form/domain` + câu lỗi `duplicate-mount`/`form-not-mounted`; (d) hình dạng `StorageError` cho **7 mã**. Tất cả đo trên **artifact** rồi so **chính bundle gốc**. |
| 5 | Package gốc có `dsh.client` không? | **KHÔNG.** `package.json` gốc (bản kernel `0.2.1-alpha.4`) không có khoá `dsh`; `locale/` thì **CÓ** (`en.json` + `zh.json`) ⇒ luật **000e** áp dụng: ta chép **byte-for-byte** (shasum khớp). |

## 2. Nguồn đối chiếu (G4) — CHỈ ĐỌC

| bản gốc (kernel) | của ta | ghi chú |
|---|---|---|
| `apps/host/node_modules/@deepseek-ai/dsh-storage/lib/index.js` (140 dòng) | `src/index.ts` · `src/registry.ts` · `src/error.ts` · `src/backend.ts` | viết lại theo **bốn module** đúng ranh giới `//#region` của bản gốc (`lib/types/{error,registry,backend,index}`) |
| `lib/types/index.d.ts` | `src/index.ts` | `Storage` · `StorageForms` · `storageBackendServiceKey` · hợp nhất `Context.storage` |
| `lib/types/registry.d.ts` | `src/registry.ts` | `BackendRegistry` |
| `lib/types/error.d.ts` | `src/error.ts` | `StorageError` + `StorageErrorCode` (**7 mã**) |
| `lib/types/backend.d.ts` | `src/backend.ts` | `UNIT_NAME_RE` + 4 kiểu hợp đồng backend |
| `locale/en.json` · `locale/zh.json` | `locale/en.json` · `locale/zh.json` | **chép byte-for-byte**, shasum khớp (`6f51ac44…` / `318c11b2…`) |

**Không chép code**: bốn file `src/*.ts` viết lại theo hành vi đo được; câu lỗi và **thứ tự** khoá
được đối chiếu từng chữ với bundle gốc trong test.

## 3. Bề mặt LÚC CHẠY (đo trên artifact, so với gốc)

```
export { BackendRegistry, Storage, Storage as default, StorageError, UNIT_NAME_RE, storageBackendServiceKey }
```

- **6 export, 0 thiếu · 0 thừa** (`exportNames(ta) === exportNames(gốc)`), `default === Storage` ở **cả hai** bên.
- prototype: `Storage` = `constructor · domain · form · mount`; `BackendRegistry` = `constructor · get · names · register`; `StorageError` = `constructor` — **trùng** gốc.
- `grep -c "id: @deepseek-ai" lib/index.js` = **0**; artifact **không** chứa `__ModuleLoader__` (row host thuần).
- `UNIT_NAME_RE` giữ **nguyên biểu thức** `/^[a-z][a-z0-9_]*$/`; `storageBackendServiceKey(name)` = `"storage.backend." + name`.
- Câu lỗi giữ **nguyên văn tiếng Anh** của gốc (chúng là hợp đồng người dùng `switch`/so khớp):
  `storage backend '<n>' is already registered` · `storage backend '<n>' is not registered (registered: …|none)` ·
  `storage form '<f>' is already mounted` · `storage form '<f>' is not mounted`.

## 4. Peer — vì sao, và vì sao CHỈ có một

| peer | bậc (§3b) | vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | **1 — kernel** | `Storage` **kế thừa `Service`** của kernel và đăng ký qua `ctx.reflect.provide("storage", …)`; `Context` còn là chỗ khai báo hợp nhất `storage`. Hai thể hiện cordis khác nhau ⇒ `instanceof Service` sai và `ctx.get("storage")` không thấy nhau. |

- `gbh.peers = ["@deepseek-ai/cordis"]` ⊆ `peerDependencies` — **so PHẦN TỬ**, có **ĐỐI CHỨNG ÂM** (xoá một tên ⇒
  phép kiểm báo **đúng tên đó**; xoá sạch ⇒ báo **đủ danh sách**; thêm tên lạ ⇒ vẫn ĐẠT vì quy ước là **⊆**).
- Dải version: `~4.0.5` = **đúng version kernel đang chạy** (`apps/host/node_modules/@deepseek-ai/cordis`).
  Gói tarball gốc khai `~4.0.5-alpha.2`; ta theo **quy ước của repo** (mọi gói host đang chạy đều trỏ dải kernel) —
  khác biệt này **không đổi hành vi** vì cordis được kernel cấp **một** thể hiện.
- **KHÔNG** khai vào `dependencies` (sẽ tạo thể hiện thứ hai) — test khẳng định `dependencies` vắng mặt.

## 5. C6 — vật thể cấu hình phải ĐỘC LẬP (kiểm bằng **DANH TÍNH**, không bằng so sâu)

Gói này tạo **nhiều thực thể**: mỗi `BackendRegistry` có `Map` riêng, mỗi `Storage` có sổ backend + bảng
`forms` riêng. Test có hai ca **danh tính**:

```
a.backend !== b.backend                      // hai thực thể kho
(a as any).forms !== (b as any).forms        // bảng dạng RIÊNG
a.backend.register("json", …) ⇒ b.names() === []   // sửa một KHÔNG lan sang cái kia
```

Ca này **bắt được** lớp lỗi mà `toEqual`/`deepEqual` bỏ qua (chia sẻ một hằng/tham chiếu thì giá trị vẫn bằng nhau).

## 6. Test — 13 ca / 160 expect, 0 fail

```bash
bun test tests/host/storage.test.ts      # 13 pass · 0 fail · 160 expect
```

| nhóm | nội dung |
|---|---|
| ARTIFACT | tập export ta = gốc (đo trên `lib/index.js` đã build) · `default === Storage` · prototype cả ba lớp · `UNIT_NAME_RE` nguyên biểu thức · **0** `id: @deepseek-ai` |
| từ vựng lỗi | **7 mã** × `{name, code, message, cause}` — cùng chuỗi với gốc |
| sổ backend | `register/get/names` cùng thứ tự · câu lỗi trùng tên · `(registered: none)` · hàm dọn idempotent + **không gỡ kẻ đăng ký sau** · `names()` là ảnh chụp |
| kho trên **Context cordis THẬT** | `ctx.plugin` (đúng đường nạp của tầng mount) ⇒ service `storage` · `backend` đúng lớp · `instanceof Service` · **không có `Config`** (y gốc) |
| mount/form/domain | cùng hành vi + cùng câu lỗi; hàm dọn chỉ tháo **đúng** facility |
| C6 | 2 ca danh tính (sổ · thực thể kho) |
| peer | `gbh.peers ⊆ peerDependencies` so **phần tử** + **3 đối chứng âm** |
| canh + 000e | **TEST CANH**: gói **KHÔNG** có `gbh.row` (khai sớm = tắt row stock của mọi người) · `locale/*.json` **byte-for-byte** + có trong `exports` |

## 7. TRƯỚC/SAU — **CHƯA ĐO** (chờ lượt boot của Lead)

Gói **đã** khai `gbh.row` (Lead chốt), nên lần boot kế tiếp **sẽ** thay row stock — nhưng phép đo TRƯỚC/SAU
trên app 5439 **chưa** chạy trong phiên này. Phép đo dự kiến (cùng một lệnh, hai lần):

```bash
bun run lab:row storage     # lab cách ly cổng riêng, đo entry + (5) + (8)
bun run check:app           # (5) did not activate · (6) tên gói của ta · (8) #root + lỗi console
```

| chỉ số | TRƯỚC (row stock) | SAU (kỳ vọng) |
|---|---|---|
| entry `@deepseek-ai/dsh-storage` | có | thay bằng `@galaxy-blackhole/gbh-storage` (**thay thế 1-1**, nên chỉ số (6) có thể KHÔNG đổi) |
| `(5)` `did not activate` | 0 | **0** |
| `(8)` `#root` · lỗi console | — | **không đổi** (row host không vẽ gì) |
| `check:rows` | 76 package đạt, 0 `chan` | **0 `chan`** (gói chưa khai row nên không vào sổ mount) |

## 8. Khác biệt CÓ Ý (đã cân nhắc, không phải thiếu sót)

1. **Kiểu generic `K extends keyof StorageForms`** của bản gốc **không ship được**: gói ta build **chỉ**
   `lib/index.js` (không phát `.d.ts`), nên `mount/form` nhận `string` + `unknown`. **Hành vi lúc chạy y nguyên**
   (`Map` khoá chuỗi, câu lỗi dùng `String(form)`); `StorageForms` vẫn được khai (rỗng) để chủ sở hữu dạng
   dữ liệu hợp nhất về sau.
2. **`dependencies` vắng mặt hoàn toàn** (chỉ peer + devDependency) — đúng luật một-thể-hiện.

## 9. CHƯA làm (điều kiện chặn mount, không phải ghi chú cuối bài)

- **`gbh.row` do Lead khai** (commit `17e752a`), sau khi Lead tự kiểm: `storage` export **6 = 6**, peers OK.
  Ta **không tự khai** (đúng luật "khai = nhận rủi ro mount"). Việc còn lại — **`lab:row` · mount · TRƯỚC/SAU
  trên app 5439 · A/B** — thuộc lượt boot của Lead (theo `M6-MOUNT-PLAN.md` §4). Test canh trong
  `tests/host/storage.test.ts` khẳng định ngược lại: khai đúng `id: storage` + `tests` trỏ đúng file.
- **Chưa có gói tiêu thụ** (`storage-json` · `storage-domain`) trong repo, nên chưa có ca hợp đồng liên gói
  kiểu `ctx.storage.backend.get("json")` chạy thật. Khi viết các row đó, **phải** giữ nguyên tên service
  `storage`, khoá `backend`/`form` và hình dạng `StorageError` — đó là hợp đồng ba gói này chờ ở ta.
- **Chưa đo trên trang**: row host không có artifact client, nên `(8)`/`(9)`/`overlay-probe` chỉ dùng để
  chứng minh **không hồi quy**, không phải bằng chứng chức năng.
