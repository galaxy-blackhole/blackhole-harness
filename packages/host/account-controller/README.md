<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-api-account-controller — bản viết lại của dsh-api-account-controller
-->

# @galaxy-blackhole/gbh-api-account-controller

Bản viết lại của Galaxy Blackhole cho row `account-controller`: service remote **`accountController`** với
**namespace `account`** và **11 phương thức** (9 gọi trực tiếp + 2 luồng), phơi các thao tác tài khoản
AN TOÀN qua Remote. Đây là row **HOST-ONLY**: gói gốc **không có `dsh.client`** (đã kiểm), nên không có
nửa browser, không có bẫy id module/HMR/JSX.

> Tên package theo NHÓM trong sổ đóng băng `docs/contracts/data/dsh-packages.json` (row này group = `api`,
> nên là `gbh-api-account-controller`), khớp cột "gbh tương ứng" của `docs/PARITY-MATRIX.md` — nhờ vậy
> phép so parity ghép được cặp disable+insert thành "một row đã thay" thay vì báo THÊM/ĐỔI.
> Thư mục vẫn là `packages/host/account-controller/` (nhóm thư mục = tầng host/API).

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Hợp đồng hành vi + 11 chữ ký phương thức | `@deepseek-ai/dsh-api-account-controller@0.2.1-alpha.4` — `lib/types/index.d.ts` (đọc trong `apps/host/node_modules`, chỉ đọc) |
| Kiểu giá trị đi qua dây | `@deepseek-ai/dsh-deepseek-account@0.2.1-alpha.4` — `lib/types/types.d.ts`; kiểu trong `src/types.ts` là **của ta**, viết lại theo hợp đồng đó (không import gói ngoài bảng §3b) |
| Cơ chế đăng ký remote | seam `@deepseek-ai/dsh-typert-protocol`: `TypertRemoteService` + decorator `@Remote` / `@Remote({ mode: "stream" })`, `serviceKey = "accountController"`, `namespace = "account"` |
| Danh sách phương thức + chế độ stream | đối chứng TRỰC TIẾP với chính bundle gốc bằng `remoteMethods()` trong `tests/host/account-controller.test.ts` |
| Cơ chế thay row | cặp disable + insert, metadata `gbh` trong `package.json` — ADR 0004 §2 và §11 |

**Vì sao cần peer `@deepseek-ai/dsh-typert-protocol`** (bảng §3b của `packages/README.md`): lớp này **phải**
kế thừa đúng base class của seam RPC để Gateway của kernel discovery được; khai là `peer` (không bao giờ là
dependency) để chỉ có ĐÚNG MỘT instance do kernel cấp, và ở M3 kernel của ta phơi cùng tên gói đó.
Hai service uỷ quyền (`deepseekAccount`, `agents`) **không** phải peer: row tra chúng qua `ctx.get`.

## Bản đồ hành vi (đo từ bản gốc, rồi viết lại)

| Phương thức | Chế độ | Việc |
|---|---|---|
| `getState` | direct | trạng thái tài khoản an toàn + lần đăng nhập gần nhất |
| `getProfile` · `getBalance` · `getUnnotifiedBonuses` | direct | truy vấn Platform (hồ sơ · số dư · đơn thưởng chưa thông báo) |
| `ackBonusNotified` | direct | ghi nhận một đơn thưởng đã hiển thị |
| `startSignIn` · `cancelSignIn` · `signOut` | direct | vòng đời đăng nhập |
| `hasRunningAccountTasks` | direct | có task đang chạy trên tuyến account hay không |
| `watchExpiry` | **stream** | phát `session-expired` khi credential hết hạn (KHÔNG phát lại) |
| `watch` | **stream** | phát bản chiếu tài khoản |

Hai chỗ viết lại theo hành vi (không chép code): **cầu nối event → async iterator** của `watchExpiry`
(bộ đếm + đánh thức + gỡ listener trong `finally`), và **vị từ** `isRunningAccountTask` (bản gốc nằm
trong gói `dsh-deepseek-account` — ngoài bảng §3b — nên ta viết lại: chỉ đúng khi task đang chạy VÀ
provider của request context là `deepseek-account`).

