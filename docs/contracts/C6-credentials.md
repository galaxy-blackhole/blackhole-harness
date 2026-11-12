<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Hop dong C6: credentials — mot tai lieu duy nhat, env thang file, khong ro secret, cach ly home
-->

# C6 — Credentials

> **Trạng thái: ĐÓNG BĂNG (có test).** Phần ghim đường dẫn và an toàn đã có bằng chứng đo được;
> phần "thiếu key thì UI mở luồng nhập key" thuộc M4/M5.

## 1. Phát biểu hợp đồng

1. **Một gốc duy nhất**: mọi dự án trong hệ Galaxy (CLI, extension, desktop, GUI) đọc/ghi **cùng một** tài liệu
   `~/.galaxy/credentials.yaml` — không có bản sao theo từng app.
2. **Thứ tự lớp**: biến môi trường của tiến trình **thắng** tài liệu; tài liệu thắng giá trị mặc định. CLI ghim bằng
   `GBH_CREDENTIALS` (đặt biến này là đổi đường dẫn cho cả app).
3. **Ghim bằng patch, không sửa code**: row `credentials` trong cây plugin được patch trường `config.path`.
4. **Không rò secret**: file patch/khai báo **không** chứa giá trị khoá — chỉ chứa đường dẫn và **tên biến** môi trường.
5. **Cách ly home**: app dùng `~/.galaxy/blackhole`; cây `~/.galaxy/gbh` của bản web đang chạy là **chỉ đọc**.

## 2. Nguồn chứng minh

| Nguồn | Chi tiết |
|---|---|
| Upstream (gói đã cài) | `apps/host/node_modules/@deepseek-ai/dsh-credentials-local` — provider credentials đọc từ file trong DSH_HOME dưới môi trường tiến trình; `dsh-credentials` (seam) |
| Hành vi đo được (17/10/2026) | cây có **đúng 1** row `credentials` → `@deepseek-ai/dsh-credentials-local`, `config.path` trỏ `~/.galaxy/credentials.yaml` |
| File ghim | `profiles/blackhole/app.patch.yml` (template trong repo) và `~/.galaxy/blackhole/app.patch.yml` (bản runtime) đều ghim đường dẫn; `cordis.patch.yml` thì không (đã ghi lại để tránh hiểu nhầm) |
| Lớp env | `apps/cli/src/paths.ts`: `GBH_CREDENTIALS` ?? `~/.galaxy/credentials.yaml` |
| Quét bí mật | 3 file khai báo được quét bằng 4 mẫu (sk-*, Bearer, apiKey, hex ≥32) → **0 hit** |
| Cách ly home | test `gate:home-isolation` trong `tests/host` (hash cây `~/.galaxy/gbh` trước/sau boot không đổi) + test C6 |
| Fixture + test | `tests/contract/fixtures/c6-credentials.json` · `tests/contract/c6-credentials.test.ts` — 7 test |

## 3. Test snapshot tương ứng

| Test | Canh điều gì |
|---|---|
| đúng một row và trỏ seam | `credentials` → `dsh-credentials-local`, không nhân bản theo plugin khác |
| đường dẫn ghim | chuỗi ghim phải đúng `~/.galaxy/credentials.yaml` |
| có file patch ghim | ít nhất một lớp patch thật sự ghim đường dẫn đó |
| không nằm trong home app và không nằm trong `gbh` | chặn việc vô tình tách gốc hoặc ghi vào cây cấm |
| file khai báo không chứa secret | 0 hit trên 3 file |
| thứ tự lớp env > file | CLI phải còn `GBH_CREDENTIALS` + `credentials.yaml` |
| home app đúng | `APP_HOME` kết thúc bằng `/.galaxy/blackhole`, không phải `gbh` |

## 4. Điều gì làm hợp đồng VỠ

| Thay đổi | Hậu quả |
|---|---|
| Ghi key vào `app.patch.yml` hay vào repo | Bí mật nằm trong git; test quét secret sẽ đỏ (đúng như thiết kế) |
| Tạo bản credentials riêng cho desktop | Người dùng phải nhập key nhiều lần; lệch với CLI/extension |
| để env thua file | Không thể ghi đè tạm khi test/debug; CI không chạy được không cần file thật |
| Ghim bằng code thay vì patch | Đổi đường dẫn phải build lại; mất khả năng người dùng tự trỏ |
| Đổi `GBH_CREDENTIALS` thành tên khác | CLI và test cũ trỏ sai chỗ, key không được nạp |
| Đặt home app trùng `~/.galaxy/gbh` | Ghi vào cây đang phục vụ bản web 4001 — vi phạm luật bất biến |

## 5. Việc còn lại

- [ ] **M4**: test "thiếu key → cảnh báo rõ + mở luồng nhập key" và "không lộ nội dung credentials trong log/UI".
- [ ] **M4**: test ghi/đọc thật trên `~/.galaxy/credentials.yaml` (hiện chỉ kiểm đường dẫn + thứ tự lớp tĩnh).
- [ ] Đóng băng danh sách **khoá** hợp lệ trong tài liệu credentials (provider nào dùng khoá nào).
