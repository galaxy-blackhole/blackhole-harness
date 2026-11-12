<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Checklist cho vai REVIEWER — ky 'dinh nghia xong' cua mot row, KHONG phai tac gia
-->

# Checklist review một row — người ký **không được là tác giả**

> Vì sao có tài liệu này: **mọi sự cố trong ngày 17–18/10/2026 đều do NGƯỜI KHÁC đọc artifact mới bắt được**,
> không phải tác giả. Reviewer là **hàng rào rẻ nhất** và cũng là thứ dễ bị bỏ qua nhất.

## Luật của người review

1. **Đo trên ARTIFACT, không đọc `src/` để kết luận.** Chú thích trong `src/` từng làm cổng báo oan.
2. **Không sửa hộ.** Ghi lỗi + bằng chứng, trả về tác giả.
3. **Không ký khi còn dòng `chan`.** Cảnh báo thì ghi lại, không chặn.
4. **Kiểm vùng ghi trước khi mở file để sửa** — hai người ghi một gói là phá artifact của nhau.

## A. Khuôn bundle (đo trên `lib/client.js`)

```bash
cd packages/client/<row> && bun run build.ts
grep -c 'id: "@deepseek-ai'     lib/client.js   # PHAI = 0
grep -c 'id: "@galaxy-blackhole' lib/client.js  # PHAI = 1
grep -c 'process.argv' build.ts                  # PHAI >= 1
```

- [ ] **MỘT** id, và là **id của ta**. Id gốc **chỉ** ở `gbh.row.aliases`.
- [ ] `build.ts` nhận `outDir` qua `process.argv[2]` — nếu không, profile **thiếu `lib/`** ⇒ **không sinh entry**
      dù mọi phép kiểm khác xanh (lỗi thật, mất 3 vòng ngày 18/10).
- [ ] Không có cú pháp ESM trong bundle client (nó nạp bằng `<script>`).

## B. Tập SLOT — phép kiểm bắt lớp lỗi nguy hiểm nhất

Trích từ **artifact của ta** và từ **bundle gốc**, rồi so (regex: `register\(\{\s*name:\s*"…"` và `slots\.inject\("…"`).

- [ ] **Tập slot của ta = tập slot của bundle gốc** — không thiếu, không thừa.
      ⚠️ **Thiếu slot ⇒ giao diện mất chức năng mà KHÔNG có lỗi console nào.**
- [ ] Slot kiểu LIST có **`id` nguyên văn** từ bundle gốc.
- [ ] Tên slot là **LITERAL** trong `register({ name: "…" })` (hằng số ⇒ `check:rows` báo thiếu).
- [ ] **Component là THAM SỐ THỨ HAI**: `register(spec, Component)` — không nhét vào `spec`.

## C. Cổng chống cài hai lần