### ⚠️ Một khác biệt CƠ CHẾ đã đo được (đừng "sửa" thành giống bản gốc)

Bản gốc đọc `this.ctx.deepseekAccount`; ta dùng `ctx.get("deepseekAccount")`. Lý do: khi Gateway gọi một
phương thức Remote, nó chạy trên **context của bên gọi** — nơi KHÔNG áp danh sách `inject` của row — nên
truy cập kiểu thuộc tính ném `gateway/internal: cannot get property "deepseekAccount" without inject`
(đo trên lab 5461, 17/10/2026: route trả 200 + 178 B lỗi thay vì 217 B đúng).
`static inject = ["deepseekAccount", "agents"]` vẫn giữ nguyên để cordis chờ seam sẵn sàng.
Gói `plugin-inventory` của ta cũng đi đúng đường `ctx.get` này.

## Bảng TRƯỚC / SAU (cùng một phép đo, app 5439)

| Phép đo | TRƯỚC (row DSH stock) | SAU (gói của ta) | Diễn giải |
|---|---|---|---|
| `account/getState` | 200 · **220 B** | 200 · **220 B** | y hệt, từng byte |
| `account/hasRunningAccountTasks` | 200 · **78 B** | 200 · **78 B** | y hệt |
| Không cookie | **401** · 12 B | **401** · 12 B | tầng tin cậy của kernel, không đổi |
| Endpoint không tồn tại | **404** `not found` | **404** `not found` | lỗi rõ ràng, không treo |
| Số entry `__DSH_BOOT__` | 72 | **72** | row thay chỗ row, không thêm entry |
| Gói CỦA TA đang chạy | 14 | **15** | +1 = package này |
| `did not activate` | 0 | **0** | — |
| `#root` + lỗi console | 99.183 ký tự · 0 lỗi | **99.183 ký tự · 0 lỗi** | UI không đổi |

Lab cách ly (home `/tmp/gbh-lab-acct`, cổng 5461, overlay `--patch`, không đụng `app.patch.yml` thật):
stock 73 entry · 239 ký tự `#root` · RPC 217 B → ours **73 entry · 239 ký tự · 217 B** · 0 lỗi console cả hai lượt.

## Test

`bun test tests/host/account-controller.test.ts` — **12 test / 40 expect**, trong đó:
đối chứng bề mặt Remote **trực tiếp với chính bundle gốc** (11 phương thức + chế độ stream + thứ tự) ·
uỷ quyền đúng thứ tự tham số cho cả 9 phương thức · vị từ `hasRunningAccountTasks` (3 ca âm) ·
cầu nối `watchExpiry` (không phát lại, gỡ listener khi abort) · **ca BYTE** theo ADR 0004 §8
(`String(view)` ≠ byte; `ArrayBuffer.isView` rộng hơn `Buffer.isBuffer`) · hai ca đường lỗi.

## Chưa làm (bàn giao)

- `startSignIn`/`signOut` chỉ test ở mức uỷ quyền: chúng cần Platform thật để kiểm đầu-cuối, nên chỉ đo được
  hình dạng tham số và luồng lỗi. Muốn đo thật phải có một phiên Platform trong lab.
- Row không có `Config` schema (bản gốc cũng không), nên M3 không cần phơi schema cho nó.
- Nếu M3 đổi tên namespace/khoá service thì phải giữ đúng `account`/`accountController`: client
  (`dsh-api-remotes` đã nhúng sẵn `createTypertRemoteInfo` cho `account`) gọi theo đúng hai tên đó.
- Tên package phải khớp cột trong `docs/PARITY-MATRIX.md`; nếu ai đó đổi tên gói mà quên cập nhật sổ đóng băng,
  phép so parity sẽ báo THÊM/ĐỔI giả (đã gặp đúng lúc đặt tên `gbh-host-…` thay vì `gbh-api-…`).

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-api-account-controller` (shasum `en 01c4c3398f85...` · `zh bdfcbbeb156b...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
