<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-session-projection — bảng nguồn đối chiếu G4, lý do peer, bảng
      TRƯỚC/SAU, các ca test A/B với chính bundle gốc, và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-session-projection

Bản viết lại của Galaxy Blackhole cho row **`session-projection`** của DSH
(`@deepseek-ai/dsh-session-projection`: **436 dòng** `lib/index.js` + **292 dòng**
`lib/types/index.d.ts`, đọc từ `apps/host/node_modules/@deepseek-ai/dsh-session-projection/` — CHỈ ĐỌC).

**Vai trò**: **CHIẾU PHIÊN** — seam mà mọi miền đăng ký "đơn vị chiếu" (phép gộp thuần trên sự kiện
đã cam kết) và mọi bên mang đọc **giá trị TOÀN PHẦN** của trạng thái phiên suy ra từ log. Sổ
`ctx.sessionProjections` sở hữu: đăng ký (có đếm người đăng ký), phép LÁI EAGER, ô trạng thái theo
mốc seq cho từng phiên, kênh thay đổi, và thang đọc bốn bậc (ảnh chụp sống → ảnh chụp đã nhớ →
checkpoint → đọc lạnh trên log đã lưu).

> ⚠️ **`gbh.row` do LEAD khai NGOÀI phiên viết gói** — khoá `row` xuất hiện trong manifest **trong
> lúc** phiên này đang chạy (cùng lượt sinh `profiles/blackhole/app.patch.yml`); phiên này **không
> tự khai**. Ca 0c ghi lại **HÌNH DẠNG** phải giữ (`id` + `tests`, **KHÔNG** `config`/`moduleIds`/
> `aliases`) và đọc **cả hai dạng** `gbh.row ?? gbh.row_unmounted_ly_do?.row` để gỡ mount không
> làm đỏ oan.

## 0. Bước 0 — dữ kiện của row

| Hạng mục | Dữ kiện ĐO ĐƯỢC |
|---|---|
| Cặp row | `- id: session-projection` + `name: '@deepseek-ai/dsh-session-projection'` **có thật** trong `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng **148–149** |
| Trạng thái | **ĐANG BẬT** (không `disabled`), **KHÔNG `config`** — kể cả không có dạng `!!js …` |
| Một mặt / hai mặt | **MỘT MẶT**: `lib/client.js` **KHÔNG tồn tại**; manifest gốc **không có khoá `dsh`** |
| `row:cost` | **437 dòng** code row · **0 inject** · **0 primitive** · **0 khoá từ điển** · không trạng thái sống theo bộ dò |
| Khai báo | `gbh.row` do **LEAD** khai: `{ id: "session-projection", tests: ["tests/host/session-projection.test.ts"] }` — **KHÔNG** `config` (row gốc không có) |
| Patch đã sinh | khối `# Thay row session-projection` trong `profiles/blackhole/app.patch.yml`: `- id: session-projection` + `disabled: true` + `insert: session-projection-ours` (số dòng TRÔI theo mỗi lượt boot — đừng dẫn số dòng) |

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `cursorBefore` | `lib/index.js` dòng 22–25 | `src/registry.ts` | ca 13/14 (mốc `asOfSeq` của log rỗng = `-1`) |
| `SessionProjectionRegistry` (constructor + 2 hook) | `lib/index.js` dòng 44–67 | `src/registry.ts` | ca 8 (mount trên Context cordis THẬT) · ca 10 (lái eager) · ca 18 (chỉ phiên `seq === 0`) |
| `register` (xoá kiểu + đếm người đăng ký + hiệu ứng) | dòng 68–102 | `register` | ca 9 (2 câu lỗi NGUYÊN VĂN) · ca 16 (đếm tới lượt cuối) · ca 15 (gỡ không lan) |
| `onChanged` | dòng 103–117 | `onChanged` | ca 10/11 (số lượt phát + `Object.is`) |
| `stateOf` · `snapshot` · `cachedSnapshot` | dòng 118–180 | ba phương thức cùng tên | ca 10 (A/B từng bước, kể cả `asOfSeq`) · ca 11 (`keys`) |
| `checkpoint` (bản sao TÁCH RỜI) | dòng 181–206 | `checkpoint` | ca 12 (A/B) · ca 17 (C6 — danh tính) |
| `restoreFloor` | dòng 207–231 | `restoreFloor` | ca 12 (sàn `4`, và `undefined` khi không đơn vị nào) |
| `viewCheckpoint` | dòng 232–261 | `viewCheckpoint` | ca 12 (dòng lệch `ver` · dòng hỏng ⇒ khoá VẮNG) |
| `restore` | dòng 262–318 | `restore` | ca 13 (mồi · gộp lại · 2 đường lỗi NGUYÊN VĂN) |
| `hydrate` | dòng 319–361 | `hydrate` | ca 14 (cài ô + nhánh "ô đã đủ") |
| `materializeCells` · `buildCell` · `cellFor` · `advanceCell` · `drive` · `viewCell` | dòng 362–433 | cùng tên, `private` | đo qua hành vi ở ca 10–14/18 (không gọi thẳng) |
| `SessionSeq` · `SessionLogOffset` (từ `dsh-session`) | `dsh-session/lib/index.js` dòng 21–33 + `dsh-brand/lib/index.js` dòng 28–30 | `src/brand.ts` | ca 7: **A/B với CHÍNH kernel** — giá trị hợp lệ trả cùng số, 5 dạng sai ném CÙNG `TypeError` + CÙNG câu |
| bảng kiểu `SessionProjectionMap` · `SessionProjectionStateMap` | `lib/types/types.d.ts` | `src/types.ts` | cùng khuôn **mở rộng được** (declare-merge) |
| tập export lúc chạy | `export { SessionProjectionRegistry, SessionProjectionRegistry as default }` | `lib/index.js` | **đo trên ARTIFACT** (ca 1): **2 = 2**, 0 thiếu · 0 thừa; `default` **LÀ** chính lớp |
| `locale/{en,zh}.json` | `locale/*.json` | `locale/*.json` | chép **byte-for-byte** — sha256 hai bên khớp (luật 000e) |