- [ ] Cờ là **`let` PHẠM VI MODULE**, đặt **TRƯỚC JSDoc** của hàm.
- [ ] **CỜ CHỈ BẬT SAU KHI phần đăng ký CHẠY XONG** (bật sớm ⇒ ném giữa đường ⇒ lần cài thứ hai thoát sớm
      ⇒ slot không bao giờ đăng ký lại ⇒ `undefined` ⇒ **React #130**).
- [ ] **KHÔNG khoá theo `ctx`** (hai entry ⇒ hai `ctx` ⇒ cổng không bao giờ kích hoạt).
- [ ] Có ca test chứng minh: **lần cài đầu NÉM ⇒ cờ vẫn `false` ⇒ lần hai đăng ký lại đủ slot**.

## C2. Hai luật HỢP ĐỒNG (mỗi luật là một lỗi thật đã làm hỏng app)

- [ ] **KEYED — khoá tra chỗ ngồi phải BẰNG id định nghĩa.** Nếu row có slot/list kiểu keyed
      (tra chỗ ngồi theo `key`), thì **`key` của slot PHẢI BẰNG `id` của định nghĩa loại tab**
      — bản gốc dùng **MỘT giá trị cho cả hai**.
      ⚠️ Lệch ⇒ renderer rơi vào **fallback** ⇒ tab hiện **`không khả dụng`**
      **MÀ KHÔNG CÓ LỖI CONSOLE NÀO** ⇒ mọi cổng khác đều xanh.
      *Ca thật*: `ui-plan` — `SLOT_ENTRY_ID` (id gốc) cho `key` nhưng `TAB_TYPE_ID` (id ta) cho `id`;
      **test của row còn tự khẳng định hai vế LỆCH nhau** ⇒ test xanh mà chức năng gãy.
      **Cách kiểm**: đọc artifact, in ra `id:` của `sidebarRightTabs.register` và `key:` của từng
      `slots.register` cùng nhóm — **hai chuỗi phải giống nhau**.

- [ ] **STORE cấp cho slot của GÓI KHÁC phải trả thể hiện ĐẦY ĐỦ.** Nếu `create()` của row được
      gói khác dùng làm nguồn ảnh chụp, nó **PHẢI** trả `getSnapshot`/`subscribe`/`actions` như
      `defineStore` của bản gốc — **trả thiếu là `TypeError: w.getSnapshot is not a function`
      ⇒ CẢ thanh bên KHÔNG render**.
      *Ca thật*: `ui-workspace` — `createWorkspaceViewStore()` trả `{ actions }` ⇒ `#root` 68.760 → 37.727,
      **làm vỡ app HAI lần**. **Test của gói KHÔNG bắt được** (9 pass / 298 expect) vì lỗi nằm ở
      **hợp đồng GIỮA hai gói** ⇒ **bắt buộc có CA TEST HỢP ĐỒNG** cho đúng việc này.

## C3. Lớp lỗi MẤT NỘI DUNG ÂM THẦM (chỉ đo được bằng KÍCH THƯỚC)

- [ ] Row mount được, **0 lỗi console**, **0 `did not activate`**, `(5)` 0 — **mà `(8) #root` NHỎ ĐI**
      ⇒ **row của ta render ÍT HƠN bản stock** ⇒ app **mất chức năng âm thầm**.
      *Ca thật*: `ui-workspace` — `#root` 68.760 → 43.883 với **0 lỗi console**; nguyên nhân là
      ba phần **chính công nhân đã tự khai là CHƯA XONG**.
      ⇒ **ĐIỀU KIỆN MOUNT**: `#root` trên app thật **KHÔNG ĐƯỢC NHỎ HƠN bản lành** (hiện tại **68.760**).
      ⇒ Và **danh sách *chưa xong* là ĐIỀU KIỆN CHẶN MOUNT**, không phải ghi chú cuối báo cáo.

## C4. Hai phép chứng minh PARITY mạnh nhất (đã đo được, nên thành BẮT BUỘC)

### C4.1 — ĐỔI BUNDLE GỐC VÀO CÙNG HOME (mạnh nhất: cô lập ĐÚNG MỘT biến)

Dựng lab cách ly, đo ba số (`#root` · số lỗi console · số dòng `did not activate`).
Rồi **thay `lib/client.js` của ta bằng bundle GỐC** trong CÙNG home đó và **đo lại ba số**.

- [ ] **Ba số phải BẰNG NHAU.**
      *Ca thật*: `ui-settings-account` — thay bundle gốc ⇒ `#root` **58.588 y hệt**, 0 lỗi console.
      ⇒ Vì **chỉ đổi ruột, giữ nguyên mọi thứ khác**, nên **mọi khác biệt về sau đều quy được về bundle**.

### C4.2 — ĐO ĐƯỜNG NỀN (lab cách ly: mọi row khác về BẢN GỐC, chỉ thay row cần đo)

- [ ] Đo **đường nền** (không thay row nào) rồi đo **có thay row** — **ba số phải bằng nhau**.
      *Ca thật*: `ui-schedule` — 57.524 / 0 lỗi / 1 `did-not-activate`, **hai lần đo bằng nhau từng số**.

### C4.3 — VÌ SAO HAI PHÉP NÀY QUAN TRỌNG HƠN TEST

Chúng đo trên **trang thật**, không phải trong `window` giả. Và chúng bắt được **lớp lỗi mà test của gói KHÔNG bắt được**:
`ui-workspace` có **test 9 pass / 298 expect**, slot **6=6**, `id ta=1 · id gốc=0** — **vẫn làm app mất nội dung âm thầm**
(`#root` 68.760 → 43.883, **0 lỗi console**) vì lỗi nằm ở **hợp đồng GIỮA hai gói**.

### C4.4 — BA LỚP LỖI VÀ PHÉP ĐO BẮT ĐƯỢC CHÚNG

| lớp lỗi | lỗi console `(8)` | `#root` `(8)` | `check:rows` | `(9)` |
|---|---|---|---|---|
| sập (apply ném) | **bắt** | **bắt** | — | **bắt** |
| mất nội dung âm thầm | không | **bắt** | — | có thể |
| **thiếu slot** | **KHÔNG** | **KHÔNG** | **bắt** | **KHÔNG** |

⇒ **Ba lớp, ba phép đo khác nhau. Không phép nào thay được phép nào.**

## C5. LỚP LỖI THỨ TƯ: MODAL BỎ MỞ (phát hiện 18/10/2026)

**Đo được**: `parity:report` báo 4 FAIL ảnh A/B (`1440x900 vs oracleA` = **67,739%** px khác,
ngưỡng 0,1%) — mà **app vẫn LÀNH theo MỌI chỉ số**: `(8)` `#root` **68.760** · **0 lỗi console** ·
`(5)` **0** dòng `did not activate` · `gate` **8/8** · `check:rows` **0 chặn**.

**Nguyên nhân** (đo bằng DOM thật, không suy từ ảnh): `DIV.VOzbGW_overlay` (`position:fixed`,
**`z-index:1000`**) + `DIV.VOzbGW_mask` (**`rgba(0,0,0,0.24)`**) — **một modal đang MỞ** — trong khi
`document.body.innerText` chứng minh app **vẫn render đúng ở dưới**.
Lớp `VOzbGW` truy ra **`packages/client/ui-settings-general/src/overlay.ts`**: lớp CSS **trung thành**,
nhưng **gói của ta MỞ modal lúc tải trang, bản gốc thì KHÔNG**.

⇒ **Luật**: *một modal bỏ mở là lớp lỗi thứ tư, và **KHÔNG chỉ số sức khoẻ nào bắt được nó**.*

### Bảng bốn lớp lỗi và phép đo bắt được chúng

| lớp lỗi | lỗi console | `#root` | `check:rows` | `(9)` | `overlay-probe` |
|---|---|---|---|---|---|
| sập (`apply` ném) | **bắt** | **bắt** | — | **bắt** | — |
| mất nội dung âm thầm | không | **bắt** | — | có thể | — |
| **thiếu slot** | **KHÔNG** | **KHÔNG** | **bắt** | **KHÔNG** | — |
| **modal bỏ mở** | **KHÔNG** | **KHÔNG** | **KHÔNG** | **KHÔNG** | **bắt** |

### Cách kiểm (công cụ đã có trong repo)

```bash
bun run tools/check/overlay-probe.ts            # liệt kê phần tử PHỦ MÀN HÌNH đang mở
bun run tools/check/overlay-probe.ts <url-lab>  # hoặc đo trên lab cách ly
```

⚠️ Phải truyền `channel: "chrome"` cho playwright — nếu không sẽ báo
`Executable doesn't exist … chromium_headless_shell` (đã mất một lượt vì lỗi này).

### Cách nghiệm thu đúng nhất cho lớp lỗi này

**Đo ĐÚNG triệu chứng, không đo thứ tương quan với nó**: trong lab cách ly, kiểm DOM có
`VOzbGW_overlay`/`VOzbGW_mask` đang mở hay không **ở CẢ HAI lần** (bundle ta vs bundle gốc).
Kỳ vọng: **ta = CÓ, gốc = KHÔNG**; sau khi sửa ⇒ **cả hai = KHÔNG**.

## D. Bằng chứng phải có trong báo cáo

- [ ] artifact: `grep -c` hai chiều ⇒ `0` / `1`.
- [ ] test: `bun test tests/client/<row>.test.ts` ⇒ **0 fail**.
- [ ] `bun run check:rows | grep <row>` ⇒ **0 dòng `chan`**.
- [ ] `bun run lab:row <row>` ⇒ **0 lỗi console · 0 `did not activate`**.
- [ ] `bun run gate --no-tests` ⇒ **7/7 XANH**.
- [ ] **`gbh.row` được khai CUỐI CÙNG** (khai sớm ⇒ vi phạm `hygiene` vì gói khai `gbh.row` **phải có test**).
- [ ] Có dòng trong `packages/README.md` §4 (điều kiện cổng `hygiene`).

## E. Ba cái bẫy của CHÍNH phép đo (đã trả giá)

1. **`gate` giữa lúc công nhân đang viết ⇒ đỏ GIẢ.** Dùng để **chẩn đoán**, chỉ **kết luận** sau khi writer dừng.
2. **`lab:row` từng báo oan `did not activate`** khi patch của repo **đã** thay row mà lab chèn thêm overlay.
   Đã sửa 18/10 — nếu còn thấy, kiểm dòng `[lab] patch cua repo DA thay row`.
3. **Cột `lib/` trong repo KHÔNG phải điều kiện mount** — `mount.ts` tự build vào profile. Thứ đúng là `argv[2]`.

## F. Ký

```
row: <ten>
reviewer: <ten nguoi ky — KHAC tac gia>
A khuon bundle : <dat/khong>  bang chung: <so do>
B tap slot     : <dat/khong>  bang chung: stock=N ta=N thieu=N thua=N
C cong idem    : <dat/khong>  bang chung: <ten ca test>
D bang chung   : <dat/khong>  thieu: <...>
ket luan       : <KY / TRA LAI>  ly do: <...>
```

## C6. VẬT THỂ CẤU HÌNH PHẢI **ĐỘC LẬP** GIỮA CÁC THỰC THỂ — kiểm bằng **DANH TÍNH**, không bằng so sâu

**Lớp lỗi này VÔ HÌNH với mọi cổng và với `toEqual`/`deepEqual`.**

Ngày 18/10/2026, công nhân row `subagent-spawn-in-process` tự phát hiện: bản đầu **chia sẻ một hằng**
`capabilities` giữa các thực thể ⇒ **phép so sâu vẫn ĐẠT** (giá trị bằng nhau) nhưng **hành vi khác bản gốc**:
sửa vật này **lan sang** vật kia.

⇒ **Phép so sâu trả lời**: *"hai vật có **trông giống nhau** không"*.
⇒ **Nó KHÔNG trả lời**: *"hai vật có **độc lập** không"*.

```js
// PHAI có ca này cho MỌI vật thể cấu hình/năng lực được tạo nhiều lần:
const a = make(), b = make();
expect(a.capabilities).not.toBe(b.capabilities);   // DANH TÍNH, không phải giá trị
a.capabilities.x = 1;
expect(b.capabilities.x).toBe(undefined);          // sửa một KHÔNG lan sang cái kia
```

⇒ Nếu thiếu ca này, **bản sao chia sẻ tham chiếu** sẽ qua mọi cổng: `gate` xanh, `check:rows` xanh,
`(5)` 0, `(8)` 0 lỗi — và **lỗi chỉ lộ khi hai thực thể cùng sống và một bên bị sửa**.
