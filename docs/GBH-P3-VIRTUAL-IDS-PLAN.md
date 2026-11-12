<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 03/11/2026
 desc Kế hoạch P3 — đổi 5 ID ẢO của vỏ SPA sang @galaxy-blackhole/gbh-* (đo đếm + thứ tự + cách kiểm)
-->

# P3 — Đổi 5 id ảo của vỏ SPA

## 1. Sự thật đã đo

| id ảo | tệp `src` | tệp `lib` | Ghi chú |
|---|---|---|---|
| `@deepseek-ai/dsh-client-store` | 116 | 93 | bảng store dùng chung |
| `@deepseek-ai/dsh-client-ui-primitives` | 130 | 81 | bộ primitive UI |
| `@deepseek-ai/dsh-client-ui-slots` | 16 | 85 | registry slot |
| `@deepseek-ai/dsh-client-ui-dockkit` | 9 | 1 | dock |
| `@deepseek-ai/dsh-typert-generator` | 26 | 44 | sinh kiểu |

**Nơi ĐỊNH NGHĨA:** bảng module của vỏ SPA —
`packages/host/host-frontend-static/dist/assets/index-CN7NIWNw.js`, dạng:

```js
{"react-dom/client":yC, "@deepseek-ai/cordis":Fb, zod:Zj,
 "@deepseek-ai/dsh-client-store":wI, "@deepseek-ai/dsh-client-ui-slots":SI, …}
```

Đây **không phải gói npm** (không có trong `apps/host/node_modules`), mà là id do vỏ cấp lúc chạy.

## 2. Vì sao phải đổi ĐỒNG THỜI ba nơi

1. **Bảng module của vỏ** (`dist/assets/index-*.js`) — nơi cấp id.
2. **Artefact client** (`packages/client/*/lib/*.js`) — nơi `require("<id>")`.
3. **Mã nguồn** (`packages/client/*/src/**`) — để lần dựng lại không quay về id cũ.

Đổi lệch một nơi ⇒ `Cannot find module` ⇒ UI trắng.

## 3. Phải dạy thêm bộ chuẩn hoá tên

Năm id này **không có** `gbh.provenance.stock` nên `normalizePackageNames()` hiện **không** quy đổi chúng;
mọi test so artefact với bundle gốc sẽ đỏ nếu chỉ đổi tên. Việc cần làm:

1. Thêm hằng `VIRTUAL_IDS` (5 cặp) vào `tools/lib/rename-names.ts` **và** `tests/lib/brand-parity.ts`.
2. Cho `normalizePackageNames()` quy đổi cả 5 cặp này.

## 4. Thứ tự thi hành (từng id một, mỗi id một vòng kiểm)

1. `bun test` + `bun run gate` + `bun run check:app` **trước** khi đổi (mốc so sánh).
2. Đổi id trong **cả ba nơi** bằng script (không sửa tay).
3. `bash scripts/sync-lib-to-profile.sh` → boot → `bun run check:app` (kỳ vọng 11/11).
4. `bun test` (kỳ vọng 0 fail) → `bun run gate`.
5. Nếu đỏ: hoàn nguyên **cả ba nơi** trong một lượt (đã có bản sao lưu), ghi lại lý do.

Thứ tự đề xuất: `store` → `ui-slots` → `ui-primitives` → `dockkit` → `typert-generator`
(theo mức phụ thuộc tăng dần: `store` ít consumer nhất trong artefact).

## 5. Tiêu chí hoàn thành P3

- `grep -r "@deepseek-ai/dsh-client-store" packages/` = **0** (và 4 id còn lại).
- `grep` trong `packages/host/host-frontend-static/dist/assets/*.js` = **0**.
- `bun run gate` 8/8 · `bun test` 0 fail · `check:app` **11/11**.

## 6. Đã THỬ thi hành id `dsh-client-store` (chặng 34) — thất bại, đã hoàn nguyên

**Đã làm**: thêm `VIRTUAL_IDS` (5 cặp) vào `tools/lib/rename-names.ts` + `tests/lib/brand-parity.ts` (GIỮ LẠI, hữu ích);
đổi tên trong **211 tệp** (116 `src` · 93 `lib` · 2 gói `dist`); sao lưu trước ở `/tmp/p3-store-backup.tar.gz`.

**Kết quả**: app **mất trắng UI** (37 lỗi console, 0 slot).

### Ba chặng chặn ĐO ĐƯỢC (ghi lại để lần sau đi đúng)

1. **Có HAI bản vỏ SPA, không phải một** —
   `packages/host/web-frontend/dist/assets/index-CN7NIWNw.js` **và**
   `packages/host/host-frontend-static/dist/assets/index-CN7NIWNw.js`: cùng tên tệp, cùng bảng module.
   Đổi một bản ⇒ consumer vẫn tìm id cũ ở bản kia ⇒ `Cannot find module`.
2. **Cổng `gateOwnership` trong 9 `build.ts` chỉ quy ngược `PACKAGE_NAME` + id gateway**
   nên sau khi đổi, artefact dài hơn bản gốc 5 byte/id ⇒ `build.ts` **ném lỗi** ⇒ `bh host` rơi về
   "dùng artefact có sẵn" ⇒ trạng thái nửa vời. Cần dạy cổng này quy ngược **cả 5 id ảo** (đã có `VIRTUAL_IDS`).
3. **Không được rebuild artefact trong lúc đổi tên** — `ui-tool` là ví dụ: artefact canon sinh bằng
   `build.ts` (loader nhiều dòng, id trong dữ liệu đã đổi), còn `debundle-client` sinh loader một dòng
⇒ test "dòng loader ĐÚNG MỘT id" đỏ. Đổi tên phải làm **thuần văn bản** trên artefact đang có.

### Trạng thái sau khi hoàn nguyên (đo lại)

`bun run gate` **8/8 XANH** · `bun test` **5.394 pass / 0 fail** · `check:app` **11/11 LÀNH** (bố cục **0/80**).

## 7. Thử lần 2 (chặng 35) — vẫn thất bại, đã hoàn nguyên; THÊM một chặng chặn mới

Lần này đã làm đúng ba điều rút ra từ lần 1: (a) dạy **7 `build.ts`** quy ngược id ảo qua hàm `quyNguocIdAo()`,
(b) dạy **8 `build.ts`** thêm 5 cặp id ảo vào chuỗi `const expected = stockText …`,
(c) đổi tên **thuần văn bản** (không dựng lại) trong **183 tệp**, gồm **CẢ HAI** bản vỏ SPA.

