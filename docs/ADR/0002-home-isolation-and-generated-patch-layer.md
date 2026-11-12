> ⚠️ **Ghi chú 18/10/2026 (Lead):** các đường dẫn trong ADR này là **bản ghi LỊCH SỬ** tại thời điểm quyết định
> — nhiều đường dẫn trỏ tới layout **trước khi đổi tên** (`galaxy-code/…`) nên **KHÔNG còn tồn tại**.
> Đây **không phải dẫn chiếu chết cần sửa**: ADR là **ảnh chụp quyết định**, không phải tài liệu hướng dẫn hiện hành.
> Tài liệu hiện hành: `docs/ARCHITECTURE.md` · `docs/recipes/*` · `docs/M6-REMAINING.md`.

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc ADR 0002: gate cach ly home do bang nhan qua, va lop patch sinh tu dong moi lan boot
-->

# ADR 0002 — Cách ly home đo bằng nhân quả, và lớp patch cuối do app tự sinh

- **Ngày**: 17/10/2026 · **Trạng thái**: đã chốt

## 1. `gate:home-isolation` không thể là "hash cây `~/.galaxy/gbh` không đổi"

Đo thực tế trên máy này: cây `~/.galaxy/gbh` **đang bị ít nhất 2 harness khác ghi liên tục**
(sessions/storages/attachments đổi mỗi vài giây — chính phiên GUI đang chạy nằm trong đó). Bất kỳ gate nào
so hash trước/sau đều **đỏ vô cớ**, và tệ hơn: nó không chứng minh được điều ta cần.

**Chốt**: gate đo bằng **nhân quả**, mạnh hơn cách đếm byte:

1. Cửa sổ đối chứng 15 giây trước khi boot + re-probe từng path nghi vấn sau đó → khẳng định **không có
   writer MỚI** nào xuất hiện vì ta.
2. `~/.galaxy/gbh/profiles/**` phải **bất biến** — đây là dấu vết duy nhất mà một lần boot nhầm home để lại.
3. Tiến trình của ta **không mở file descriptor nào** dưới `~/.galaxy/gbh`.
4. Khi cây đang tĩnh, vẫn assert hash + mtime bằng nhau (test lưỡng tính).

Kết quả thật: `bun test tests/host` 21/21 pass · log `1226 entries · 8 already written by other harnesses ·
4 moved during boot · 0 unexplained`.

## 2. Credentials do **lớp patch sinh tự động** ghim, không phải patch trong repo

Trước: `profiles/blackhole/cordis.patch.yml` (trong repo) ghim `credentials.config.path`.
Sau: `~/.galaxy/blackhole/app.patch.yml` — sinh lại **mỗi lần boot**, là lớp **cuối cùng** trước patch người dùng.

Lý do:
- Hai lớp cùng quyết định một row là nguồn lỗi im lặng (lớp nào thắng phụ thuộc thứ tự).
- Bản app đóng gói có thể nằm ở thư mục **chỉ đọc** — không được phép ghi vào repo lúc chạy.
- Đường dẫn credentials phụ thuộc môi trường (`$HOME`), nên nó phải được sinh theo máy, không hard-code vào repo.

Đổi lại, `profiles/blackhole/cordis.patch.yml` trong repo chỉ còn là **lớp tuỳ chọn của người dùng** (ví dụ `locale: vi`).

**Hệ quả**: ai đọc code phải biết thứ tự lớp — bundle → patch profile → **app.patch.yml (sinh)** → patch người dùng.
