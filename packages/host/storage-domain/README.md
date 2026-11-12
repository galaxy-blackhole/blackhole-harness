<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row storage-domain cua DSH: dang du lieu MIEN (ctx.storage.domain)
-->

# @galaxy-blackhole/gbh-storage-domain

Bản viết lại của Galaxy Blackhole cho row `storage-domain` của DSH — **dạng dữ liệu MIỀN**
(`ctx.storage.domain`): KV có schema kiểm, phát sự kiện `domain/changed`, mở/đóng miền trên các
backend của kho lưu trữ.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `storage-domain` (tier **T1**, `ours.yml` dòng 168–171 của dump `2026-10-18T01-31-57`) | `@galaxy-blackhole/gbh-storage-domain` |
| Package | `@deepseek-ai/dsh-storage-domain` `0.2.1-alpha.4` | như trên |
| Đường dẫn đối chiếu | `apps/host/node_modules/@deepseek-ai/dsh-storage-domain/{lib/index.js,lib/types/*.d.ts,locale/*.json}` (CHỈ ĐỌC) | `packages/host/storage-domain` |
| Kích thước bản gốc | **454 dòng** `lib/index.js` + **5 tệp** `lib/types/*.d.ts` (454 dòng `.d.ts` gộp) | **6 tệp nguồn · 1.016 dòng** ⇒ `lib/index.js` **326 dòng** |
| Hai mặt? | **KHÔNG** — `package.json` gốc **không có `dsh.client`**, **không có `lib/client.js`** | row MỘT MẶT (không nửa browser) |
| Mức dẫn xuất | **viết lại theo hành vi** (đọc `.d.ts` + `lib/index.js` để nắm hành vi; không chép code) | — |

## 2. Vì sao cần

Đây là **thể hiện DUY NHẤT của tầng miền**: người dùng phụ thuộc gói này và **không bao giờ chạm backend
trực tiếp**. Gói phơi service `ctx.storageDomain` (`DomainFacility`) + sự kiện `domain/changed`, và
mount một dạng dữ liệu `domain` lên kho (`ctx.storage.mount("domain", …)`).

Người dùng thật trong repo: `host/session-projection-cache` mở miền `session_projcache` bằng
`ctx.storageDomain.open(projectionCacheDomainSpec)` (`src/service.ts:115`) — đó là **hợp đồng liên gói**
mà bản viết lại này phải giữ: `open` đọc các trường `name/version/layout/compatibleVersions/invalidRecords/tables`
của spec, nên spec của người dùng KHÔNG cần là thể hiện của lớp nào.

## 3. Peer và seam (bảng §3b của `packages/README.md`)

| peer | bậc | vì sao |
|---|---|---|
| `@deepseek-ai/cordis` | **bậc 1** | `Context` + `ctx.inject/effect/provide/emit/logger`; kernel cấp MỘT thể hiện |
| `@deepseek-ai/schemastery` | **bậc 1** | schema `Config` lúc chạy (`z.object({ backend, routes })`) |

`gbh.peers ⊆ peerDependencies` **2/2**, so **PHẦN TỬ**, có **ĐỐI CHỨNG ÂM** trong test. `dependencies` RỖNG.

**Vì sao KHÔNG import `@deepseek-ai/dsh-storage` (gói kho) — lý do ĐO ĐƯỢC:**

1. Profile của app **KHÔNG có** gói đó: `ls ~/.galaxy/blackhole/profiles/node_modules/@deepseek-ai/dsh-storage`
   ⇒ **ENOENT** (chỉ có `@galaxy-blackhole/gbh-storage`, tức kho của ta đã thay row `storage`).
   Bundle của ta nằm ở `profiles/node_modules/@galaxy-blackhole/gbh-storage-domain/lib/index.js`, nên một
   `import "@deepseek-ai/dsh-storage"` sẽ **chết lúc nạp entry** (mọi phân giải đi lên đều trượt).
2. Không thể khai peer `@galaxy-blackhole/gbh-storage` để bù: `apps/cli/src/mount.ts:267-277` chỉ
   symlink peer từ `apps/host/node_modules`, mà ở đó **không có** `@galaxy-blackhole/*` ⇒ mount trả
   `ok: false` với `"thieu peer trong kernel"` ⇒ gói **không được mount**.

⇒ Nên: **hai hằng của seam viết tại chỗ** — `UNIT_NAME_RE` (`/^[a-z][a-z0-9_]*$/`, y hệt, có A/B qua
câu lỗi của `defineDomain`) và `storageBackendServiceKey` (`storage.backend.<tên>`) — còn **bề mặt kho
khai theo CẤU TRÚC** (`src/hub.ts: StorageHubLike`) và cast ở **ĐÚNG MỘT ranh giới**. Đây là tiền lệ đã
được chấp nhận ở `host/session-projection-cache` (tự viết `defineDomain`/`domainTable` thay vì khai peer).

`zod` chỉ dùng cho **KIỂU** (`ZodTypeLike<V>`): bundle gốc **không import zod** (chỉ `schemastery` +
gói kho), nên `zod` nằm ở `devDependencies` chứ không thành peer lúc chạy. Test dùng **zod THẬT** của
kernel để chứng minh `ZodObject` đi qua seam kiểu được.

