<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-util-crypto — ban viet lai cua @deepseek-ai/dsh-util-crypto (goi THU VIEN zero-dep: UUID v4 + base64)
-->

# @galaxy-blackhole/gbh-util-crypto

Bản viết lại 1:1 của `@deepseek-ai/dsh-util-crypto` (**35 dòng, zero-dependency, 2 export**).

## 0. Vì sao gói này KHÔNG khai `gbh.row`

Đây là **thư viện thuần hàm**, không phải row plugin: bản gốc không có `apply`, và `grep 'dsh-util-crypto'`
trong `.parity/dumps/2026-10-18T01-31-57/ours.yml` = **0** ⇒ không có row nào để thay. Consumer
(`dsh-*` dùng `randomUUID`/`bytesToBase64`) sẽ chuyển sang gói này khi tới lượt (inline như các gói thư viện khác).

## 1. Vì sao port đúng hai chi tiết này (đọc từ bản gốc)

| chi tiết | Lý do bản gốc nêu |
|---|---|
| `randomUUID()` dùng `crypto.getRandomValues` chứ **không** `crypto.randomUUID` | `randomUUID` là Web API chỉ có trong **secure context**; trang/worker phục vụ HTTP thường trên LAN không có ⇒ dùng `getRandomValues` mới chạy mọi nơi |
| `bytesToBase64` ghép theo **lô 32 KiB** | `String.fromCharCode(...data)` ném `RangeError` khi mảng quá lớn (giới hạn ngăn xếp) ⇒ phải chia lô y hệt bản gốc |

## 2. Test (A/B với bundle gốc)

`tests/host/util-crypto.test.ts` chạy **cùng đầu vào trên cả hai bản**:

- base64: rỗng · 1 byte · 32.767 byte (dưới lô) · 32.768 byte (đúng biên lô) · 100.000 byte (nhiều lô) ·
  mọi byte 0–255 · so **chuỗi bằng nhau** và bằng `btoa` tham chiếu;
- UUID: đúng khuôn `8-4-4-4-12`, hex thường, **version 4** và **variant 8/9/a/b**, 2.000 lần sinh **không trùng**,
  và cả hai bản đều **không** gọi `crypto.randomUUID` (thay bằng bẫy để chứng minh).

## 3. Bàn giao

| mục | giá trị |
|---|---|
| nguồn | `src/index.ts` (port 1:1, JSDoc đầy đủ) |
| build | `bun run build.ts [outDir]` → `lib/index.js` (ESM, target node) |
| export | `bytesToBase64` · `randomUUID` (**2 = 2** với gốc) |
| mount | **không** (thư viện, consumer inline) |
