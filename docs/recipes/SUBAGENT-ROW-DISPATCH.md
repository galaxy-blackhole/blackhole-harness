<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Khuon giao MOT row cho subagent — quy trinh D (teammate quan ly, subagent cong nhan)
-->

# Giao một row cho subagent — khuôn chuẩn (quy trình D)

## Vì sao có tài liệu này

Ngày 17–18/10/2026, 8 teammate **cạn ngữ cảnh** vì họ vừa **quản lý** vừa **thực thi**. Ngữ cảnh teammate
**giữ nguyên qua các vòng, không được cấp lại** ⇒ cạn là cạn hẳn cho phiên đó, và team có **trần cứng 8 người**
mà không có thao tác xoá thành viên.

**Đã kiểm chứng bằng một lần gọi thật**: `subagent` **chạy được** và **KHÔNG tính vào trần 8**
(`list_agents` vẫn báo đúng 8 teammate). ⇒ Lực lượng thực tế để port row là **subagent ngữ cảnh tươi**,
không giới hạn số lượng, mỗi row một công nhân.

## Phân vai

| vai | ai | làm gì | KHÔNG làm gì |
|---|---|---|---|
| **Công nhân** | subagent (ngữ cảnh tươi) | port MỘT package · test · `lab:row` · báo cáo | không boot app · không tự ý đổi luật |
| **Quản lý vùng** | teammate | chia việc · gom báo cáo · gửi Lead **số, không code** | không đọc code dài (cháy ngữ cảnh) |
| **Reviewer** | một subagent riêng, checklist | ký *định nghĩa xong* — **KHÔNG** là tác giả | không sửa hộ |
| **Lead** | tôi | tiền kiểm · **boot MỘT lượt cho cả lô** · đo · phân xử | không tự viết hết mọi row |

## Khuôn giao việc (dán nguyên, chỉ đổi phần ROW)

Mỗi gói giao việc **phải** có đủ 5 khối: **ROW + bản mẫu để copy khuôn + 6 luật bắt buộc + 6 bước nghiệm thu có lệnh
cụ thể + khuôn báo cáo 8 dòng**. Thiếu khối nào thì công nhân phải **đoán**, và đoán là thứ đã tốn cả ngày.

### 6 luật bắt buộc (mỗi luật là một sự cố thật)

1. **Header 5 dòng** + `create date 15/10/2026` (**cố định**) + **mỗi file ≤ 1000 dòng** + **mọi function export có mô tả**.
2. **Bundle đăng ký ĐÚNG MỘT id — id CỦA TA.** `gbh.row.moduleIds=[id ta]` · `gbh.row.aliases=[id gốc]`.
   **KHÔNG** in thêm `load({ id: <id gốc> })`: hai id ⇒ cùng bundle chạy **hai lần** ⇒ `duplicate factory registration` ⇒ app trắng.
3. **`build.ts` PHẢI nhận thư mục đích qua `process.argv[2]`**
   (`buildPackage(outDir?)` + `outDir ?? join(import.meta.dir, "lib")` + `if (import.meta.main)`).
   ⚠️ Hard-code `import.meta.dir/lib` ⇒ `mount.ts` ghi **chỉ `package.json`** vào profile ⇒ profile **thiếu `lib/`**
   ⇒ tầng nạp **không sinh entry** ⇒ gói **không bao giờ chạy** dù **mọi phép kiểm đều xanh**.
4. **Cổng `apply` = `let <ten>Installed = false` PHẠM VI MODULE + WeakSet, TRƯỚC JSDoc của hàm**,
   và **CỜ CHỈ BẬT SAU KHI `applyInner` CHẠY XONG**. ⚠️ **KHÔNG khoá theo `ctx`**: hai entry ⇒ hai `ctx`
   ⇒ cổng khoá-theo-ctx **không bao giờ kích hoạt**. Bật cờ sớm ⇒ ném giữa đường ⇒ lần cài thứ hai thoát sớm
   ⇒ slot không bao giờ được đăng ký lại ⇒ `undefined` ⇒ **React #130**.
5. **Slot LIST phải có `id` NGUYÊN VĂN từ bundle gốc** · **tên slot phải LITERAL trong `register({ name: "…" })`**
   (trừu tượng hoá bằng hằng số ⇒ `check:rows` báo **thiếu** slot) · **component là THAM SỐ THỨ HAI**:
   `register(spec, Component)` — **không** nhét `component` vào trong `spec`.
6. **Đăng ký ĐỦ các slot mà bản gốc đăng ký**, đúng tên, **+ ca test khẳng định điều đó**.

### 6 bước nghiệm thu (chạy TRƯỚC khi báo xong)

```bash
cd packages/client/<row> && bun run build.ts        # sinh lib/index.js + lib/client.js
grep -c 'id: "@deepseek-ai' lib/client.js           # PHAI = 0   (do ARTIFACT, khong grep src/)
grep -c 'id: "@galaxy-blackhole' lib/client.js      # PHAI = 1
bun test tests/client/<row>.test.ts                 # 4-6 ca, xanh
bun run check:rows | grep <row>                     # KHONG duoc co dong 'chan'
bun run gate --no-tests                             # 7/7 XANH
```

Row **chiếm slot** ⇒ thêm `bun run lab:row <row>`: **0 lỗi console** + **0 `did not activate`** — **rồi mới** khai `gbh.row`.

### Khuôn báo cáo — KHÔNG kèm code

```
package: <ten>
files: <danh sach file + so dong>
artifact: id ta=<n> id goc=<n>
lab:row: <0 loi console / 0 did not activate>  (hoac 'chua chay')
check:rows: <so dong chan>
test: <pass>/<expect>
gate --no-tests: <XANH/DO>
chua xong: <neu co — noi thang>
```

