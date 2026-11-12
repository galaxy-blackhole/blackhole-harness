<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói THƯ VIỆN gbh-atomic-write — nguồn đối chiếu G4, vì sao KHÔNG mount, số đo TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-atomic-write (thư viện)

Bản viết lại **1:1** của `@deepseek-ai/dsh-atomic-write` (**220 dòng**, **zero-dependency**): thay thế tệp
**NGUYÊN TỬ** và **khoá người ghi liên tiến trình**.

## 0. Vì sao **KHÔNG** khai `gbh.row`

| Đo được | Kết quả |
|---|---|
| Hình dạng | `dsh: null`, **KHÔNG** `exports["./client"]`, không có `apply` — chỉ **2 hàm** `writeFileAtomic` · `withFileLock` |
| Row trong dump | **0** (`grep dsh-atomic-write .parity/dumps/2026-10-18T01-31-57/ours.yml` = 0) |
| Consumer | `dsh-app-boot` · `dsh-config-editor` · `dsh-credentials-local` · `dsh-llm-deepseek` · `dsh-plugin-manager` — **inline** thư viện vào bundle của họ |

⇒ `gbh.row_unmounted_ly_do` = *thư viện thuần hàm, consumer inline (không có row/apply để mount)*. Tiền lệ:
`packages/host/{subprocess,agent-preset,workflow,session-title-llm}`.

## 1. Nguồn đối chiếu (G4)

| Hành vi | Bản gốc | Bản của ta | Bằng chứng |
|---|---|---|---|
| Tập export | `withFileLock · writeFileAtomic` | **bằng** (2 = 2) | đo trên ARTIFACT |
| Ghi nguyên tử | `mkdir(dirname, {recursive})` → tệp tạm `<file>.<6 byte hex>.tmp` mở **`wx`** với `mode` của bên gọi → `rename` | y nguyên | 6 ca |
| Bit quyền | inode MỚI mang `options.mode` qua rename ⇒ **thu hẹp** tệp quyền rộng mà không có cuộc đua `chmod` | y nguyên | `0o644 → 0o600` đo được |
| Symlink đích | rename thay **chính symlink**, không ghi xuyên qua referent | y nguyên | ca symlink |
| Dọn tệp tạm | mọi lỗi ⇒ `rm(temp, {force:true})` rồi ném lại | y nguyên | ca thư mục chỉ-đọc: không còn `.tmp` |
| Windows | thử lại `EACCES`/`EBUSY`/`EPERM` **8 lần**, chờ 20→200 ms (hàm mũ) | y nguyên | hằng số + nhánh, chỉ chạy trên `win32` |
| Khoá | tệp anh-em `<file>.lock` mở `wx`, ghi `<pid>\n`, mode `0o600`; nhả trong `finally` | y nguyên | 6 ca |
| Bàn giao khoá | chủ đã chết (`ESRCH`) ⇒ tệp **nhận bàn giao** `<lock>.takeover-<sha256(record)[0:16]>` (cũng `wx`), đọc LẠI khoá + thăm dò PID lần nữa, chỉ xoá khi vẫn đúng bản ghi đó | y nguyên | ca PID chết ⇒ chạy được |
| Tranh chấp | lùi hàm mũ 20→200 ms, hết hạn theo `waitMs` (mặc định **2000 ms**) | y nguyên | ca hết hạn |
| Huỷ | `signal.throwIfAborted()` trước mỗi lần thử và trước thao tác | y nguyên | ca huỷ trước |

## 2. Peer

| Peer | Vì sao |
|---|---|
| `@deepseek-ai/cordis` | **chỉ để khai** như bản gốc (gói không import gì từ cordis); `gbh.peers` = **[]** |

## 3. Test — 13 ca · 38 expect · 0 fail

```bash
~/.bun/bin/bun test tests/host/atomic-write.test.ts
```

**Mọi ca chạy CẢ HAI bản** trên **thư mục tạm THẬT** (A/B thật, không giả lập): export (2 = 2) · tạo thư mục cha
lồng + không để lại `.tmp` · bit quyền (tạo mới `0o600`; thay `0o644` ⇒ **thu hẹp** `0o600`) · đích là
**symlink** (referent không đổi) · nội dung **nhị phân** · lỗi ghi ⇒ **dọn tệp tạm** · khoá tuần tự hoá hai thao
tác · thao tác ném ⇒ **vẫn nhả khoá** · hết hạn chờ (thông điệp **chuẩn hoá đường dẫn** khi so A/B) · **bàn giao
khoá** của chủ đã chết · huỷ trước ⇒ ném ngay, không tạo khoá · **hai bản chia sẻ CÙNG giao thức khoá** trên một
tệp (không giẫm lên nhau).

## 4. TRƯỚC / SAU

| | TRƯỚC (bản gốc) | SAU (gói này) |
|---|---|---|
| Vai trò | thư viện dùng bởi 5 gói stock (inline) | **y nguyên** — cùng hợp đồng 2 hàm |
| Tập export trên artifact | 2 tên | **bằng** (2 = 2) |
| Test | — | **13 pass / 0 fail / 38 expect** |
| `check:rows` | — | không áp dụng (không khai `gbh.row`) |

**CHƯA làm:** chuyển 5 consumer sang gói này (mỗi consumer là task riêng, có A/B bundle); `fsync` (bền sau crash)
**ngoài phạm vi** đúng như bản gốc.
