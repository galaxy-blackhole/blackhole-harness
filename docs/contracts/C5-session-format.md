<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Hop dong C5: dinh dang phien — session.v4.jsonl.zstd, ban ghi header, ke hoach round-trip o M4
-->

# C5 — Định dạng phiên (session)

> **Trạng thái: ĐÓNG BĂNG MỘT PHẦN.** Đã đo được **định dạng trên đĩa** và **bản ghi header**;
> phần "mở lại phiên do DSH tạo" và bảng migration thuộc **M4** (chưa đo — không bịa số).

## 1. Phát biểu hợp đồng

1. **Vị trí**: `<DSH_HOME>/sessions/<workspace-slug>/<session-id>/` — với app ta, DSH_HOME = `~/.galaxy/blackhole`.
2. **Tên file**: `session.v<phiên bản>.jsonl.zstd` — JSONL nén **zstd**, mỗi dòng là một bản ghi JSON.
3. **Bản ghi đầu tiên** là header: `type` = `session` kèm 7 trường bắt buộc (xem §2).
4. **Khoá phiên**: mỗi phiên có `session.lock`; projection cache nằm ở `storages/session_projcache/sessions/<id>.json`.
5. **Bất biến**: ta chỉ đọc để đối chiếu — không ghi vào phiên của bản web đang chạy, không sửa định dạng gốc.

## 2. Nguồn chứng minh

| Nguồn | Chi tiết |
|---|---|
| Upstream (gói đã cài) | `apps/host/node_modules/@deepseek-ai/dsh-session-persistence-jsonl` (ghi JSONL bền vững) + `dsh-session` (kho phiên hướng sự kiện) |
| Hành vi đo được (17/10/2026) | **2 file phiên**, tất cả đều là **v4** và đều nén zstd; mỗi file hiện có 1 bản ghi `session` (phiên mới, chưa có lượt nào) |
| Bản ghi header đo được | `type, version, id, createdAt, cwd, isSeeded, delegationDepth, agentPreset` (8 khoá) |
| Fixture + test | `tests/contract/fixtures/c5-session-format.json` · `tests/contract/c5-session-format.test.ts` — 4 test (1 trong đó chỉ chạy khi máy có phiên) + 2 mục `todo` |
| Cách đo | `zstdDecompressSync` (node:zlib) → tách dòng JSON → **chỉ lấy `type` và tên khoá**, không sao chép nội dung hội thoại |

### Sai lệch so với giả định cũ của ARCHITECTURE (đã ghi nhận)

ARCHITECTURE §4.3 giả định "session JSONL + migration v0→v3". Thực tế trên đĩa là **v4** và **có nén zstd**.
Hệ quả: hợp đồng C5 phải đóng băng `v4 + zstd`, và bảng migration phải tính tới cả v3→v4.

## 3. Test snapshot tương ứng

| Test | Canh điều gì |
|---|---|
| tên file + phiên bản | `session.v4.jsonl.zstd` tại `~/.galaxy/blackhole/sessions`, không phải home `gbh` |
| bản ghi header | 8 khoá bắt buộc, đúng thứ tự đã sắp xếp trong fixture |
| (live) đọc lại phiên thật | giải nén zstd + JSONL, mọi file phải bắt đầu bằng `type=session` đủ khoá |
| không sao chép nội dung | fixture không chứa `cwd` tuyệt đối; mọi "khoá" không có dấu cách |
| 2 mục `todo` | round-trip và bảng migration — cố ý để trống cho tới M4 |

## 4. Điều gì làm hợp đồng VỠ

| Thay đổi | Hậu quả |
|---|---|
| Đổi tên/đuôi file hoặc bỏ nén | Code đọc phiên cũ không tìm thấy; dữ liệu người dùng "biến mất" |
| Đổi framing (không còn JSONL thuần) | Phải viết lại bộ đọc; mất khả năng đọc tăng dần (streaming) |
| Bỏ/thêm/đổi khoá header không có migration | Phiên cũ mở ra lỗi hoặc mất ngữ cảnh (agentPreset, cwd) |
| Đổi khoá `cwd` hay `delegationDepth` | Sai ngữ cảnh làm việc của phiên; phân cấp subagent hỏng |
| Ghi vào thư mục phiên khi chỉ cần đọc | Vi phạm cách ly; làm hỏng `session.lock` của tiến trình đang chạy |

## 5. Việc còn lại

- [ ] **M4**: round-trip — mở một phiên do DSH tạo bằng code của ta và diff từng record.
- [ ] **M4**: bảng migration v0 → v4 (kèm v3 → v4 và zstd) + test cho mỗi bước.
- [ ] Đóng băng **từ vựng loại bản ghi** (hiện chỉ thấy `session` vì các phiên mới chưa có lượt nào).
- [ ] Kiểm tra đọc tăng dần: mở file đang được ghi mà không hỏng.
