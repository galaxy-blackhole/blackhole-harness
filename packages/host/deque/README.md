<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-deque — ban viet lai cua @deepseek-ai/dsh-deque (goi THU VIEN zero-dep: deque vong)
-->

# @galaxy-blackhole/gbh-deque

Bản viết lại 1:1 của `@deepseek-ai/dsh-deque` (**86 dòng, zero-dependency, 1 export `Deque`**).

## 0. Vì sao KHÔNG khai `gbh.row`

Gói thư viện (class thuần): bản gốc không có `apply`, không có entry trong cây plugin ⇒ **consumer inline**.

## 1. Ngữ nghĩa giữ nguyên (đọc từ bản gốc)

| chi tiết | Giá trị |
|---|---|
| dung lượng tối thiểu | **16** |
| tăng dung lượng | gấp đôi khi đầy (`count === buffer.length`) |
| co dung lượng | khi `buffer.length > 16` và `count <= length/4` ⇒ về `max(16, length/2)` |
| xoá phần tử | **gán `undefined` ngay** để không giữ tham chiếu |
| `popFront` khi rỗng | trả `undefined` (dùng `size` để phân biệt với phần tử `undefined`) |
| `clear` | cấp mảng mới 16 phần tử, `head = 0`, `count = 0` |

## 2. Test

`tests/host/deque.test.ts`: A/B với bundle gốc trên **5.000 thao tác ngẫu nhiên có hạt giống** (pushBack/pushFront/popFront/clear/size),
so từng kết quả với **cả bản gốc lẫn mô hình mảng tham chiếu**; cộng các ca biên (rỗng, đúng 16, 17, co bộ nhớ sau khi xoá).
