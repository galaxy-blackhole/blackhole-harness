> ⚠️ **Ghi chú 18/10/2026 (Lead):** các đường dẫn trong ADR này là **bản ghi LỊCH SỬ** tại thời điểm quyết định
> — nhiều đường dẫn trỏ tới layout **trước khi đổi tên** (`galaxy-code/…`) nên **KHÔNG còn tồn tại**.
> Đây **không phải dẫn chiếu chết cần sửa**: ADR là **ảnh chụp quyết định**, không phải tài liệu hướng dẫn hiện hành.
> Tài liệu hiện hành: `docs/ARCHITECTURE.md` · `docs/recipes/*` · `docs/M6-REMAINING.md`.

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc ADR 0004: co che mount package cua ta vao profile (M4 tro di) + phat hien ten goi la guard trong patch
-->

# ADR 0004 — Cơ chế mount package của ta vào profile (M4 → M6)

- **Trạng thái:** đã chốt 17/10/2026, áp dụng cho mọi package viết lại ở bước 2
- **Mốc mở màn:** M4a — `@galaxy-blackhole/gbh-host-webserver` thay row `webserver` của DSH


> 🔴 **LỆNH KHỞI ĐỘNG DUY NHẤT: `scripts/restart-host.sh`**
> Đừng chép tay lệnh khởi động. Ba sự cố liên tiếp ngày 17/10/2026 đều do chép tay:
> `bun` không có trong PATH của shell agent · `DSH_HOME=~/.galaxy/gbh` rò từ phiên agent vào · cổng 5439 còn bị tiến trình cũ giữ.
> Script tự làm cả ba (đường dẫn tuyệt đối, gỡ hai biến home, chờ cổng nhả) rồi **tự xác minh bằng `check:app` trước khi báo xong**.
## 1. Bối cảnh

Kernel/core vẫn là DSH cho tới M3. Package của ta phải mount được vào đúng profile như DSH làm: profile
`blackhole` trong `~/.galaxy/blackhole`, cây plugin dựng từ 12 bundle + patch của app.

## 2. Phát hiện quyết định: `name` trong patch của cordis là GUARD, không phải setter

`apps/host/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js` (`applyEntryPatches`) bóc tách mỗi entry patch:

```js
const { id, insert, name, ...overrides } = patch;
if (name && name !== target.name) { warn("patch: name mismatch ..."); continue; }
for (const [key, value] of Object.entries(overrides)) target[key] = value;
```

**Không thể đổi `name` của một row bằng patch.** Nếu ta ghi tên gói của ta vào `name`, patch bị BỎ QUA âm thầm
(chỉ một dòng cảnh báo) — đây chính là lý do lần đầu M4a không thay được implementation dù patch có mặt.

**Hệ quả cho cả bước 2:** mỗi lần thay implementation PHẢI là một cặp:

```yaml
- id: <row stock>
  disabled: true          # (1) tat row cua DSH
- insert:
    - id: <row>-ours      # (2) insert ban cua ta, giu nguyen inject + config
      name: '@galaxy-blackhole/gbh-<vai tro>'
```

Đúng cách `gbh-brand.patch.yml` của oracle đã làm với `ui-brand-official` → `gbh-brand`.

## 3. Cơ chế mount (chuẩn cho M4/M5/M6)

`bh host` (`ensureRewriteMounts` trong `apps/cli/src/mount.ts`) làm 3 việc, idempotent:

1. **Build** `packages/host/<pkg>/src/*.ts` → `lib/index.js` (ESM, target node, packages external) khi bản
   build cũ hơn nguồn. Bản build CHỈ nằm trong profile của app: bun build cắt comment, để trong repo là vỡ
   cổng header.
2. **Copy** package vào `<DSH_HOME>/profiles/node_modules/@galaxy-blackhole/<pkg>` — copy THẬT, không symlink
   (symlink sẽ khiến Node resolve peer về node_modules của repo, tức bản cordis thứ hai).
