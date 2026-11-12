<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Backend browse của seam directory-picker — bản viết lại 1:1 của @deepseek-ai/dsh-host-directory-picker-browse
-->

# @galaxy-blackhole/gbh-host-directory-picker-browse

Bản gốc: `@deepseek-ai/dsh-host-directory-picker-browse` @0.2.1-alpha.4 — `lib/index.js` **234 dòng / 9.296 ký tự**.

## Bề mặt export (1:1)

`boundedInsert` · `fullyQualified` · `raceAbort` · `default` (class `BrowseDirectoryPicker`, kèm `DirectoryPickerError` + các interface `Crumb`/`DirectoryRow`/`DirectoryListing`).

## Quan hệ với seam `host-directory-picker`

Bản gốc `extends DirectoryPicker` (lấy từ `@deepseek-ai/dsh-host-directory-picker`) và ném `DirectoryPickerError` của seam. Bản của ta khai **interface HẸP cục bộ** (`DirectoryPickerBase` + `DirectoryPickerError` nội bộ, hình dạng y bản gốc) thay vì import tĩnh gói seam.

**Lý do chọn (B)** — Lead chốt 19/10/2026:
1. đúng luật repo: không import tĩnh `@deepseek-ai/*` trong gói ta;
2. **không phụ thuộc thứ tự build**: gói này build được kể cả khi artefact `lib/` của seam chưa có (gói seam chỉ re-export từ `../lib/index.js`);
3. hành vi vẫn **1:1** vì interface chỉ mô tả hình dạng (`capability()`, `code`/`path` của lỗi), không thêm logic.

## Hành vi 1:1 đáng chú ý

- `list()`: chặn bộ nhớ **O(maxEntries)** bằng cửa sổ tên-sắp-xếp (`boundedInsert`), `truncated` bật khi cắt cấp; theo symlink tới thư mục, bỏ link hỏng/vòng; `path` vắng ⇒ home.
- `fullyQualified()`: POSIX tuyệt đối; Windows chỉ nhận dạng có ổ đĩa hoặc UNC đầy đủ (`\foo`, `/foo`, `\\`, `\\server` đều **false**).
- `createDirectory()`: từ chối tên không phải một segment; `EEXIST` ⇒ mã `directory-exists`.
- `raceAbort()`: huỷ ⇒ reject theo `signal.reason`, phần kết muộn của operation bị nuốt.

## Locale

`locale/en.json` **59 B** · `locale/zh.json` **158 B** — **byte-equal** bản gốc (test khẳng định).

## Test

`tests/host/host-directory-picker-browse.test.ts` — 5 nhóm: bề mặt export · `fullyQualified` posix/win32 · `boundedInsert` (giữ cửa sổ/evict) · `raceAbort` (huỷ trước & giữa chừng) · class `list`/`createDirectory` trên thư mục tạm + `EEXIST`. Không mount/boot.