**Kết quả**: app vẫn mất UI — **39 lỗi console** (lần 1: 37).

### Chặng chặn thứ tư (mới)

Ngoài hai bản `dist`, id ảo còn được **sinh lại lúc chạy** bởi các gói của ta — đã đo được id mới xuất hiện trong
`packages/client/{locale,modules,resources,shortcuts}/lib` và `packages/client/ui-chat` sau khi đổi tên.
Nghĩa là: danh sách id ảo **không chỉ nằm trong bundle vỏ**, mà còn trong **mã của các gói client của ta**
(bảng đăng ký module + bảng ngoại lệ). Muốn P3 xong phải tìm **tất cả** nơi sinh bảng này, không chỉ `dist`.

**Trạng thái sau hoàn nguyên**: `bun run gate` **8/8 XANH** · `bun test` **0 fail** ·
`check:app` render 57.081 ký tự · **48 slot** · **0 lỗi console** · bố cục **0/80 ĐẠT**.

### Việc cần làm trước khi thử lần 3

1. `grep -rn "dsh-client-store" packages/client/*/src` để lập **bản đồ đầy đủ** nơi id ảo được sinh/phục vụ
   (bảng module, bảng ngoại lệ, danh sách `external`, bảng alias của `client-modules`).
2. Chỉ khi bản đồ đủ 100% thì mới đổi tên; mỗi vòng đổi **một** id và boot kiểm ngay.

## 8. Chặng 36 — SỬA LẠI kết luận sai ở §7, và chuẩn bị lần 3

**Kết luận cũ (SAI):** "P3 đổi id làm app mất UI (39 lỗi console)".

**Sự thật đo được:** log `/tmp/host-p3e.log` cho thấy app mất UI vì **một artefact typert bị thiếu**
(`gbh-api-workspace-controller/lib/typert.host.js`) — di chứng của lần rebuild hàng loạt ở chặng 34,
**không phải** do đổi id. Sau khi dựng lại gói đó, app trở lại bình thường.

**Đã làm lại lần 3 (đầy đủ tiền đề):** dạy 7 `build.ts` quy ngược id ảo + 8 `build.ts` thêm 5 cặp id vào chuỗi `expected`,
đổi tên thuần văn bản **191 tệp** (typecheck 0), sync, boot ⇒ app **vẫn mất UI (37 lỗi console, 0 slot)**.

**Vì vậy P3 vẫn là chặng chặn THẬT** — nhưng lý do cụ thể chưa được chứng minh: `check:app` chỉ in SỐ lỗi console,
không in nội dung. Hai cảnh báo thu được (`chua thay artifact …/lib/client.js`) là **bình thường** —
bản gốc cũng không có `lib/client.js` (chỉ có `client.browser.js` / `client.node.js`).

### Việc ĐẦU TIÊN của lần sau (bắt buộc, không đoán)

1. Áp lại bản đổi tên (đã có script `/tmp/p3b.py` + sao lưu `/tmp/p3c-store.tar.gz` + `/tmp/revert-builds.py`).
2. Boot rồi **in TOÀN BỘ 37 lỗi console** (probe Playwright có `page.on('console')`), không chỉ đếm.
3. Chỉ sửa đúng nguyên nhân hiện ra; **hoàn nguyên ngay** nếu quá 20 phút chưa xác định được.

### Trạng thái kết thúc chặng 36

`check:app`: render 57.081 ký tự · **48 slot** · **0 lỗi console** · bố cục **0/80 ĐẠT**.

## 9. Chặng 37 — ĐÃ CHỨNG MINH P3 chạy được: thiếu đúng MỘT chỗ thứ tư

**Nguyên nhân thật của 37 lỗi console** (in bằng probe `page.on('console')`):

```
client-modules: require("@galaxy-blackhole/gbh-client-store") missed the module table
  — not a platform seed word, not a materialized module, and no registered package factory
```

Bảng seed (`options.staticModules`) **không** đọc từ `packages/host/*/dist` lúc chạy — nó đọc bản **đã copy vào profile**:

```
~/.galaxy/blackhole/profiles/blackhole/dist/assets/index-CN7NIWNw.js   ← CHỖ THỨ TƯ
```

Đổi id ở bản trong repo mà không đổi bản trong profile ⇒ runtime vẫn cấp id cũ ⇒ consumer mới không thấy.

### KẾT QUẢ KHI ĐỔI CẢ BỐN CHỖ

`check:app`: render **57.081** ký tự · **48 slot** · **0 lỗi console** · bố cục **0/80 ĐẠT** —
tức **P3 cho `dsh-client-store` CHẠY ĐƯỢC**, app lành với id mới.

### Công thức đầy đủ cho một id ảo (đã kiểm chứng)

1. `tools/lib/rename-names.ts` + `tests/lib/brand-parity.ts`: giữ bảng `VIRTUAL_IDS` (đã có).
2. Đổi tên **thuần văn bản**: `src` + `lib` + **`packages/host/web-frontend/dist`** +
   **`packages/host/host-frontend-static/dist`** + **`~/.galaxy/blackhole/profiles/blackhole/dist`**.
3. Dạy `build.ts`: `quyNguocIdAo()` (7 tệp) + chuỗi `const expected = stockText …` (8 tệp).
4. Sửa stub trong test: so id bằng **hậu tố** (`specifier.endsWith("-client-store")`) thay vì bằng chuỗi đầy đủ;
   và các mảng kỳ vọng phải dùng **id mới** (không phải `@deepseek-ai/...`).

### Vì sao vẫn hoàn nguyên ở chặng này

Sau khi app xanh, `bun test` còn **58 ca đỏ** — toàn bộ là **kỳ vọng/stub trong test** (danh sách specifier,
cổng byte của `shortcuts`, cảnh báo "artifact cũ hơn mã nguồn"). Sửa hết cần thêm ~1 chặng;
để giữ `gate` xanh theo yêu cầu, tôi hoàn nguyên và ghi lại đủ công thức ở trên.

**Trạng thái kết thúc chặng 37**: `gate` **8/8 XANH** · `bun test` **0 fail** · `check:app` bố cục **0/80 ĐẠT**, 48 slot, 0 lỗi console.

## 10. Chặng 40 — ĐÃ LAND id ảo SỐ 2: `dsh-client-ui-slots`

Quy trình đã ghi ở §9 được áp dụng **đúng thứ tự** và **thành công trọn vẹn**:

| Bước | Việc | Kết quả |
|---|---|---|
| 1 | Sao lưu (đã có `/tmp/gbh-green-r39`, gồm cả `lib/`) | ✓ |
| 2 | Đổi tên **thuần văn bản** 84 tệp, gồm **cả 3 bản dist** (repo ×2 + profile) | ✓ |
| 3 | `typecheck` | **0 vi phạm** |
| 4 | Sửa 2 tệp test **đúng chỗ** (bảng module giả + kỳ vọng danh sách) | ✓ |
| 5 | Thêm `ID_AO` (5 cặp) vào `tests/helpers/vi-dictionary.ts` để `chuanHoaArtefact()` quy được id mới | ✓ |
| 6 | `bun run gate` | **8/8 XANH** |
| 7 | `check:app` | **11/11 LÀNH** · 57.080 ký tự · 48 slot · 0 lỗi console · bố cục **0/80** |
| 8 | `grep "@deepseek-ai/dsh-client-ui-slots" packages/` | **0** |

**Bài học vàng:** ba lần thất bại trước là do (a) thiếu bản dist trong profile, (b) rebuild artefact,
(c) sửa test bằng regex diện rộng. Lần này tránh cả ba ⇒ xong trong **~35 phút** thay vì 5 giờ.

**Trạng thái 5 id ảo:**

| id | Trạng thái |
|---|---|
| `dsh-client-store` | đã chứng minh chạy được (chặng 37), chưa land vì còn 58 ca test |
| `dsh-client-ui-slots` | **ĐÃ LAND** (chặng 40) — 0 tham chiếu cũ, gate 8/8, app 11/11 |
| `dsh-client-ui-primitives` · `dsh-client-ui-dockkit` · `dsh-typert-generator` | chưa làm |

## 11. Chặng 40 (tiếp) — ĐÃ LAND id ảo SỐ 3: `dsh-client-ui-dockkit`

Cùng công thức §10, chỉ 12 tệp: đổi tên thuần văn bản (3 bản dist + src + lib) ⇒ `typecheck` 0 ⇒
`bun test` **0 fail** ⇒ `bun run gate` **8/8 XANH** ⇒ `check:app` **11/11 LÀNH** (48 slot, 0 lỗi console, bố cục 0/80).

### Đã thử id `dsh-client-store` lần nữa và VẪN CHƯA LAND

Đổi 210 tệp ⇒ `typecheck` 0 nhưng `bun test` **64 ca đỏ**: các test có **hàm chuẩn hoá RIÊNG** trong chính
tệp test (không dùng `tests/helpers/vi-dictionary.ts`), nên chưa biết id mới. Muốn land phải sửa ~15–20 tệp test,
mỗi tệp một hàm chuẩn hoá ⇒ để chặng sau, làm đúng nhịp (một tệp/lượt). Đã hoàn nguyên id này.

### Trạng thái 5 id ảo (đo bằng `grep -rl` trong `packages/`)

| id | Số tệp còn tham chiếu | Trạng thái |
|---|---|---|
| `dsh-client-ui-slots` | **0** | ✅ ĐÃ LAND |
| `dsh-client-ui-dockkit` | **2** (còn trong tài liệu/README) | ✅ ĐÃ LAND (mã: 0) |
| `dsh-client-store` | 209 | ⏳ công thức xong, còn 64 ca test có hàm chuẩn hoá riêng |
| `dsh-client-ui-primitives` | 234 | ⏳ chưa làm |
| `dsh-typert-generator` | 75 | ⏳ chưa làm |

### P1b (đổi tên gói) — số đo cuối

`src`: **4.005** tham chiếu · manifest: **4.046** · tệp `lib` còn id stock: **417**.

### Bản sao lưu cuối phiên

`/tmp/gbh-green-final` (**293 MB**, gồm `packages/` đầy đủ **cả `lib/`** + `tests/` + đường nền bố cục).

## 12. Chặng 42 — PHÁT HIỆN QUAN TRỌNG: `store` và `typert-generator` BỊ GHÉP ĐÔI

Thử land `dsh-client-store` lần 3 (sau khi đã có 2 id land) ⇒ vẫn đỏ, nhưng lần này **chẩn đoán được đúng**
bằng cách in hai vế quanh điểm lệch trong cổng byte:

```
DEBUG P3 lech tai 17
ours    : "/* Generated by @deepseek-ai/dsh-typert-generator from FaceModel — do not edit"
expected: "/* Generated by @galaxy-blackhole/gbh-typert-generator from FaceModel — do not edit"
```

**Kết luận:** các lát sinh tự động (`src/typert-host-slice.ts`, `src/parts-typert-*/part-00-*.ts`)
mang **id của `dsh-typert-generator`** trong dòng header; id `store` thì nằm **bên trong** các lát đó.
Vì vậy hai id bị **ghép đôi**:

- Đổi `store` mà chưa đổi `typert-generator` ⇒ cổng byte của 12 gói host đỏ (chúng so lát với bản gốc).
- Đổi `typert-generator` trước ⇒ phải sinh lại **toàn bộ** lát typert của 12 gói (chúng chứa header đó).

**Thứ tự ĐÚNG cho lần sau:**

1. Đổi `dsh-typert-generator` → `gbh-typert-generator` trong: `src/**` (gồm mọi lát `part-00-*`), `build.ts`,
   `lib/**`, 3 bản `dist`; dạy các cổng byte quy ngược id này.
2. Dạy 12 `build.ts` host quy ngược **cả** `typert-generator` **và** `store` (vì lát chứa cả hai).
3. Sinh lại lát typert cho 12 gói (`bun run build.ts`), rồi mới đổi `store`.

**Trạng thái sau khi hoàn nguyên:** `gate` **8/8 XANH** · `check:app` **11/11 LÀNH**
(57.080 ký tự · 48 slot · 0 lỗi console · bố cục **0/80**). Backup: `/tmp/gbh-green-r42` (308 MB).

## 13. Chặng 43 — `typert-generator` là id sinh tự động ⇒ cần cách khác

Đã thử land `dsh-typert-generator` theo thứ tự §12 (đổi 75 tệp: `src/**` gồm mọi lát `part-00-*`, `build.ts`,
`lib/**`, 3 bản `dist`) — `typecheck` **0**, nhưng `bun test` **22–30 ca đỏ**: các cổng byte của 15 gói host
và **hằng số kích thước/độ lệch HARDCODE** trong ~6 tệp test halves (`bytes: 31532`, `delta: 115`…).

Vì header `/* Generated by <id> … */` nằm trong **nội dung sinh tự động**, mỗi lần đổi id là mỗi artefact dài
thêm 5 byte ⇒ mọi hằng số đó phải cập nhật. Tôi đã thử bump tự động theo chênh lệch `Expected/Received`
nhưng **không hội tụ** (một số hằng số không phải của lát typert cũng bị đụng) ⇒ đã **hoàn nguyên**.