3. **Symlink peer** (`@deepseek-ai/cordis`, `@deepseek-ai/schemastery`) trong
   `<DSH_HOME>/profiles/node_modules/@deepseek-ai/` → bản kernel đang chạy ở `apps/host/node_modules/`.
   Cùng realpath ⇒ Node dùng đúng MỘT instance cordis, đúng khuôn `peerDependencies` của upstream.

Nếu mount/build thất bại: `bh host` in cảnh báo và bỏ khối patch tương ứng → app quay về row của DSH và vẫn boot
được; `bh doctor` hiện dòng `rewrite`.

Brand của M1 đi đường khác: nguồn ngoài chỉ đọc (galaxy-code) nên được symlink vào
`profiles/node_modules/@galaxy-stack/gbh-brand`.

## 4. Vì sao không shadow tên gói DSH

Có thể đặt gói của ta vào `profiles/node_modules/@deepseek-ai/dsh-host-webserver` để cây dump y như cũ. Đã loại:
nó giấu việc đã thay implementation khỏi mọi báo cáo, ngược G4, và trái C3 (đóng băng hành vi, không phải danh
tính gói).

## 5. Hệ quả cho cổng parity (bàn giao tm-parity)

| Chỉ số vs Oracle A | Trước M4a | Sau M4a (chờ bảng tương đương) |
|---|---|---|
| THÊM | 0 | **1** (`webserver-ours`) |
| ĐỔI | 0 | **1** (`webserver`: `disabled: true`) |
| `đã thay N row` | — | sẽ là **1** khi bảng tương đương nhận cặp disable+insert |

Quyết định của Lead: bảng tương đương lấy từ `docs/PARITY-MATRIX.md` tính cặp này là unchanged + `swappedRows++`;
tên lạ không có trong bảng vẫn là ĐỔI. Ràng buộc G4: mỗi row đã thay phải kèm test hành vi của package đó —
M4a là `tests/host/webserver.test.ts` (10 test).

## 6. Bằng chứng M4a (17/10/2026)

| Việc | Kết quả |
|---|---|
| App chạy implementation của ta | log 5439: `[bh] rewrite OK @galaxy-blackhole/gbh-host-webserver`; 0 dòng `name mismatch` / `failed to import` / `did not activate` |
| Cây plugin thật | `bh host --dump-config`: row `webserver` (stock) disabled + row `webserver-ours` → `@galaxy-blackhole/gbh-host-webserver` |
| HTTP 5439 | 200 · 48.882 B identity · **13.036 B khi client nhận gzip** · có `__DSH_BOOT__` |
| Test package | `tests/host/webserver.test.ts`: 10 test (route exact/prefix/fallback/404, upgrade, gzip, injection, địa chỉ) |
| Gate | `bun run gate` XANH 6/6 · 0 vi phạm · 0 cảnh báo |
| Cách ly home | `gate:home-isolation`: 1244 entry · 0 moved during boot · 0 unexplained |

## 7. Việc còn lại

1. tm-parity: bảng tương đương cho cặp disable+insert (⇒ `swappedRows`) và sửa bộ đếm đang in `đã thay 0 row`.
2. M4b: các row host/API tiếp theo (gateway, controller, Remote) theo đúng cơ chế này.
3. M5: `@galaxy-blackhole/gbh-brand` thay bản galaxy-code, bỏ phụ thuộc checkout ngoài.

## 8. Bug nghiêm trọng đã đóng: `String(Uint8Array)` phá mọi RPC của `/api/*` (17/10/2026)

**Triệu chứng:** mọi phản hồi `/api/*` của app là DÃY SỐ THẬP PHÂN của từng byte (hex `3132332c33342c31` = 
`123,34,1`), client parse lỗi (`ERR_INVALID_HTTP_RESPONSE`, `Unexpected non-whitespace character after JSON`)
⇒ plugin client không activate ⇒ UI mất sidebar/composer ⇒ hộp thoại xin Galaxy API key (vì RPC kiểm khoá cũng hỏng).
Oracle 4001 không có triệu chứng nào.

