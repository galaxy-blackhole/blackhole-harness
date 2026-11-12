<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 10/11/2026
 desc Hướng dẫn di trú dữ liệu người dùng từ home CŨ (~/.galaxy/gbh — galaxy-code chạy DSH)
      sang home của bản Galaxy Blackhole này (~/.galaxy/blackhole).
-->

# Di trú dữ liệu từ home cũ sang Galaxy Blackhole

## 1. Hai home khác nhau

| Hệ | Home | Ghi chú |
|---|---|---|
| galaxy-code (`blackhole web`, `blackhole-desktop-electron`) — DSH sửa nhẹ | `~/.galaxy/gbh` | **home CŨ**, chỉ đọc khi di trú |
| Galaxy Blackhole (bản này: `bh host`, app Tauri) | `~/.galaxy/blackhole` | **home MỚI**, có thể đặt bằng `GBH_HOME` |

Cả hai dùng **cùng bố cục** cho dữ liệu người dùng: `sessions/<khoá-workspace>/<id-phiên>/session.v4.jsonl.zstd`, `storages/…`, `attachments/…` ⇒ chuyển sang bản mới **không cần đổi định dạng**, chỉ cần chép phần còn thiếu.

## 2. Lệnh di trú

    bh migrate --dry-run     # in kế hoạch, KHÔNG ghi gì
    bh migrate               # chép thật

| Cờ | Ý nghĩa |
|---|---|
| `--from <dir>` | home cũ (mặc định `~/.galaxy/gbh`) |
| `--to <dir>` | home mới (mặc định `$GBH_HOME` hoặc `~/.galaxy/blackhole`) |
| `--dry-run` | chỉ in kế hoạch |

## 3. Quy tắc an toàn (đã có test canh)

* **Chỉ ĐỌC** home cũ — `gate:home-isolation` canh việc không ghi vào `~/.galaxy/gbh`.
* **Chỉ THÊM** vào home mới: tệp đã tồn tại thì **bỏ qua**, không ghi đè, không xoá.
* Bỏ qua `session.lock` (khoá phiên đang chạy) và `.DS_Store`.
* Chạy lại nhiều lần **không** tạo bản trùng: cùng đường dẫn tương đối ⇒ lần hai chỉ bỏ qua.
* Không cần tắt app: chép xong **khởi động lại host** để danh sách phiên nạp lại.

## 4. Kiểm chứng

    bh migrate --dry-run          # liệt kê số tệp sẽ chép cho sessions / storages / attachments
    find ~/.galaxy/blackhole/sessions -name 'session.v4.jsonl.zstd' | wc -l   # tăng đúng bằng số đã chép

Mở app ⇒ sidebar hiện các phiên cũ (nhóm theo workspace như trước).

## 5. Nếu muốn quay lui

Lệnh không sửa home cũ và **không xoá** gì ở home mới. Muốn bỏ phần đã chép: xoá đúng thư mục phiên vừa thêm trong `~/.galaxy/blackhole/sessions/…` (so với home cũ để biết chắc), hoặc phục hồi từ bản sao lưu bạn tự tạo trước khi chạy.