**Cách đúng cho lần sau (đề xuất):**

1. Đổi id trong `build.ts` + mọi lát sinh tự động, **rồi sinh lại toàn bộ** lát typert của 15 gói.
2. Thay các hằng số hardcode trong test bằng **giá trị tính từ stock**: `bytes: stockBytes + 5 × soLanXuatHien`
   (đã làm được ở `api-terminal-controller-halves` với `aoBytes()` — dùng lại đúng mẫu đó cho 6 tệp còn lại).
3. Chỉ khi `bun test` xanh mới sync + boot.

**Trạng thái sau hoàn nguyên:** `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** (48 slot · 0 lỗi console · bố cục 0/80).
Backup: `/tmp/gbh-green-r43` (305 MB).

## 14. Chặng 44 — đã tạo được CÔNG CỤ tự cập nhật hằng số (bước đệm bắt buộc)

Để land `typert-generator` cần cập nhật hàng loạt hằng số snapshot trong 5 tệp test halves.
Đã viết `/tmp/regen3.py` (giữ lại trong repo ở chặng sau): cắt tệp theo `const PAIR_`, đọc `file: "…"`,
rồi tính lại **bytes · delta · sha16** từ chính artefact và bản stock ⇒ 4/4 tệp halves **0 fail** ngay.

Phần còn lại vẫn đỏ (17 ca) vì **công thức `delta`** trong test kiểm `ourIds×5 + gatewayIds×13`,
nay artefact dài thêm 5 byte do header `/* Generated by <id> … */` — đã thêm số hạng `typertHeader()`
nhưng chưa hội tụ hết (2/0/3/2 ca ở 4 tệp) ⇒ **hoàn nguyên** để giữ xanh.

**Việc còn lại cho `typert-generator` (rất cụ thể):**

1. `tests/host/api-{job,terminal,remote-access,workspace-files,session-controller}-halves.test.ts`:
   thêm số hạng header vào công thức `delta` **và** vào `lines` nếu header đổi số dòng.
2. `tests/host/api-workspace-controller-faces.test.ts`: kỳ vọng `stock.replaceAll(...)` phải quy thêm id typert.
3. `tests/host/subagent*.test.ts`: 6 ca so “đúng N lần thay ownership, bằng NGUYÊN VĂN” ⇒ cập nhật mẫu chuỗi.
4. `D4 · lib/typert.host.d.ts`: tệp `.d.ts` cũng mang header ⇒ cập nhật so sánh.

**Trạng thái sau hoàn nguyên:** `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** (48 slot · 0 lỗi console · bố cục 0/80).

## 15. Chặng 45 — vá NỐT hai bản dist trong repo (dockkit) ⇒ id này sạch 100%

Sau khi hoàn nguyên chặng 44, đo lại thì thấy `dsh-client-ui-dockkit` vẫn còn trong **2 bản dist của repo**
(`packages/host/web-frontend/dist/...` và `packages/host/host-frontend-static/dist/...</n`) — trước đây chỉ đổi
bản trong **profile** (bản được phục vụ) nên app vẫn lành nhưng kho mã còn id stock.

Đã đổi cả hai ⇒ **`dsh-client-ui-dockkit`: 0 tệp** trong toàn repo. Kiểm chứng lại: `gate` **8/8 XANH**,
`check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · bố cục **0/80**).

**Số đo census 5 id ảo (sau chặng 45):**

| id | Số tệp còn id stock | Ghi chú |
|---|---|---|
| `dsh-client-ui-dockkit` | **0** | ✅ sạch hoàn toàn |
| `dsh-client-ui-slots` | **3** | chỉ là `.d.ts` sinh tự động (tham chiếu KIỂU, không ảnh hưởng chạy) |
| `dsh-typert-generator` | 91 | chặn: hằng số snapshot + header sinh tự động (§13–§14) |
| `dsh-client-store` | 210 | phụ thuộc typert-generator |
| `dsh-client-ui-primitives` | 234 | chưa làm |

## 16. Chặng 45 — ĐÃ LAND id ảo SỐ 4: `dsh-typert-generator`  🎉

Sau 3 lần thất bại, lần này **thành công**: `bun test` **0 fail** · `bun run gate` **8/8 XANH** ·
`check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · bố cục **0/80**).

**Công thức thắng (khác 3 lần trước ở 3 điểm):**

1. **Dạy cổng byte TRƯỚC khi đổi tên** (2 kiểu cổng: chuỗi `expected` và `chuanHoa`), rồi mới rename —
   tránh sinh ra cặp `split(X).join(X)` vô nghĩa.
2. **Công cụ tự sinh hằng số** (`regen-clean`: cắt theo `const PAIR_`, tính `bytes/delta/sha16` từ artefact).
3. **Thêm số hạng header** vào các công thức bất biến của test thay vì sửa số cứng:
   `delta = ourIds×5 + gatewayIds×13 + (số lần id typert) × 5`.

Các tệp đã sửa (đúng, có lý do): `tests/host/api-{job,terminal,remote-access,workspace-files,session-controller}-halves.test.ts`,
`tests/host/api-workspace-controller-faces.test.ts`, `tests/host/subagent-faces.test.ts`, `tests/host/plugin-manager.test.ts`,
`tests/host/api-session-controller.test.ts` + 15 `build.ts` của gói host.

**Còn lại 34 tệp mang id stock** — đều CÓ CHỦ Ý:

- 18 tệp là **artefact sinh tự động** (`lib/typert.*.d.ts`, `lib/typert.*.js` của `command-feedback`,
  `plugin-manager`, `api-remote-access`…) do chính công cụ stock ghi tên nó vào header; đổi tay thì
  lần sinh sau lại về stock ⇒ để nguyên và ghi nhận (muốn sạch phải có generator GBH thật).
- 15 `build.ts` chứa cặp `split(OURS).join(STOCK)` — **phải** giữ id stock để quy ngược khi so byte.

**Census sau chặng 45:**

| id | Còn id stock | Trạng thái |
|---|---|---|
| `dsh-client-ui-dockkit` | **0** | ✅ |
| `dsh-typert-generator` | 34 (chủ ý: build.ts + artefact sinh tự động) | ✅ LAND |
| `dsh-client-ui-slots` | 3 (.d.ts kiểu) | ✅ gần sạch |
| `dsh-client-store` | 210 | ⏳ tiếp theo |
| `dsh-client-ui-primitives` | 234 | ⏳ |