**Vì sao không kèm code**: mỗi báo cáo dài là ngữ cảnh cháy của người tổng hợp. Người quản lý chỉ cần **số**.

## Luật của Lead khi gom lô

1. **Tiền kiểm phải là `0 CHẶN` CHO *ROW ĐANG THÊM* — KHÔNG phải `0 CHẶN` toàn repo.**
   ⚠️ **Đo ngày 18/10/2026**: khi công nhân còn viết dở, `check:rows` toàn repo **luôn** báo chặn giả tạo
   (gói khai `gbh.row` nhưng chưa có `src/index.ts` / chưa đủ slot). Đo được **3 CHẶN** trước một lượt boot
   mà **app vẫn mount đúng 3 row mới**. Lý do: `apps/cli/src/mount.ts` **BỎ QUA** gói chưa đạt
   (`BO QUA (kiem tra truoc mount): thieu src/index.ts`) — **tiền kiểm bảo vệ app**, nó không chặn cả lô.
   ⇒ Đòi `0 CHẶN` toàn repo là **tự khoá mình** khi đang chạy pipeline.
2. **Gom theo RỦI RO**, không theo số lượng: các row chạm **cùng một slot / cùng một service** nên vào **cùng lô**
   (lỗi cái này che cái kia), và **bắt buộc tiền kiểm `check:rows` = 0 CHẶN** trước khi boot.
3. **MỘT lượt boot cho cả lô** — chỉ Lead boot. Ghi **mốc giờ** + **mtime artifact** khi báo số.
4. Row hỏng ⇒ **gỡ mount MỘT DÒNG**: `gbh.row` → `gbh.row_unmounted_ly_do` dạng **`{ ly_do, row }`**
   (**đọc `ly_do` trước khi đổi** — nó chứa chẩn đoán của người gỡ mount trước).
5. `(8) #root` + **0 lỗi console** là **cổng sống/chết**; `(9)` lệch bố cục thì **đọc SỐ**, không đọc verdict
   (ngưỡng *'gỡ mount'* của công cụ viết cho ca **trang trắng**, không cho ca lệch 21px).

6. **Cột `lib/` trong repo KHÔNG phải điều kiện mount** — `mount.ts` **tự build** (`buildIfStale`) vào profile.
   ⚠️ **Đo ngày 18/10/2026**: bảng ‘sẵn sàng’ với cột `artifact = có lib/client.js trong repo` **đánh lừa**
   người lập: hai row **không có `lib/` trong repo** mà **vẫn mount thành công**. Thứ đúng để kiểm là
   **`build.ts` có nhận `process.argv[2]` hay không**.
7. **`gate` KHÔNG có giá trị khi còn writer đang chạy** — nó thấy công việc dở dang và báo đỏ vì lý do
   giả tạo (đo được **3/8 đỏ** giữa lúc 8 subagent viết file). Dùng `gate` để **chẩn đoán**, chỉ **kết luận**
   sau khi mọi writer dừng.
8. **Subagent là MỘT-LẦN**: `send_message` tới nó trả `active teammate … not found`. Sắp hết ngân sách thì
   phải **hoàn tất tới ranh giới file, DỪNG và GỬI BÁO CÁO** — im lặng là mất thông tin, và người hoàn tất
   phải được mô tả rõ **đã có gì / thiếu gì**.

### 3b. TỐI ĐA 2 ROW MỚI MỖI LƯỢT BOOT (luật 18/10/2026 — trả giá bằng sự cố lớn nhất)

⚠️ **Đo được**: một lượt boot đưa **8 row mới** vào cùng lúc ⇒ `#root` **68.760 → 2.673** (mất 96%),
**5 lỗi console**, `(9)` **80/80 (100%)**. Khi vỡ, phải mất **2 lượt boot chỉ để CÔ LẬP** thủ phạm:
gỡ `ui-sidebar-right` ⇒ 2.673 → 43.883 (**nó làm SẬP**, có lỗi console);
gỡ tiếp `ui-workspace` ⇒ 43.883 → 68.760 (**nó ăn nội dung ÂM THẦM**).

- **Tối đa 2 row mới mỗi lượt boot.**
- **Row RỦI RO phải boot RIÊNG** (nhiều slot, hoặc **đã từng làm vỡ app**).
- **Hai lớp lỗi cần HAI phép đo khác nhau**: *lỗi console + `#root` sập* ⇒ `(8)` bắt ngay;
  *mất nội dung âm thầm* ⇒ **CHỈ KÍCH THƯỚC `#root`** bắt được. Có cả hai cùng lúc thì phải
  **gỡ từng row một rồi đo lại** mới tách được.
- **"Đã sửa đúng lớp lỗi" KHÔNG bằng "đã đạt số".** Ca thật: người hoàn tất `ui-workspace` tìm ra
  **đúng** nguyên nhân gốc (`ext.primitives.MenuItem` **không tồn tại** trong module primitive của vỏ
  ⇒ React ném ngay ⇒ khung slot render **RỖNG không console**), sửa nó, test tăng **9 → 18 ca / 482 expect**
  — **mà `#root` vẫn 43.883**. ⇒ *Bằng chứng mạnh nhất không phải "tôi hiểu nguyên nhân" mà là
  "con số đã về đúng".*

**LUẬT MỚI VỀ PRIMITIVE (từ chính ca đó)**: một tên primitive **không có** trong module của vỏ thì
React **ném ngay khi render** ⇒ khung slot bắt lỗi và render **RỖNG, KHÔNG một dòng console**.
⇒ Phép kiểm **"tập primitive ta dùng ⊆ tập primitive bản gốc dùng"** là **cổng THẬT** — đã đưa vào test của gói.
