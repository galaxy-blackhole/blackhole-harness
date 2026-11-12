<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Hop dong C2: module loader — window.__ModuleLoader__.load/create, ngu nghia lazy-CJS va memoize
-->

# C2 — Module loader: `window.__ModuleLoader__`

> **Trạng thái: ĐÓNG BĂNG (test chạy được cả HÀNH VI).** Đoạn mã loader thật được lưu nguyên văn làm fixture
> và **được thực thi** trong test với một `window` giả.

## 1. Phát biểu hợp đồng

Trang HTML cài một loader tối giản **trước** các bundle plugin:

`window.__ModuleLoader__ = { mode, pendingQueue, load(registration), create(options) }`

- `mode`: luôn là `queue` cho tới khi hệ module thật tiếp quản.
- `load({ id, factory })`: **chỉ xếp hàng**, KHÔNG gọi `factory` (lazy).
- `create(options)`: gọi `factory` của riêng entry `@deepseek-ai/dsh-client-modules`, gỡ nó khỏi hàng đợi,
  kiểm tra hình dạng export (`apply` + `createClientModuleSystem`) rồi trả về hệ module thật.
- Trong lúc tạo hệ module, `require` nội bộ **chặn mọi specifier ngoài** bằng lỗi rõ ràng.

Bất biến: các thông điệp lỗi ở §2 là **một phần của hợp đồng** (plugin ngoài và log lỗi dựa vào chúng) —
chỉ được đổi khi thông báo trước và cập nhật fixture.

## 2. Nguồn chứng minh

| Nguồn | Chi tiết |
|---|---|
| Upstream (gói đã cài) | `apps/host/node_modules/@deepseek-ai/dsh-client-modules` — nửa browser chính là bảng lazy-CJS; đoạn bootstrap do host chèn vào HTML |
| Hành vi đo được (17/10/2026) | 22 dòng JS; `pendingQueue` chính là mảng đăng ký dùng chung (không copy) |
| Fixture đóng băng | `tests/contract/fixtures/c2-module-loader.js` (nguyên văn) + `c2-module-loader.json` (SHA-256, bề mặt, thông điệp lỗi) |
| Test | `tests/contract/c2-module-loader.test.ts` — 7 test, chạy thật đoạn mã trong `window` giả |

### Thông điệp lỗi thuộc hợp đồng

1. `client-modules: window.__ModuleLoader__.create called after module-system boot`
2. `client-modules: HTML did not preload @deepseek-ai/dsh-client-modules/client.js`
3. `client-modules: ... did not export the bootstrap module face`
4. `client-modules: ... requested external <specifier> before the module system existed`

## 3. Test snapshot tương ứng

| Test | Canh điều gì |
|---|---|
| hash khớp fixture | đoạn loader không bị sửa lén (SHA-256 lưu trong fixture) |
| bề mặt công khai | `mode`/`load`/`create`/`pendingQueue` đúng kiểu, `mode` = `queue` |
| `load()` chỉ xếp hàng | `factory` không được gọi; thứ tự hàng đợi giữ nguyên (lazy) |
| `create()` thiếu client-modules | ném đúng lỗi `"did not preload"` |
| `create()` đủ điều kiện | gọi `factory`, `require` chặn external, gỡ khỏi hàng đợi, trả hệ module |
| `create()` lần hai | ném lỗi `"did not preload"` — đăng ký đã bị gỡ, tức memoize theo đăng ký |
| factory thiếu bề mặt | ném đúng lỗi `"did not export the bootstrap module face"` |

## 4. Điều gì làm hợp đồng VỠ

| Thay đổi | Hậu quả |
|---|---|
| Gọi `factory` ngay trong `load()` | Mất tính lazy: plugin phụ thuộc bị nạp trước khi sẵn sàng |
| Bỏ kiểm tra hình dạng export | Lỗi khó hiểu ở sâu trong hệ module thay vì lỗi rõ ngay tại biên |
| Cho phép `require` ngoài khi đang tạo hệ module | Phá mô hình lazy-CJS; bundle chéo nhau, không kiểm soát thứ tự |
| Đổi tên `window.__ModuleLoader__` | Mọi bundle plugin DSH ném lỗi ngay dòng đầu |
| Đổi chữ ký `load({ id, factory })` thành `(id, factory)` | Bundle cũ nạp sai (đăng ký bị hiểu là id) |
| Giữ đăng ký trong hàng đợi sau `create()` | `create()` lần hai tạo hệ module thứ hai: hai React root, hai kết nối |

## 4bis. Alias id module — khai báo `gbh.row.aliases` (17/10/2026)

Bundle của một row HAI MẶT có thể phải đăng ký **hai id module**: id package của ta (để entry trong
`__DSH_BOOT__` vạt chất hoá được) và id package GỐC (để mọi bundle phụ thuộc `require("<gói gốc>/client")`
tìm thấy). Điều này đã được chứng minh bằng thực nghiệm, không phải suy luận — xem
[HOST-ROW-REWRITE.md](../recipes/HOST-ROW-REWRITE.md) §6.

Nguồn dữ liệu là **khai báo**, không phải suy đoán: row khai trong `package.json` của package mình

    "gbh": { "row": { "id": "<row-id>", "aliases": ["@deepseek-ai/<gói gốc>"], "tests": ["…"] } }

`bh host` đọc khai báo đó và phát nó trong wire dưới trường **`aliases`** của dòng tương ứng trong
`__DSH_BOOT__` (mảng chuỗi; vắng mặt khi rỗng). Bộ nạp phía browser (`gbh-client-modules`) làm ba việc,
và row KHÔNG phải tự xử HMR:

1. `rev` của khoá alias lấy từ ROW sở hữu (`reloadTargets`/`graphRows`) — HMR không bao giờ thấy rev rỗng.
2. `invalidate(rowId)` xoá cả factory lẫn bản ghi cache của mọi alias thuộc row đó.
3. `prune` giữ alias theo owner, và bản ghi module được memoize theo **row sở hữu** — id chính và id alias
   trỏ về ĐÚNG MỘT instance, không nhân đôi module.

Bất biến: thiếu id chính thì entry của row không vạt chất hoá được (`no registered factory`); thiếu id
alias thì gói phụ thuộc trượt bảng module (`require("…") missed the module table`).
## 5. Việc còn lại

- [ ] **M3**: đóng băng phần *sau* khi hệ module thật tiếp quản (đồ thị module, cache theo id, xử lý lỗi tải bundle).
- [ ] Thêm test nạp một bundle plugin thật (không chỉ factory giả) khi CI có server.
- [ ] Đo ngân sách: `load()` phải O(1); `create()` chỉ chạy một lần cho mỗi đăng ký.
