<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-util-code-language — ban viet lai cua @deepseek-ai/dsh-util-code-language (goi THU VIEN: bang duoi tep -> ma ngon ngu)
-->

# @galaxy-blackhole/gbh-util-code-language

Bản viết lại 1:1 của `@deepseek-ai/dsh-util-code-language` (**269 dòng, zero-dependency, 3 export**).

## 0. Vì sao KHÔNG khai `gbh.row`

Gói là **bảng dữ liệu + 3 hàm thuần**, bản gốc không có `apply`, không có entry trong cây plugin ⇒ consumer **inline**.

## 1. Vì sao port VERBATIM (không viết lại bảng)

95% nội dung là **bảng ánh xạ** (đuôi tệp → mã ngôn ngữ, tên ngắn, ghi đè cho thẻ đọc). Viết lại bảng bằng tay
chỉ tạo nguy cơ sai một dòng mà không thêm giá trị; nên bảng được **chép nguyên văn** từ bundle gốc, chỉ thêm
header 5 dòng và kiểu cho `Map<string, string>`.

Chi tiết thiết kế giữ nguyên: dùng **`Map` chứ không object** để đuôi trùng khoá `Object.prototype`
(`foo.constructor`, `foo.__proto__`) **KHÔNG** phân giải nhầm thành thành viên kế thừa — nếu không, caller sẽ nhận
một giá trị ngôn ngữ **không phải string**.

## 2. Test

`tests/host/util-code-language.test.ts`: A/B với bundle gốc — so **toàn bộ** bảng `CODE_HIGHLIGHT_EXTENSIONS`,
so `languageForPath`/`readLangHintForPath` trên ~40 đường dẫn (cả hai dấu phân cách, chữ HOA/thường, `.env`,
dotfile không có trong bảng, không có đuôi, đuôi trùng khoá prototype) ⇒ **cùng kết quả từng ca**.