**Nguyên nhân:** trong bộ bọc nén, tầng trên (API gateway) ghi thân phản hồi bằng `Uint8Array`. Wrapper dùng
`Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), …)` — khi chunk KHÔNG phải Buffer, `String(uint8Array)` cho ra
danh sách byte dạng thập phân (ngữ nghĩa `Array.prototype.join`), rồi bị gzip bọc thêm.

**Cách sửa:** thêm `toBuffer()` dùng ở CẢ `res.write` và `res.end`: 
Buffer → giữ nguyên; ArrayBuffer view (Uint8Array/DataView) → `Buffer.from(chunk.buffer, byteOffset, byteLength)`;
ArrayBuffer → `Buffer.from(chunk)`; còn lại mới `String(...)`.

**Kiểm chứng (repro của Lead, cùng payload chỉ đổi Accept-Encoding):**

| Lần gọi | Kết quả |
|---|---|
| `POST /api/session/list` (identity) | 200 · 688 B · JSON hợp lệ · bắt đầu `{"type":"server-response"…` |
| `POST /api/session/list` + `Accept-Encoding: gzip` | 200 · 276 B · gunzip → JSON hợp lệ · **byte-for-byte trùng bản identity** |

Test hồi quy: `tests/host/webserver.test.ts` — `toBuffer` giữ đúng byte cho Uint8Array/DataView/ArrayBuffer/string;
`res.end(Uint8Array)` đúng byte ở cả hai nhánh identity và gzip; nhiều `res.write(Uint8Array)` rồi `end()` ghép đúng chuỗi gốc.

**Bài học:** mọi wrapper ở tầng vận chuyển phải coi thân phản hồi là BYTE, không bao giờ là chuỗi; `Buffer.isBuffer`
là phép thử hẹp hơn `ArrayBuffer.isView`.

## 9. `GBH_HOME` — khác biệt môi trường thật giữa app ta và oracle (17/10/2026)

**Đo được (chỉ in tên biến, không in giá trị):**

| Tiến trình | `DSH_HOME` | `GBH_HOME` |
|---|---|---|
| host của ta (trước khi sửa) | có | **KHÔNG có** (0 biến `GBH_*`) |
| oracle 4001 | có | có (cùng giá trị) |
| host của ta (sau khi sửa) | có | **có**, cùng giá trị app home |

**Vì sao quan trọng:** lớp Galaxy — không phải DSH — đọc biến này để định vị state:
`galaxy-code/src/web/paths.ts` (`process.env.GBH_HOME`) và
`galaxy-code/web/brand/lib/session-store.js` (duyệt `["DSH_HOME", "GBH_HOME"]`). Brand mà ta mount chính là
package đó, nên thiếu biến là chạy trong môi trường khác oracle.

**Cách sửa:** `hostChildEnv(home)` trong `apps/cli/src/host.ts` truyền thêm `GBH_HOME` = app home, dùng cho cả
đường boot lẫn `--dump-config`; không thêm biến nào khác. Test: env của tiến trình con có đủ hai biến và không rò
biến lạ.

**Quan hệ nhân quả (chính xác):** đây là **khác biệt môi trường, đã đóng độc lập** — KHÔNG phải nguyên nhân của sự
cố UI 13:07–13:40. Nguyên nhân của sự cố đó là bug `String(Uint8Array)` ở §8 (mọi RPC hỏng, kể cả RPC kiểm khoá), đã
chứng minh bằng repro byte-for-byte. `GBH_HOME` được truyền đủ để khớp oracle, đúng như một sửa parity — không hơn.

## 10. Công cụ chẩn đoán chuẩn: `GBH_DISABLE_REWRITES=1`

Bật biến này khi chạy `bh host` ⇒ `ensureRewriteMounts()` bỏ qua việc mount các package viết lại ⇒ `writeAppPatch`
tự bỏ mọi khối `<row>-ours` ⇒ các row stock của DSH được bật lại. Đây là công tắc A/B chuẩn để cô lập hồi quy của
TỪNG gói khi ta thay hàng chục row ở M4b/M5/M6:

