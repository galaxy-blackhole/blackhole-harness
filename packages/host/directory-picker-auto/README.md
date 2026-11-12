<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-host-directory-picker-auto — bản viết lại của dsh-host-directory-picker-auto
-->

# @galaxy-blackhole/gbh-host-directory-picker-auto

Bản viết lại của Galaxy Blackhole cho row `directory-picker`: **chọn backend chọn thư mục MỘT LẦN lúc boot**
rồi mount **cặp** gói backend + bề mặt client tương ứng thành entry thật của Loader. Đây là row **HOST-ONLY**
(gói gốc không có `dsh.client`), không có nửa browser, không có bẫy id module/HMR/JSX.

Vì sao phải chọn lúc boot: seam chọn-thư-mục đòi capability **ổn định suốt vòng đời service**; trình chọn
native chỉ phục vụ được khi người vận hành NHÌN THẤY màn hình của host, còn `browse` chạy được ở mọi nơi.

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Hợp đồng hành vi + 8 export | `@deepseek-ai/dsh-host-directory-picker-auto@0.2.1-alpha.4` — `lib/index.js` (164 dòng build) + `lib/types/index.d.ts` (đọc trong `apps/host/node_modules`, chỉ đọc) |
| Bảng chân trị của bộ giải | đối chứng **TRỰC TIẾP** với chính bundle gốc trong `tests/host/directory-picker-auto.test.ts` (13 ca) |
| Cơ chế thay row | cặp disable + insert, metadata `gbh` trong `package.json` — ADR 0004 §2 và §11 |

**Peer duy nhất: `@deepseek-ai/cordis`** (bảng §3b). Ba thứ mà bản gốc lấy từ gói DSH ngoài bảng §3b đã được
viết lại:
1. `isLoopbackHost` (bản gốc ở `dsh-host-webserver`) → `src/resolve.ts`, nhận IPv4 `127/8`, IPv6 `::1`,
   dạng đầy đủ `0:0:0:0:0:0:0:1`, dạng IPv4-mapped (`::ffff:127.0.0.1`, `::ffff:7f00:1`) và bỏ hậu tố vùng `%iface`.
2. `launchEnvironmentOf` + `launchedThroughSsh` (bản gốc ở `dsh-launch-environment`) → `src/launch.ts`, đọc ảnh
   chụp môi trường của launcher qua `ctx.get("launchEnvironment")` và chỉ xét **LỚP TIẾN TRÌNH**
   (`.env` của dự án/người dùng không bao giờ tạo ra một phiên SSH).
3. Seam Loader/webserver/connection → tra qua `ctx.get` (xem luật bên dưới), không import gói nào.

**Luật nhóm đã áp dụng:** mọi truy cập service trong row host dùng `ctx.get("<service>")` — Gateway/Loader có
thể gọi trên context KHÔNG áp danh sách inject của row, nên đọc thuộc tính sẽ ném
`cannot get property ... without inject`.

## Bảng TRƯỚC / SAU

| Phép đo | TRƯỚC (row DSH stock) | SAU (gói của ta) | Diễn giải |
|---|---|---|---|
| Row phục vụ `directory-picker` | `enabled: true · active` | stock **`enabled: false · null`** → ours **`enabled: true · active`** | đúng cặp disable + insert |
| Cặp entry động do row mount | `dsh-host-directory-picker-native` + `dsh-client-ui-directory-picker-native` (đều active) | **y hệt**, id động mới (`72e3609f` / `9fac630b`) | bộ giải chọn `native` trên máy này (darwin, loopback, không SSH) |
| Tổng entry trong cây | 232 | **233** | +1 = row `-ours` được chèn (row stock vẫn nằm trong cây ở trạng thái tắt) |
| Entry đang chạy | 178 | **178** | **KHÔNG ĐỔI** — điểm quan trọng nhất |
| `check:app` | — | **LÀNH 11/11** (49.359 B · 72/72 entry · 0 `did not activate` · `#root` 99.183 · 0 lỗi console · 23 file khớp repo · HMR sống) | — |
| Lab cách ly | — | home `/tmp/gbh-lab-directory-picker-auto`, cổng 5460: 0 `did not activate` · 72 entry · 3 batch · 0 lỗi console · cặp picker active | — |

## Test

`bun test tests/host/directory-picker-auto.test.ts` — **11 test / 51 expect**:
bảng chân trị 13 ca **đối chứng với chính bundle gốc** · `isLoopbackHost` (7 dạng đúng + 7 dạng sai) ·
phép dò PATH `hasLinuxChooserBinary` (6 ca, có/không zenity/kdialog, PATH rỗng/thiếu) ·
`canExecute` trên tệp THẬT (755 / 644 / không tồn tại) đối chứng với bản gốc ·
`apply` mount đúng thứ tự [backend, surface] và hàm dọn gỡ **ngược** thứ tự · SSH ⇒ cặp `browse` ·
bind ngoài loopback ⇒ `browse` · entry thứ hai thiếu fiber ⇒ ném lỗi RÕ RÀNG **và đã dọn entry thứ nhất** ·
thiếu seam loader ⇒ lỗi rõ ràng, không treo · tập export TRÙNG bản gốc và **không có `default`**.

**Không có ca BYTE**: row này không phục vụ route/RPC nào (nó chỉ mount entry), nên bài học ADR 0004 §8
không áp dụng ở đây — điều đó được khẳng định bằng chính test export (không có endpoint nào để kiểm byte).

## Chưa làm (bàn giao)

- Bộ giải chỉ chạy **một lần lúc boot** (đúng hợp đồng seam); đổi `webServer.host` hay bật SSH sau đó KHÔNG
  làm backend đổi theo — muốn đổi phải boot lại.
- Nhánh `native` trên Linux (zenity/kdialog) chỉ được test ở tầng bộ giải + phép dò PATH; không có máy Linux
  trong phiên này để kiểm đầu-cuối.
- Tên thư mục package là `directory-picker-auto` nhưng `gbh.row.id` là `directory-picker` (id của row trong
  cây) — công cụ lab tìm theo TÊN THƯ MỤC, nên gọi `bun run lab:row directory-picker-auto`.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-host-directory-picker-auto` (shasum `en dbb33e55215b...` · `zh 9272043e6fc9...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