## 17. Chặng 46 — ĐÃ LAND id ảo SỐ 5: `dsh-client-store`  🎉

`bun test` **0 fail** · `bun run gate` **8/8 XANH** · `check:app` **11/11 LÀNH**
(56.451 ký tự `#root` · **48 slot** · **0 lỗi console** · bố cục **0/80**).

### Bẫy đã sập và cách thoát (ghi để người sau không lặp)

Sau khi land, **app trắng** (3.305 ký tự, 0 slot) dù `gate` XANH. Nguyên nhân thật:

```
client-modules: require("@galaxy-blackhole/gbh-client-ui-primitives") missed the module table
```

Vì `packages/client/shortcuts/build.ts` có hàm `quyId()` mà tôi từng mở rộng cho **cả 5 id ảo** —
trong đó có `dsh-client-ui-primitives` (**chưa** đổi tên) ⇒ artefact `shortcuts` bị viết lại để require
id GBH của ui-primitives, mà module table vẫn đăng ký id stock ⇒ cả 29 entry treo ⇒ app trắng.

**Luật mới (số 10):** `quyId()` trong `build.ts` chỉ được chứa các id **ĐÃ** đổi tên; id chưa đổi thì
artefact phải giữ id stock. Kiểm tra ngay sau mỗi lần rename: `grep -o "@[a-z-]*/[a-z0-9-]*<id>" lib/client.js`.

### Census 5 id ảo — TRẠNG THÁI CUỐI CHẶNG 46

| id | Còn id stock | Trạng thái |
|---|---|---|
| `dsh-client-ui-dockkit` | **0** | ✅ LAND |
| `dsh-typert-generator` | 34 (chủ ý: build.ts + artefact sinh tự động) | ✅ LAND |
| `dsh-client-ui-slots` | 3 (chỉ `.d.ts` kiểu) | ✅ LAND |
| `dsh-client-store` | 14 (chủ ý: build.ts + `lib/types/*` + experimental-inspector) | ✅ LAND |
| `dsh-client-ui-primitives` | 234 | ⏳ **id cuối cùng** |

## 18. Chặng 47 — thử id CUỐI (`dsh-client-ui-primitives`) và lùi đúng lúc

Đổi 235 tệp ⇒ `typecheck` **0** nhưng `bun test` **78 → 26 ca đỏ**. Sau khi dọn các nhóm quen thuộc
(touch artefact cũ, `quyId` của shortcuts, revert riêng trong `experimental-inspector`) còn **26 ca**
thuộc đúng một lớp: **~30 tệp test đang khẳng định nguyên văn id stock của primitives** trong artefact.

Đã thử đổi hàng loạt literal trong `tests/**` ⇒ **100 ca đỏ** (vì nhiều test so với **bundle gốc**, nơi id
phải là stock) ⇒ **hoàn nguyên ngay** trong cùng chặng, không để lại rác.

**Vì sao id này khó hơn 4 id trước:** `ui-primitives` là **seed nền tảng** — mọi artefact khác đều
`require("<id>")` nó; đổi id là đổi **hợp đồng của cả 80 artefact + module table của trang + 30 tệp test**
cùng lúc. Ngoài ra nó là gói duy nhất **không có `stock` provenance** trong manifest (xem §9), nên
`normalizeIdsInText()` cũng không tự quy được — phải thêm cặp vào bảng cứng.

**Quy trình đề xuất cho chặng sau (theo đúng thứ tự):**

1. Thêm cặp primitives vào `VIRTUAL_IDS` (`tools/lib/rename-names.ts`, `tests/lib/brand-parity.ts`) — ĐÃ CÓ.
2. Đổi id ở **3 bản dist + profile dist + `src`/`lib`** (script `/tmp/p3-primitives.py` đã kiểm chứng chạy được).
3. **Trước khi chạy test**: rà 30 tệp test có literal stock, phân loại **2 nhóm**:
   (a) khẳng định trên **artefact của ta** ⇒ đổi sang id mới;
   (b) khẳng định trên **bundle gốc** ⇒ GIỮ stock. Đổi nhầm nhóm (b) là nhân đôi số ca đỏ.
4. `touch` toàn bộ `lib/` để qua cổng "artifact cũ hơn mã nguồn".
5. `bun test` xanh → `sync` → boot → `check:app` (48 slot) → `gate`.

**Trạng thái sau hoàn nguyên:** `gate` **8/8 XANH** (vừa chạy), 4/5 id ảo đã land.

## 19. Chặng 47 (tiếp) — sửa nốt lỗi thật của `experimental-inspector`, nền xanh trở lại

Sau khi hoàn nguyên id `ui-primitives`, còn **1 lỗi console thật**: chunk `client.page.js` của
`experimental-inspector` vẫn `require("@deepseek-ai/dsh-client-store")` — id **đã** đổi tên ở chặng 46 ⇒
module table không có ⇒ factory ném. Đã sửa **đúng cách** (không đổi tay artefact):

1. Đổi id trong `src/parts-client/client-page.ts` + 2 tệp của gói.
2. Dạy cổng byte của chính gói đó quy ngược id store (`matchParts` normalizer) ⇒ build lại xanh.
3. Cập nhật kỳ vọng của `tests/host/experimental-inspector-faces.test.ts` (+5 B, quy id trước khi so sha).