## 2. Peer — vì sao chỉ `@deepseek-ai/cordis`

| Peer | Vì sao thuộc seam | Ghi chú |
|---|---|---|
| `@deepseek-ai/cordis` | lớp `Service` (**cùng lớp**, không phải bản sao) + `ctx.effect`/fiber + `ctx.on` | **Bậc 1 §3b**. Phải là peer vì `SessionProjectionRegistry extends Service` — kernel cấp **MỘT** thể hiện |

**Ba thứ bản gốc dùng mà ta KHÔNG khai peer** (đều ngoài bảng §3b, và đều có lý do ĐO ĐƯỢC):

| Bản gốc | Ta làm gì | Lý do đo được |
|---|---|---|
| `@deepseek-ai/dsh-session` (`SessionSeq` · `SessionLogOffset` + kiểu) | **viết lại tại chỗ** ở `src/brand.ts` | hai hàm là **hàm ĐỒNG NHẤT** quanh `brandNumber` — `dsh-brand/lib/index.js` dòng 28–30 là `return value` ⇒ hai bản cài cho giá trị **TRÁO ĐƯỢC**; chỉ còn phải giữ ĐÚNG phép kiểm + ĐÚNG câu lỗi, và ca 7 **A/B với chính kernel** chứng minh |
| `@deepseek-ai/dsh-session` (kiểu `Session`/`SessionEvent`/`SessionHeader`) | khai theo **CẤU TRÚC** ở `src/types.ts` | seam chỉ chạm `seq` · `header` · `inheritedEventCount` · `snapshotEvents` · `eventAt`; không có `instanceof`, không brand lúc chạy ⇒ import kiểu chỉ tạo peer vô ích (và `tsc` không resolve được từ package này) |
| `zod` (`dependencies` của bản gốc, **chỉ dùng cho KIỂU** `ZodType`) | khai `ProjectionSchema<T> { parse(value: unknown): T }` | seam CHỈ gọi `parse`; `ZodType` gán được vào hình dạng này ⇒ bỏ `zod` khỏi `dependencies` mà không đổi hành vi (không còn thể hiện zod thứ hai trong profile) |

## 3. Test — 23 ca / 178 expect / 0 fail

```bash
cd galaxy-blackhole/blackhole-tauri
~/.bun/bin/bun test tests/host/session-projection.test.ts
```