## 4. Bảng TRƯỚC / SAU (đo trên ARTIFACT + Context cordis THẬT)

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| Tập export trên `lib/index.js` | 9 | **9 = 9** (0 thiếu · 0 thừa) |
| `grep -c "id: @deepseek-ai"` trong artifact | 0 | **0** (`__ModuleLoader__` = 0) |
| Import ngoài trong artifact | **2** (`schemastery` + `dsh-storage`) | **1** (`schemastery`) |
| prototype `DomainFacility` | `closeAll · constructor · get · open` | **trùng 4 = 4** |
| `String(Config)` | `{ backend: string, routes?: { [key: string]: string } }` | **trùng từng ký tự** |
| `apply.length` · `inject` | 2 · `["storage"]` | **2 · `["storage"]`** |
| Vòng đời bảng (A/B) | 22 trường ảnh chụp | **trùng cả hai bên** |
| Ma trận đường lỗi (A/B) | 8 ca | **cùng name/code/message/detail** |
| `backup-and-skip` (A/B) | 2 nhánh | **cùng kết cục + cùng log** |
| Test của gói | — | **18 test / 230 expect / 0 fail** |
| `check:rows` | 105 package · 0 chặn | **107 package · 0 dòng `chan`** |
| `gate --no-tests` | 7/7 | **7/7 XANH** |

**Bề mặt service** = tập export (row host không có slot): `Config` · `DomainError` · `DomainFacility` ·
`apply` · `defineDomain` · `descriptorOf` · `domainTable` · `inject` · `name`.

**Hành vi đã đối chứng trực tiếp với chính bundle gốc** (mỗi bên một `Context` cordis THẬT + kho của ta):

* **bền TRƯỚC → sửa bộ nhớ → phát `domain/changed`**: vết medium và vết sự kiện khớp đúng thứ tự;
  `putRecord` NÉM ⇒ bộ nhớ KHÔNG đổi + **0 sự kiện**;
* **ô global**: `null` của medium = "chưa từng ghi" ⇒ `initial`; đã lưu ⇒ đọc thẳng; `set` ⇒
  `setGlobal` + sự kiện `{table:"", key:""}`;
* **tuyến** `routes[tên] ?? backend` (tuyến theo miền GHI ĐÈ backend mặc định);
* **MỘT-LẦN-MỞ** mỗi tên (đặt chỗ cả lúc đang mở; lượt mở HỎNG vẫn trả tự do tên + đóng đơn vị);
* **`invalid-record`** kèm `detail {table, key}` + `cause` là **ZodError** thật; global hỏng cũng từ chối;
* **`invalidRecords: 'backup-and-skip'`**: có `backupRecord` ⇒ mở ĐƯỢC + log kèm cause; **không có**
  `backupRecord` ⇒ rơi về mặc định TỪ CHỐI (đơn vị vẫn được đóng);
* **`defineDomain`**: 9 hình dạng sai ⇒ **cùng câu lỗi**; `descriptorOf` 4 spec ⇒ **cùng khoá** (không ghi
  khoá `undefined`).

**C6 — danh tính** (so bằng `not.toBe`, KHÔNG so sâu): hai facility giữ ĐÚNG vật thể `config` của mình;
`domains`/`reserved` riêng; hai miền cùng tên KHÔNG chia sẻ bản ghi; hai handle `global` riêng;
`entries()`/`keys()` trả **vật thể MỚI** mỗi lượt (ảnh chụp tách khỏi bảng).

**`locale/`** (000e): `locale/{en,zh}.json` chép **byte-for-byte** từ bản gốc
(`shasum 3b104d1d…` · `32152b3a…`), khai `exports["./locale/*.json"]`, và `mount.ts` đã copy cả hai tệp
vào profile.

## 5. Khai báo row (do LEAD, không do phiên viết gói)

`package.json` khai `gbh.row: { id: "storage-domain", config: { backend: "json" }, tests: ["tests/host/storage-domain.test.ts"] }`
— `config` **lấy từ `ours.yml` ĐANG CHẠY** (row trần, **không** `!!js`), **không có `inject`** ở tầng row
(plugin tự khai `inject = ["storage"]`). Row MỘT MẶT ⇒ **không** `moduleIds`/`aliases`.

Bằng chứng mount (lượt boot của Lead): patch đang chạy có **cặp** `- id: storage-domain` + `disabled: true`
và `- insert: - id: storage-domain-ours` + `name: '@galaxy-blackhole/gbh-storage-domain'`; profile có
`lib/index.js` **sha trùng repo** + `locale/{en,zh}.json`.

## 6. Phần CHƯA làm

* **`lab:row`** và **TRƯỚC/SAU trên app 5439** (`(5)` `did not activate` · `(8)` `#root` · `(9)` bố cục ·
  `(10)` mount) — thuộc lượt boot của Lead (row host **không** có ảnh A/B pixel).
* **Chưa đo trên medium THẬT** (`storage-json`): mọi phép A/B chạy trên **backend giả** trong test; đường
  `backup-and-skip` mới chỉ đo qua `KvUnit.backupRecord` giả.
* **Khác hình dạng CÓ Ý** (không phải thiếu): (a) `ZodTypeLike<V>` thay `ZodType<V>` (`zod` chỉ-mượn-kiểu);
  (b) **không** augment `StorageForms` của gói kho (không import được gói kho — xem §3; `Storage.domain` của
  ta trả `unknown`, nên augmentation đó không thêm năng lực gì); (c) `UNIT_NAME_RE`/`storageBackendServiceKey`
  viết tại chỗ, có A/B.