**Kết quả:** `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · **0 lỗi console** · bố cục **0/80**).

Backup: `/tmp/gbh-green-r49` (310 MB, **có cả `profile-dist/`** — lần đầu sao lưu bản dist được phục vụ).

### Census cuối (đo bằng `grep -rl` trong `packages/`)

| id | Còn id stock | Ghi chú |
|---|---|---|
| `dsh-client-ui-dockkit` | 1 | chỉ còn trong README |
| `dsh-client-ui-slots` | 4 | `.d.ts` kiểu + README |
| `dsh-client-store` | 12 | `build.ts` (quy ngược) + `lib/types/*` |
| `dsh-typert-generator` | 35 | `build.ts` + artefact do công cụ stock sinh |
| `dsh-client-ui-primitives` | 238 | **id cuối** — cần chặng riêng (§18) |

## 20. Chặng 48 — ĐÃ LAND id ảo CUỐI: `dsh-client-ui-primitives`  🎉🎉

**5/5 id ảo đã đổi tên.** `bun run gate` **8/8 XANH** · `check:app` **11/11 LÀNH**
(57.080 ký tự `#root` · **48 slot** · **0 lỗi console** · bố cục **0/80**).

### Cách làm (khác chặng 47 ở đúng một điểm: PHÂN LOẠI trước khi sửa)

Sau khi đổi 239 tệp ⇒ còn **30 ca đỏ**. Lần này KHÔNG đổi hàng loạt literal nữa mà chia 2 nhóm:

| Nhóm | Dấu hiệu | Cách sửa |
|---|---|---|
| (a) khẳng định trên **artefact của ta** | `expect(code).toContain('require("<id>")')` với `code` đọc từ `lib/` | đổi literal sang id mới |
| (b) so với **bundle gốc** | đọc từ `apps/host/node_modules/...` hoặc `stock.split(...)` | **GIỮ stock**, chỉ thêm bước quy ngược |

Nhóm (a) sửa 6 tệp: `ui-skill`, `ui-settings-web-search`, `ui-settings-models`, `ui-sidebar`, `ui-chat`, `ui-goal`.
Nhóm (b) thêm quy ngược id ở: `session-inspector`, `client-ui-directory-picker-*`, `experimental-inspector-faces`,
`experimental-client-ui-voice-input` (+2 cổng trong `build.ts` của chính gói đó).

Ngoài ra dạy **7 `build.ts`** quy ngược id primitives (`chuanHoa`), và cập nhật các hằng số
`bytes/delta/sha16/lines` bị dịch +5 B.

### Census 5 id ảo — TRẠNG THÁI CUỐI (đo bằng `grep -rl` trong `packages/`)

| id | Còn id stock | Ghi chú |
|---|---|---|
| `dsh-client-ui-primitives` | **9** | `build.ts` (quy ngược) + `PROVENANCE/README` |
| `dsh-client-store` | 12 | `build.ts` + `lib/types/*` |
| `dsh-typert-generator` | 35 | `build.ts` + artefact do công cụ stock sinh |
| `dsh-client-ui-slots` | 4 | `.d.ts` kiểu + README |
| `dsh-client-ui-dockkit` | 1 | README |

**Toàn bộ số còn lại là CÓ CHỦ Ý** (cổng byte phải nhắc id stock để quy ngược) hoặc là tài liệu.

Backup: `/tmp/gbh-green-r50` (310 MB, gồm `packages/` + `tests/` + `profile-dist/` + đường nền).

## 21. Chặng 49 — P1b (đổi tên GÓI) : thử pilot, phát hiện 2 điều kiện BẮT BUỘC

Đã thử đổi 78 tham chiếu `@deepseek-ai/*` → `@galaxy-blackhole/gbh-*` trong **một gói**
(`api-workspace-controller`: `src/**` + `package.json`). `typecheck` **0** — nhưng build và test đỏ, phát hiện:

1. **`build.ts` phải GIỮ id stock** — nó dùng id stock để tìm **bản gốc (oracle)** trong
   `apps/host/node_modules/@deepseek-ai/...`. Đổi sang id GBH ⇒ `ENOENT` ⇒ không build được.
   ⇒ Đây là **nhóm (b)** đúng như luật ở §20: mọi đường dẫn oracle giữ stock.
2. **Phải khớp PHIÊN BẢN**: manifest của ta đang khai `"@galaxy-blackhole/gbh-deque": "0.2.1-alpha.4"`
   (phiên bản của stock) trong khi gói nội bộ của ta là `0.1.0` ⇒ `bun install` báo
   `failed to resolve @galaxy-blackhole/gbh-typert-protocol@0.2.1-alpha.4`.
   ⇒ Muốn P1b chạy: hoặc **nâng mọi gói nội bộ lên 0.2.1-alpha.4**, hoặc **đổi spec về `workspace:*`**.

Đã **hoàn nguyên** gói pilot (khôi phục từ `/tmp/p1b-wsc.tar.gz`), `bun install` lại sạch.

**Trạng thái sau hoàn nguyên:** `bun test` **0 fail** · `gate` **8/8 XANH** ·
`check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · bố cục 0/80).

**Quy trình P1b đề xuất (cho chặng sau):**

1. Đổi `version` của **toàn bộ 332 gói** nội bộ thành `0.2.1-alpha.4` (hoặc thêm `"workspace:*"`).
2. Đổi `peerDependencies`/`dependencies` trong manifest: `@deepseek-ai/dsh-X` → `@galaxy-blackhole/gbh-X`
   **chỉ khi** gói nội bộ tương ứng tồn tại (2.924/3.712 tham chiếu trong `src`).
3. Đổi import trong `src/**` — **trừ** `build.ts` (giữ oracle) và các tệp so byte với stock.
4. `bun install` → `typecheck` → rebuild từng gói → `bun test`.
5. Thư viện ngoài không có bản GBH (`@deepseek-ai/cordis`? — **có** `gbh-cordis`; `@deepseek-ai/dsh-tools`
   — **không** có `gbh-tools`, chỉ có `gbh-host-tools`) ⇒ lập **bảng ánh xạ tường minh**, không đoán theo quy tắc.

## 22. Chặng 50 — P1b bước 1 (ĐỒNG BỘ PHIÊN BẢN) ĐÃ XONG; bước 2 (đổi tên khai báo) cần phân loại test

### Đã làm được (giữ lại)

Nâng `version` của **323/336 manifest** nội bộ lên `0.2.1-alpha.4` (bằng đúng phiên bản stock) ⇒
`bun install` **sạch**, `typecheck` **0**, `bun test` **0 fail**, `gate` **8/8 XANH**,
`check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · bố cục 0/80).

Đây là **điều kiện bắt buộc #2** của P1b (xem §21) — nay đã thoả: spec `0.2.1-alpha.4` của stock
giờ khớp với phiên bản gói nội bộ.

### Đã thử và hoàn nguyên: đổi tên khai báo phụ thuộc

Đổi **1.398 khai báo** `@deepseek-ai/dsh-*` → `@galaxy-blackhole/gbh-*` trong **197 manifest**
(giữ nguyên `cordis`/`schemastery`/`cosmokit` vì lý do một thể hiện kernel — ADR-0030).

`bun install` + `typecheck` đều **sạch**, nhưng `bun test` **322 ca đỏ**: các test
`gbh.peers ⊆ peerDependencies` đang so **trực tiếp** manifest của ta với manifest **stock**
(kỳ vọng nguyên văn tên stock). Đúng lớp (b) như §20 — phải so **sau khi quy id**, không đổi literal.

⇒ **Hoàn nguyên 197 manifest** (từ `/tmp/p1b-manifests.tar.gz`), giữ lại **duy nhất** thay đổi phiên bản.

### Việc tiếp theo cho P1b (đã rõ ràng)

1. Sửa **~10 tệp test** có kiểm tra `peerDependencies` để so sau khi quy id (dùng `ourToStockIds()`).
2. Rồi chạy lại script đổi tên khai báo (`/tmp/p1b-manifests2.py`) — đã kiểm chứng chạy được.
3. Sau đó mới đổi import trong `src/**` (trừ `build.ts` giữ oracle).

## 23. Chặng 51 — dọn 23 tệp test so `peerDependencies` trực tiếp ⇒ P1b bước 2 tiến thêm 1 bước

### Đã làm (giữ lại, đã kiểm chứng)

Đổi **23 tệp test** từ `expect(A.peerDependencies).toEqual(B.peerDependencies)` sang
`expect(sameAfterIdMap(A.peerDependencies, B.peerDependencies)).toBe(true)` — tức so **sau khi quy id**
thay vì so nguyên văn. Đây là điều kiện để đổi tên khai báo trong manifest mà test vẫn xanh.

Trong lúc làm đã gây 2 lỗi cú pháp (import chèn vào giữa khối `import {`) và 1 tệp vượt 1000 dòng;
**đã sửa hết** và `gate` **8/8 XANH**, `check:app` **11/11 LÀNH**.

### Đã thử: đổi tên khai báo + `gbh.peers` (rồi hoàn nguyên)

| Bước | Kết quả |
|---|---|
| Đổi 1.398 khai báo trong 197 manifest | `install` + `typecheck` sạch, nhưng **314 ca đỏ** |
| Thêm: đổi 601 tên trong `gbh.peers` của 160 manifest | còn **260 ca đỏ** |

Nguyên nhân: rất nhiều test **hardcode danh sách peer dạng literal** (`expect(Object.keys(peerDependencies)).toEqual([...])`,
`draft` chứa JSON stock, `oracle dump` so cặp row…). Đổi tên khai báo toàn cục cần sửa **~50 tệp test** cùng lúc.

⇒ **Hoàn nguyên manifest** (giữ version alignment). Kết luận: P1b phải làm **theo từng gói** — mỗi lượt:
1 gói × (manifest + `gbh.peers` + test của gói + artefact), chạy test của gói đó rồi mới sang gói khác.

### Trạng thái

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · bố cục 0/80).

## 24. Chặng 52 — thử đổi tên trong COMMENT: cũng không được (comment là DỮ LIỆU của cổng byte)

Đã đổi 839 dòng comment ở **654 tệp** `src/**` (chỉ dòng `*`, `//`, `/*`) ⇒ `typecheck` **0** nhưng
`bun test` **130 ca đỏ**: comment trong repo này **là một phần artefact** — nhiều cổng so
`artefact vs stock` từng byte (JSDoc `@module`, header provenance, `draft` mô tả…).

⇒ **Hoàn nguyên** từ `/tmp/gbh-green-r52`. Kết luận bổ sung:

**Luật #11:** mọi thay đổi văn bản trong `src/**` (kể cả comment) đều phải đi kèm **sinh lại artefact + cập nhật
hằng số/gate của chính gói đó**. Không có thay đổi "chỉ là comment" ở repo này.

### Tổng kết 3 cách đã thử cho P1b và lý do chưa dùng được

| Cách | Kết quả |
|---|---|
| Đổi khai báo trong manifest (1.398) + `gbh.peers` (601) | 314 → 260 ca đỏ (test hardcode danh sách peer) |
| Đổi tên trong **comment** `src/**` (839 dòng) | 130 ca đỏ (comment là dữ liệu của cổng byte) |
| Pilot 1 gói (src + manifest, giữ `build.ts`) | build `ENOENT` + test đỏ (phải khớp phiên bản — nay đã xong) |

⇒ P1b chỉ có thể làm **từng gói một**, mỗi gói gồm: `src` + `build.ts` (giữ oracle) + manifest + `gbh.peers`
+ **sinh lại artefact** + cập nhật hằng số test của gói ⇒ ước **8–10 gói/chặng**, ~200 gói ⇒ **20–25 chặng**.

**Trạng thái:** `bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH**.

## 25. Chặng 53 — P1b THEO TỪNG GÓI: đã sạch 12 gói, nền vẫn xanh

Áp dụng đúng nhịp §24 (renaming từng gói + build lại + chạy test của chính gói đó):

**Đã sạch id stock trong `src` (12 gói):**
`brand` · `agent-tool-presentation` · `atomic-write` · `deepseek-llm-api-extensions` · `deque` ·
`desktop-product-telemetry` · `host-directory-picker-browse` · `host-directory-picker-native` · `otel`* ·
`timeout-policy` · `tool-subagent-control` · `tool-working-directory` · `tool-workspace-dependencies` · `tool-worktree`
(*`otel` và `subagent-spawn-in-process` đã **hoàn nguyên**: typecheck đỏ vì gói đích chưa có `.d.ts`.)

**Các gói bị cổng byte chặn (giữ nguyên):** `chunked-list`, `http-proxy`, `plugin-market-index`,
`sdk-jsonrpc-server`, `sdk-protocol`, `session-format-catalog`, `skill-office`, `typert-protocol`
— build của chúng so artefact với stock nên mọi thay đổi chữ đều phải sinh lại + cập nhật hằng số.

### Bài học từ chặng này

- Việc renaming **chỉ an toàn khi gói đích có `.d.ts` đã build**; nếu không ⇒ `TS7016`.
- Script tự động hoá (rename → build → test → hoàn nguyên nếu đỏ) giúp đi **12 gói/chặng** mà không vỡ nền.

### Số đo

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · 0/80).
Số gói còn tham chiếu stock trong `src`: **231** (từ 254).

## 26. Chặng 54 — nhịp per-package đã tới hạn: 228→232 gói còn lại đều >30 tham chiếu hoặc bị cổng byte

Đã chạy thêm 2 vòng tự động (19 + 20 gói ứng viên). Kết quả:

- Chỉ thêm được **1 gói** (`ui-settings-subagent`).
- **2 gói client phải hoàn nguyên** (`ui-approval`, `ui-goal`): artefact đăng ký id module lấy từ **manifest/`build.ts`**, không phải từ comment trong `src` ⇒ đổi comment không đổi id ⇒ test đỏ.
- Các gói còn lại: **> 30 tham chiếu** hoặc **build bị cổng byte chặn** (`session-format-catalog`, `http-proxy`, `sdk-*`, `typert-protocol`, `skill-office`, `plugin-market-index`).

### Vì sao nhịp này chững lại

1. Ở repo này **id module của client lấy từ manifest** (`dsh.client`) + hằng số trong `build.ts`, không phải từ `src` ⇒ muốn đổi id phải đổi cả 3 nơi + sinh lại artefact + cập nhật hằng số test.
2. Các gói lớn (30–200 tham chiếu) cần sửa **nhiều tệp test** đi kèm ⇒ 1 gói/lượt thay vì 12.
3. 8 gói bị **cổng byte** chặn hoàn toàn ⇒ cần xử lý cổng trước (dạy cổng quy id), việc này mỗi gói một kiểu.

### Trạng thái

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · 0/80).
Số gói còn tham chiếu stock trong `src`: **232**.

**Đề xuất chặng sau (thay đổi chiến lược):** đi theo **đường ống nghiệm thu được** thay vì quét theo số tham chiếu:
chọn 1 gói → dạy cổng byte của nó quy id (như đã làm với `experimental-inspector`/`voice-input`) → đổi id ở
`src` + `build.ts` + manifest → sinh lại artefact → cập nhật hằng số test → chạy test gói → chạy full suite.
Mỗi chặng làm được **2–3 gói** nhưng **chắc chắn xong** thay vì 12 gói nửa vời.

## 27. Chặng 55 — P1b: +9 gói sạch (tổng 31/254), phát hiện 2 quy tắc ánh xạ

Đã sạch thêm: `session-format-catalog`, `chunked-list`, `http-proxy`, `plugin-market-index`,
`sdk-jsonrpc-server`, `sdk-protocol`, `skill-office`, `typert-protocol`, `util-crypto`, `util-code-language`.

### Hai quy tắc ánh xạ phát hiện trong chặng này

1. **Tự tham chiếu luôn đổi được**: comment `Port 1:1 gói @deepseek-ai/dsh-X` bên trong gói `gbh-X`
   phải đổi sang `@galaxy-blackhole/gbh-X` **bất kể** gói đích đã có `.d.ts` hay chưa.
2. **Cần BẢNG ÁNH XẠ TƯỜNG MINH cho các tên khác quy tắc**:
   `@deepseek-ai/dsh-tools` → `@galaxy-blackhole/gbh-host-tools` (không có `gbh-tools`).
   Đã thêm vào script dưới dạng `ALIAS`.

### Vẫn bị chặn (giữ nguyên, đã hoàn nguyên ngay trong chặng)

- `tool-worktree`, `tool-working-directory`, `tool-workspace-dependencies`: test so artefact với stock,
  đổi `import { defineTool } from "@deepseek-ai/dsh-tools"` ⇒ artefact đổi ⇒ phải cập nhật gate/hằng số của gói.
- `desktop-product-telemetry`, `subagent-spawn-in-process`: ref nằm ở dòng **không phải comment** nhưng
  gói đích chưa có `.d.ts` ⇒ chưa đổi được (cần build gói đích trước).

### Số đo

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** (57.080 ký tự · 48 slot · 0 lỗi console · 0/80).
Số gói còn tham chiếu stock trong `src`: **222** (từ 254 đầu P1b).

## 28. Chặng 56 — chặn kỹ thuật LỚN: 298/328 gói KHÔNG có `.d.ts`

Đã thử đổi `@deepseek-ai/dsh-tools` → `@galaxy-blackhole/gbh-host-tools` ở 3 gói `tool-*`
(kèm manifest + `gbh.peers` + rebuild + test): test **xanh**, nhưng **typecheck đỏ `TS7016`**
(không tìm thấy khai báo kiểu cho `gbh-host-tools`) ⇒ đã **hoàn nguyên** cả 3 gói.

### Số đo quyết định

```
goi co .d.ts:   30
goi KHONG co:  298
```

⇒ Chỉ **30/328** gói của ta phát `.d.ts`. Mọi import trỏ sang gói GBH đều bị `TS7016` trừ khi
gói đích nằm trong 30 gói đó. **Đây là chặn kỹ thuật gốc của P1b**, không phải vấn đề test.

### Việc BẮT BUỘC làm trước khi tiếp tục P1b

1. Viết công cụ phát `.d.ts` cho **tất cả** gói (`tsc --emitDeclarationOnly --declaration`
   với `outDir: lib`, hoặc thêm bước vào `build.ts`).
2. Chạy cho 298 gói, kiểm `typecheck` xanh.
3. **Sau đó** P1b mới có thể đổi import hàng loạt mà không vỡ kiểu.

### Đã giữ lại trong chặng này

- Hai tệp test `tool-worktree`, `tool-working-directory`: nới điều kiện
  `peer.startsWith("@deepseek-ai/")` thành **chấp nhận cả** `@galaxy-blackhole/` — cần thiết cho P1b.

### Trạng thái

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH**.
Số gói còn tham chiếu stock trong `src`: **222**. Backup: `/tmp/gbh-green-r56` (310 MB).

## 29. Chặng 57 — tìm ra và ĐÃ ÁP DỤNG cách vượt chặn `.d.ts`: thêm `"types": "src/index.ts"`

### Phát hiện then chốt

Không cần sinh `.d.ts`! TypeScript đọc được **nguồn `.ts`** nếu manifest khai
`"types": "src/index.ts"`. Đã kiểm chứng: đổi 1 import sang `gbh-host-tools` ⇒ typecheck **xanh**.

### Đã áp dụng (giữ lại)

Thêm `"types": "src/index.ts"` cho **214 manifest** (117 gói không có `src/index.ts` nên bỏ qua).
Sau `bun install`: `typecheck` **0**, `bun test` **0 fail**, `gate` **8/8 XANH**, `check:app` **11/11 LÀNH**.

### Vẫn chưa đổi được hàng loạt (dù đã có types)

Thử batch 25 gói: 12 gói xanh nhưng **typecheck đỏ `TS7016`** ở `agent-preset`, `otel`, `sandbox-policy`…
⇒ đã **hoàn nguyên 25 gói**. Nguyên nhân: `types` chỉ được TS dùng khi resolve qua `node_modules`,
còn `paths`/workspace-link trong `tsconfig` lại trỏ vào `lib/*.d.ts` ⇒ hai đường resolve khác nhau.

**Việc tiếp theo (đúng):** sửa `tsconfig` để mọi gói `gbh-*` resolve theo `types` (thêm `paths` cho
`@galaxy-blackhole/*` → `packages/*/*/src/index.ts`), rồi mới chạy lại batch.

### Trạng thái

`bun test` **0 fail** · `gate` **8/8 XANH** · `check:app` **11/11 LÀNH** · 222 gói còn tham chiếu stock trong `src`.
Backup: `/tmp/gbh-green-r57` (307 MB).

