<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Hop dong C4: RPC/Typert — khung do, be mat Remote quan sat duoc, ke hoach trace frame o M4
-->

# C4 — RPC / Typert

> **Trạng thái: KHUNG ĐO (chưa đóng băng).** Hợp đồng này chỉ có thể đóng băng khi ta **ghi được trace hai bên**
> và diff từng frame — việc đó thuộc **M4** (host/API là tầng viết lại đầu tiên). Mọi số liệu frame dưới đây
> **chưa đo**; tài liệu này ghi rõ *đo cái gì, đo bằng gì, đạt là thế nào*.

## 1. Phát biểu hợp đồng (phần chắc chắn được ngay)

1. Kênh: client nói chuyện với host qua **một** kết nối có xác thực (`@deepseek-ai/dsh-client-connection`);
   mọi capability đi qua **gateway** (`@deepseek-ai/dsh-api-gateway`) và **remotes** (`@deepseek-ai/dsh-api-remotes`).
2. Đồ thị nạp: `api-remotes` phải inject `api-gateway`; `api-gateway` inject `typert-registry` và `client-connection`.
3. Phạm vi: các controller sau là **bề mặt công khai** phải giữ tên namespace/method:
   session, jobs, terminal, workspace-files, account, settings, remote-access, plugin inventory.
4. Kiểu dữ liệu: payload/result đi qua lớp Typert (schema sinh tự động) — đổi schema là đổi hợp đồng wire.

## 2. Nguồn chứng minh

| Nguồn | Chi tiết |
|---|---|
| Upstream (gói đã cài) | `apps/host/node_modules/@deepseek-ai/dsh-api-gateway`, `dsh-api-remotes`, `dsh-api-*-controller`, `dsh-typert-registry`, `dsh-typert-loader`, `dsh-client-connection` |
| Hành vi đo được ngay (17/10/2026) | 3 entry trong đồ thị boot với cạnh inject đã chốt; **8 bề mặt Remote** có row trong cây plugin |
| Fixture | `tests/contract/fixtures/c4-rpc-plan.json` (bề mặt + kế hoạch đo) |
| Test | `tests/contract/c4-rpc-typert.test.ts` — 4 test + 1 mục `todo` cho M4 |
| Bằng chứng cây | `tests/contract/fixtures/c3-profile-tree.json` (đối chiếu chéo: mọi bề mặt phải có row) |

### Bề mặt Remote đang có trong cây (nguồn: cây plugin thật)

| id row | Gói |
|---|---|
| `typert-gateway` | `@deepseek-ai/dsh-api-gateway` |
| `api-remotes` | `@deepseek-ai/dsh-api-remotes` |
| `session-controller` | `@deepseek-ai/dsh-api-session-controller` |
| `job-controller` | `@deepseek-ai/dsh-api-job-controller` |
| `terminal-controller` | `@deepseek-ai/dsh-api-terminal-controller` |
| `workspace-files` | `@deepseek-ai/dsh-api-workspace-files` |
| `account-controller` | `@deepseek-ai/dsh-api-account-controller` |
| `settings-controller` | `@deepseek-ai/dsh-api-settings-controller` |
| `workspace-controller` | `@deepseek-ai/dsh-api-workspace-controller` |

## 3. Cách đo ở M4 (chưa làm — không bịa số)

| Bước | Việc | Tiêu chí đạt |
|---|---|---|
| 1 | Bật trace hai bên (app @5439 và Oracle A @4001), cùng một kịch bản: mở phiên → gửi 1 prompt → mở sidebar files → xem jobs | hai file trace thô |
| 2 | Chuẩn hoá trace: bỏ token, timestamp, id phiên, id sinh tự động | trace đã chuẩn hoá, so được |
| 3 | Diff **từng frame**: tên namespace, method, shape payload/result, khung stream, mã lỗi | **0 frame lệch** |
| 4 | Ghi lại danh sách method đã đi qua làm hợp đồng tối thiểu | danh sách method được đóng băng vào fixture |
| 5 | Test hồi quy: chạy lại kịch bản, diff với fixture | pass trong CI |

Năm namespace sẽ trace trước (đủ để phủ mọi kiểu truyền: lệnh, đọc nguội, stream, sự kiện):
session, workspaceFiles, jobs, account, settings.

## 4. Điều gì làm hợp đồng VỠ

| Thay đổi | Hậu quả |
|---|---|
| Đổi tên namespace/method | Client cũ gọi sai; UI chết ở màn đầu |
| Đổi shape payload (thêm/bớt/đổi kiểu trường) | Lỗi giải mã ở đầu bên kia, thường im lặng |
| Đổi khung stream (thứ tự frame, mất frame cuối, đổi cách đóng) | Treo UI ở trạng thái "đang chạy" |
| Bỏ vòng đời "generation" khi nối lại | Sự kiện của thế hệ cũ rò sang thế hệ mới |
| Gộp nhiều capability vào một method to | Mất khả năng phân quyền theo method (xem `dsh-api-remote-access`) |
| Đổi mã lỗi mà không giữ mã cũ | UI không phân biệt được lỗi quyền với lỗi mạng |

## 5. Việc còn lại

- [ ] **M4**: trace + diff frame (task-7 mở rộng giàn parity có `parity:trace`).
- [ ] **M4**: đưa danh sách method đã trace vào fixture và bật test hồi quy.
- [ ] Ghi lại **mã lỗi** (danh sách ổn định) và cách hiển thị chúng trong UI.