```bash
cd <repo>
GBH_DISABLE_REWRITES=1 scripts/restart-host.sh   # stock: tat ban cu, cho nha cong, bat ban moi, xac nhan 200
scripts/restart-host.sh                          # ours: nhu tren
```

Đã kiểm chứng: với biến này cây dump có `webserver-ours = 0` và row `webserver` stock hoạt động; không có biến thì
`webserver-ours = 1`. Không cần sửa file patch bằng tay, không có nhánh code thứ hai.

## 11. Vì sao thay row phải là DỮ LIỆU của package (task-13, 17/10/2026)

**Vấn đề:** trước đây mỗi lần thay một row đều phải sửa cùng một chỗ — apps/cli/src/profile.ts (nơi sinh khối patch)
và profiles/blackhole/parity.patch.yml. Với 17 row T2 còn chịu được, nhưng M5 (~60 row client) và M6 (~77 row tool) thì
hai người không thể làm hai package song song: ai cũng phải chạm file dùng chung.

**Cách làm mới:** phần thay row nằm ngay trong package.json của chính package đó (trường gbh.row), apps/cli quét
packages/** để sinh khối patch. Thêm một package = TẠO THƯ MỤC, không sửa file nào khác.

    "gbh": {
      "row": {
        "id": "webserver",                        // row stock bị tắt
        "inject": ["webStartup"],                  // giữ nguyên như row stock (nếu có)
        "config": {                                // giữ nguyên config của row stock
          "host": { "js": "ctx.webStartup.host ?? '127.0.0.1'" },   // { js } => !!js <biểu thức>
          "compression": "gzip"
        },
        "tests": ["tests/host/webserver.test.ts"]  // test chứng minh tương đương
      },
      "peers": ["@deepseek-ai/dsh-typert-protocol"]  // chỉ với gói thuộc seam của kernel (luật §3b)
    }

**Cách thêm một package mới (3 bước):**

1. Tạo packages/<nhóm>/<tên>/ với package.json (khai gbh.row) + src/ + build.ts + README.md.
2. Thêm test hành vi vào tests/host/ và khai đường dẫn đó ở gbh.row.tests.
3. Chạy scripts/restart-host.sh — bh host tự quét, build, mount, và sinh khối disable + insert cho row đó.

**Bảo đảm giữ nguyên (đã kiểm chứng):**

| Bảo đảm | Cách kiểm |
|---|---|
| GBH_DISABLE_REWRITES=1 bỏ được MỌI mount | ensureRewriteMounts() trả ok: false cho tất cả ⇒ không khối nào được sinh |
| Mount lỗi ⇒ tự bỏ khối, quay về row DSH | writeAppPatch chỉ sinh khối cho mount ok; mount lỗi in cảnh báo và app vẫn boot |
| parity:dump vẫn PASS 0/0/0 và báo đúng số row đã thay | PASS THÊM 0 · THIẾU 0 · ĐỔI 0 · đã thay 2 row |

**Bằng chứng (17/10/2026):** bun run gate XANH 6/6 · bun test tests/host 58/58 · app boot 200 với hai dòng
[bh] rewrite OK @galaxy-blackhole/gbh-host-open-in-app · OK @galaxy-blackhole/gbh-host-webserver · /open-in-app/apps 55 B và
icon 12.418 B byte-for-byte như trước refactor · test fixture chứng minh thêm package mới không cần chạm file dùng chung
(có metadata ⇒ được nhận; thiếu metadata ⇒ bỏ qua, không vỡ).

**Chú ý thứ tự mount:** rewritePackages() sắp theo tên package để patch sinh ra ổn định giữa các lần chạy
(hiện tại: open-in-app trước webserver). Thứ tự này chỉ ảnh hưởng vị trí row trong cây, không ảnh hưởng parity (so theo id).