| Nhóm | Ca | Bằng chứng |
|---|---|---|
| Bước 0 | 0a–0d | cặp row trong `ours.yml` mới nhất · `lib/client.js` KHÔNG tồn tại · **hình dạng `gbh.row`** Lead đã khai (đọc CẢ HAI dạng) · không import/shim `dsh-session` |
| ARTIFACT | 1–3 | tập export **2 = 2** đo trên văn bản `lib/index.js` đã build · `process.argv[2]` · `locale` byte-for-byte |
| Peer | 4–6 | `gbh.peers ⊆ peerDependencies` so **PHẦN TỬ** + **2 ĐỐI CHỨNG ÂM** (xoá cả bảng · cùng-số-lượng-lệch-phần-tử; thừa tên vẫn ĐẠT) |
| Dấu kiểu | 7 | giá trị hợp lệ · 5 dạng sai **mỗi hàm**, so với kernel |
| Bề mặt | 8–9 | `ctx.get("sessionProjections")` trên Context THẬT · **đường nạp THẬT `ctx.plugin`** (cả hai bản cài: dịch vụ đúng tên, `instanceof` lớp, fiber ACTIVE) · cùng prototype `Service` · không `Config`/`inject` tĩnh · 2 câu lỗi nguyên văn |
| Hành vi (A/B) | 10–14 | lái eager **từng bước** (ảnh chụp/trạng thái/ảnh chụp đã nhớ/kênh) · `keys` · checkpoint/restoreFloor/viewCheckpoint · restore (mồi + gộp lại + 2 lỗi) · hydrate (2 nhánh) |
| **C6 danh tính** | 15–18 | sổ đăng ký RIÊNG giữa hai thực thể · đếm người đăng ký · checkpoint là **bản sao tách rời** (sửa không lan) · ô theo **từng phiên** + gộp lười phiên cũ |

**Vì sao A/B này không "xanh rỗng"**: mỗi ca hành vi dựng **HAI giàn giống hệt nhau** (mỗi bên một
`Context` cordis thật), chạy **cả hai bản cài** (artifact của ta vs chính `lib/index.js` gốc) trên
**cùng kịch bản 8 sự kiện**, rồi so `toEqual` từng bước — kèm **neo giá trị cụ thể** để hai bên
cùng sai vẫn đỏ.

## 4. Bảng TRƯỚC/SAU

Gói **chưa mount** (chưa khai `gbh.row`) nên chưa có phép đo trên app 5439. Bảng dưới là phép đo
**trên artifact** — phần ĐO ĐƯỢC ngay trong phiên này:

| Phép đo | TRƯỚC (bản gốc) | SAU (bản ta) |
|---|---|---|
| `grep -c "id: @deepseek-ai" lib/index.js` | — (bản gốc không có chuỗi này) | **0** |
| `__ModuleLoader__` trong artifact | — | **0** (row host-only) |
| Tập export trên artifact | `SessionProjectionRegistry` · `default` | **y hệt** (2 = 2) |
| `locale/{en,zh}.json` | sha256 `07da4758…` · `51ec0d25…` | **khớp từng byte** |
| Câu lỗi của seam | 4 câu (`stateVersion` · khoá trùng · restore · advance/restore-gap) | **nguyên văn từng câu** (ca 9/13) |
| Test | — | **23 pass · 0 fail · 178 expect** |
| Cặp patch (do Lead) | — | `- id: session-projection` + `disabled: true` **và** `insert: session-projection-ours` (khối `# Thay row session-projection` của `profiles/blackhole/app.patch.yml`) |

**CHƯA đo** (thuộc lượt boot của Lead): `lab:row session-projection` · số entry · `(5)`
`did not activate` · `check:app` trên 5439 · TRƯỚC/SAU trên app thật.

## 5. Phần CHƯA làm (nói thẳng)

1. **`gbh.row` đã do Lead khai** (hình dạng đúng: `{ id, tests }`, **KHÔNG** `config`) — phiên này
   không tự khai; nếu Lead gỡ mount thì dùng `gbh.row_unmounted_ly_do` (dạng `{ ly_do, row }`).
2. **Chưa chạy `lab:row` / mount / `check:app`** trên app 5439 (không thuộc vùng ghi của phiên này).
3. **Khác biệt KIỂU có ý**: `ProjectionDefinition` của ta dùng `key: string` + `ProjectionSchema<T>`
   thay cho `K extends keyof SessionProjectionStateMap` + `ZodType<S>`. Lý do: bảng kiểu của bản
   gốc **rỗng** (`keyof` = `never`) và `zod` chỉ là kiểu; bề mặt LÚC CHẠY không đổi. Các gói tiêu
   thụ trong repo (`session-title` · `session-turn-outline` · `user-questions`) đều khai seam theo
   **CẤU TRÚC** nên không bị ảnh hưởng.

## 6. Lệnh tái lập

```bash
cd galaxy-blackhole/blackhole-tauri
(cd packages/host/session-projection && ~/.bun/bin/bun run build.ts)
grep -c "id: @deepseek-ai" packages/host/session-projection/lib/index.js      # phải 0
~/.bun/bin/bun test tests/host/session-projection.test.ts                       # 23 pass / 0 fail
~/.bun/bin/bun run gate --no-tests                                              # 7/7 XANH
```
