<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ba luật của cổng check:rows ở lúc mount, và vì sao luật (b) đang tạm hạ xuống cảnh báo
-->

# Recipe — cổng `check:rows` kiểm gì ở lúc mount

Cổng chạy trên **bản ĐANG PHỤC VỤ** (artifact trong profile), không đọc bản trên đĩa — vì "thứ đang chạy
không phải mã mình tin là đang chạy".

| Luật | Mức | Nội dung |
|---|---|---|
| (a) một id | **CẢNH BÁO (tạm hạ 17/10/2026)** | bundle phải đăng ký **đúng 1 id** (id của ta). Đăng ký thêm id gốc ⇒ bundle chạy hai lần ⇒ `duplicate factory registration` ⇒ app trắng |
| (a2) id gốc đăng ký khi row gốc CÒN BẬT | **CẢNH BÁO (tạm hạ 17/10/2026)** | cùng lớp với (a): trùng đăng ký thật ⇒ app trắng |
| (b) id gốc chỉ ở `aliases` | **CẢNH BÁO (tạm hạ 17/10/2026)** | id gốc không được nằm trong `gbh.row.moduleIds` |
| (c) bề mặt service | **CHẶN** | thuộc tính bundle ta đọc trên một service mà gói gốc **không hề có** (lớp lỗi `configForms.developerTools`) |

## Vì sao (a), (a2), (b) đang tạm hạ (17/10/2026)

**Cửa sổ rollback**: tm-parity-b rollback **27 gói** để khôi phục app ⇒ bundle quay lại đăng ký 2 id và row gốc
được bật lại ⇒ ba luật trên bắt **hàng chục gói ĐANG CHẠY**. Vì lượt mount **bỏ qua** row bị cổng chặn, giữ
chúng ở mức CHẶN nghĩa là app tiếp tục chạy bản gần-stock ⇒ **app suy giảm thật**.

**Nguyên tắc**: cổng tồn tại vì một sự cố thật, nhưng **trong cửa sổ rollback thì cổng phải nhường** —
không được để nó loại row khỏi lượt mount. Luật vẫn **nằm nguyên trong code**, chỉ đổi **mức**.

**BẬT LẠI CHẶN** khi: (1) 27 gói đã rollback xong, **VÀ** (2) tầng nạp sinh được **entry stock với metadata
`aliases`-only** (tm-client xác nhận). Lúc đó đổi `level: "canh bao"` → `"chan"` ở ba khối trong
`tools/check/rows.ts` và cập nhật bảng trên.

## Vì sao riêng luật (b) đang tạm hạ

Luật (b) **đúng về đích**, nhưng **tầng nạp chưa hỗ trợ `aliases`-only**: nó đọc `aliases` từ manifest trong
profile và **không sinh entry stock**. Siết trước khi hạ tầng đuổi kịp thì cổng chặn **chính các gói đang
chạy tốt** ⇒ app suy giảm. Số đo khi siết sớm:

| Chỉ số | Trước | Khi siết sớm |
|---|---|---|
| entry | 98 | **72** |
| inject treo | 4 | **102** |
| gói của ta đang chạy | 26 | **17** |

**Điều kiện BẬT LẠI thành CHẶN**: khi manifest có **entry stock với metadata `aliases`-only** (tức tầng nạp
sinh được entry alias trỏ về cùng URL bundle). Lúc đó đổi `level: "canh bao"` → `"chan"` trong
`tools/check/rows.ts` (khối luật (b)) và cập nhật bảng này.

Luật (a) và (c) **không** bị ảnh hưởng — chúng độc lập và vẫn CHẶN.

## Luật về PHƯƠNG PHÁP đếm (đo được 17/10/2026)

1. **Tin ARTIFACT, không tin source.** Cổng đọc bản đang phục vụ trong profile và **phân giải lời gọi đăng ký
   bằng bộ phân giải bốn khuôn**, không grep chuỗi. Một lần tôi đếm bằng grep source và ra **12 gói**, trong khi
   đếm trên artifact ra **4** — chênh lệch là **dòng chú thích** nhắc `load({ id, factory })`.
2. **Nếu buộc phải grep source thì grep CẢ HAI dạng**: chuỗi literal (`"@deepseek-ai/dsh-client-…"`) **và**
   tên hằng (`STOCK_PACKAGE_NAME`, `STOCK_ID`, `STOCK_MODULE_ID`, `DECLARED_IDS`). tm-host-api mất một
   lượt quét vì mã của họ viết bằng hằng số nên grep literal **không thấy**.
3. **Artifact cũ đánh lừa**: sửa `build.ts` rồi **không build lại** thì artifact vẫn đăng ký 2 id. Luôn
   build rồi mới kết luận.
4. **Ca `DECLARED_IDS` (đo được 17/10/2026, gói `ui-secret-mask`)**: id thứ hai có thể **không** đến từ một
   dòng `load({ id: STOCK_PACKAGE_NAME })` literal, mà từ **mảng `DECLARED_IDS`** trong `build.ts` — build
   phát một `load` cho MỖI phần tử. Grep literal **không bắt được** ca này; **đếm trên artifact** thì bắt.
   Đây là ca thứ hai trong ngày xác nhận luật (1).
