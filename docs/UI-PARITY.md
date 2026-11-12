<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ma trận ảnh A/B theo từng màn hình UI: app 5439 so với blackhole web 4001, kèm số đo pixel
-->

# UI-PARITY — ma trận ảnh A/B theo từng màn hình

Lần chạy: **2026-10-17T08-28-59** · 3 PASS · 0 FAIL · 0 SKIP · tổng 0 pixel lệch ngoài mask trên 3 khung.

**Cổng trạng thái (parity:health) đầu/cuối lượt:** lành: parity:health xanh ở cả hai đầu và cây plugin không đổi trong suốt lượt.

**Dấu vân tay cây plugin của lượt đo:** sạch: toàn lượt đo trên MỘT trạng thái cây — rev e2ea5ac34f26 · 72 entry · 3 batch · hash 8ea8a2489c2e1104.

| Bên | Là gì | Ở đâu |
|---|---|---|
| `ours` | app của ta (Galaxy Blackhole Desktop) @ 5439 | http://127.0.0.1:5439/ |
| `ref` | oracle A (blackhole web) @ 4001 | http://127.0.0.1:4001/ |

Ảnh gốc và số liệu máy đọc nằm ở `.parity/features/2026-10-17T08-28-59/` (`summary.json`, `ref-*.png`, `ours-*.png`, `diff-*.png`, `pair-*.png`, `inventory-*.json`).

## 0. Cách đo (đọc trước khi tin số)

- Công cụ: `tools/features/run.ts` — Playwright + **Google Chrome có sẵn** (channel `chrome`), khung nhìn **1440x900**, cùng thao tác cho cả hai bên.
- **Mỗi kịch bản chạy bằng một profile Chrome MỚI** dưới thư mục tạm (`.parity/tmp/gbh-features-*`) và **luôn đóng trong `finally`** → không rò localStorage giữa các lần đo, không để lại tiến trình Chrome.
- Xác thực: cookie phiên **mint trong bộ nhớ** từ `~/.galaxy/credentials.yaml` (như `tools/parity/lib/browser.ts`). Giá trị cookie/secret **không** được in ra log hay ghi vào artifact.
- Cổng trạng thái trước mỗi cặp ảnh: HTTP 200 **và** instance đã lên ≥ 10 giây; chờ tối đa ~30s rồi mới bỏ. Cửa sổ restart **không bao giờ** bị ghi thành khác biệt giao diện.
- Hộp thoại một lần (Preview Notice / Get started / API key) được đóng ở **cả hai bên** trước khi chụp để so giao diện; số lần đóng ghi trong cột ghi chú.
- Ngưỡng đạt: **≤ 0.1%** số pixel lệch **ngoài vùng mask** (docs/ARCHITECTURE §5.2, quyết định D9). Cột px lệch ghi cả số **thô** (không mask) để đối chiếu.
- **Cổng hợp lệ** (bắt buộc trước khi tính điểm, điều kiện QUYẾT ĐỊNH là DOM): (1) có sidebar với New Session + Plugins; (2) có ô soạn tin — và ô tìm kiếm của màn đang đo; (3) DOM KHÔNG chứa 'Failed to load plugins' / 'did not activate' / 'Enter your Galaxy API key'. Tỉ lệ một màu trên **vùng không mask** chỉ là chỉ dấu PHỤ: nếu DOM thiếu anchor VÀ vùng đó quá 95% một màu thì mới kết luận màn trắng/màn lỗi; nếu DOM đủ anchor thì khung nhiều màu trắng vẫn hợp lệ (màn chào DSH vốn gần như trắng). Không hợp lệ thì ghi **KHÔNG HỢP LỆ (SKIP)** kèm lý do — không bao giờ tính thành PASS/FAIL.
- Ghi chú hợp lệ của từng màn (ví dụ khung phần lớn một màu) nằm trong ô ghi chú của bảng và trong `summary.json` (trường `validity`).
- **Dấu vân tay trạng thái cây plugin**: mỗi màn ghi lại `rev` + số `entries` + `batches` + hash danh sách entry đọc từ `__DSH_BOOT__` ngay lúc chụp. Lượt nào đổi cây giữa chừng bị đánh dấu **NGHI NHIỄM**; không trích số liệu của lượt không có dấu vân tay.
- **Chống 'FAIL giả'**: mỗi màn ghi lại dấu vân tay cây plugin (`rev` + số `entries` + hash), toạ độ y của tiêu đề đầu tiên, và `scrollTop` của mọi vùng cuộn — trước khi chụp, rig **đưa mọi vùng cuộn về 0** để một cú focus không làm lệch cả khung (đã từng gây lệch 28 px). Đầu và cuối lượt rig gọi `parity:health` và lưu vào `health.json`.
- **Bài học bắt buộc**: mọi phép thử có ghi vào HOME của app (settings.yaml, .agent-presets, storages, sessions) phải **snapshot + khôi phục CẢ state trong HOME**, không chỉ profile — nếu không, lượt đo sau sẽ bắt được rác thành 'khác biệt thật' (đã xảy ra 1 lần, xem §3.1).
- Ảnh trong bảng: bấm vào ảnh để mở cặp A/B (trái = ref 4001, phải = app 5439).

## 1. Ma trận

| # | Màn hình · tính năng | Ảnh A/B (trái = ref · phải = ours) | px lệch ngoài mask | mask đã bỏ | điều kiện sẵn sàng | cổng hợp lệ | verdict | ghi chú |
|---|---|---|---|---|---|---|---|---|
| 1 | **Mở session: khung chat + ô soạn tin**<br>`Khung hội thoại (transcript) và composer của DSH` | <a href="../.parity/features/2026-10-17T08-28-59/pair-session-open.png"><img src="../.parity/features/2026-10-17T08-28-59/thumb-session-open.png" width="330" alt="Mở session: khung chat + ô soạn tin"></a><br>[ref](../.parity/features/2026-10-17T08-28-59/ref-session-open.png) · [ours](../.parity/features/2026-10-17T08-28-59/ours-session-open.png) · [diff](../.parity/features/2026-10-17T08-28-59/diff-session-open.png) | 0 / 1075392 px (0.000%)<br>thô 2863 px (0.221%) | `state-sidebar-sessions` (state), `state-chip-workspace` (state) | trang tĩnh — chỉ cần tải xong | ✅ cả hai bên | PASS | màu trội vùng không mask: ours 99.3% · ref 99.3% |
| 2 | **Plugins → tab Installed**<br>`Built-in plugin settings + Experimental plugins (bật/tắt)` | <a href="../.parity/features/2026-10-17T08-28-59/pair-plugins-installed.png"><img src="../.parity/features/2026-10-17T08-28-59/thumb-plugins-installed.png" width="330" alt="Plugins → tab Installed"></a><br>[ref](../.parity/features/2026-10-17T08-28-59/ref-plugins-installed.png) · [ours](../.parity/features/2026-10-17T08-28-59/ours-plugins-installed.png) · [diff](../.parity/features/2026-10-17T08-28-59/diff-plugins-installed.png) | 0 / 1119744 px (0.000%)<br>thô 2100 px (0.162%) | `state-sidebar-sessions` (state) | thấy dòng plugin đầu tiên trong danh sách (dữ liệu từ RPC inventory) (chờ 822ms) ✅ | ✅ cả hai bên | PASS | màu trội vùng không mask: ours 96.9% · ref 96.9% |
| 3 | **Settings → General**<br>`Permission · Language · Appearance · Font size · Work details · Keyboard shortcuts · Send behavior` | <a href="../.parity/features/2026-10-17T08-28-59/pair-settings-general.png"><img src="../.parity/features/2026-10-17T08-28-59/thumb-settings-general.png" width="330" alt="Settings → General"></a><br>[ref](../.parity/features/2026-10-17T08-28-59/ref-settings-general.png) · [ours](../.parity/features/2026-10-17T08-28-59/ours-settings-general.png) · [diff](../.parity/features/2026-10-17T08-28-59/diff-settings-general.png) | 0 / 1119744 px (0.000%)<br>thô 1992 px (0.154%) | `state-sidebar-sessions` (state) | trang tĩnh — chỉ cần tải xong | ✅ cả hai bên | PASS | màu trội vùng không mask: ours 55.3% · ref 55.3% |

## 2. Vùng mask đã áp và lý do

Ở cặp **ours vs ref** này **không mask vùng brand**: cả hai bên đều là bản brand Galaxy Blackhole nên phần brand phải trùng nhau; mask brand chỉ cần cho cặp ours-vs-stock của `tools/parity`. Nhờ vậy mọi lệch brand (nếu có) đều hiện ra thành cụm lệch thật.

| Vùng | Nhóm | Vì sao bỏ qua |
|---|---|---|
| `state-sidebar-sessions` | state | Danh sách workspace/session là TRẠNG THÁI sống của từng instance: 4001 có workspace galaxy + session cũ (Đọc hiểu dự án này), app mới chỉ có Default workspace + New Session. Cây session ở sidebar cao 246..854 px @1440x900 (đo từ DOM: role=tree 270x608) nên dải mask phủ hết chiều cao đó, chỉ chừa hàng nút Workspaces phía trên và hàng More phía dưới. |
| `state-chip-workspace` | state | Hàng chip dưới ô soạn tin in TÊN workspace đang chọn nên bề rộng chip khác nhau làm cả hàng dịch ngang — trạng thái, không phải bố cục. Chỉ áp cho màn hình KHÔNG bị hộp thoại Settings che. |

## 3. Khác biệt THẬT phát hiện được (ngoài mask)

### 3.1 Sự cố đã bắt được và ĐÃ SỬA (bằng chứng giàn đo hoạt động đúng)

1. **Cửa sổ restart host lúc 12:58 (chạy dev:web sai thư mục)**
   - Hiện tượng: Ảnh/cặp chụp rơi đúng lúc host đang tắt–bật: một bên trắng hoặc lỗi kết nối.
   - Gốc rễ: tm-host-api gọi lệnh khởi động từ sai thư mục nên host thoát; app có khoảng trống giữa hai lượt boot.
   - Cách sửa: Cổng trạng thái trước mỗi cặp ảnh: HTTP 200 + instance đã lên >= 10 giây, chờ tối đa ~30s.
   - Sau khi sửa: Mọi lượt đo sau đó đều có số liệu sức khoẻ hai bên (pid + tuổi instance) ghi trong summary.json.
2. **App chết UI vì thân phản hồi RPC bị String(Buffer) hoá (13:07–13:40)**
   - Hiện tượng: Mọi endpoint /api/* trả 200 nhưng thân phản hồi là DÃY SỐ THẬP PHÂN của từng byte (8 byte đầu = 3132332c33342c31 = '123,34,1'); console có ERR_INVALID_HTTP_RESPONSE và 'Unexpected non-whitespace character after JSON'; UI hiện banner 'Failed to load plugins · 1 entry did not activate' và hộp thoại 'Enter your Galaxy API key', không có sidebar/ô soạn tin.
   - Gốc rễ: Wrapper nén mới của tầng HTTP ép chunk không phải Buffer qua String(), mà tầng trên ghi bằng Uint8Array.
   - Cách sửa: tm-host-api thêm toBuffer() (ArrayBuffer view -> Buffer) ở cả res.write và res.end, kèm 3 test hồi quy.
   - Sau khi sửa: 15/15 endpoint trả JSON hợp lệ, byte đầu 7b2274797065223a = '{"type":'; 4/4 chỉ dấu hợp lệ đạt. MỌI số liệu trong khoảng 13:07–13:40 bị loại bỏ.
3. **Màn Settings → Agent presets lệch 3.180 px vì rác trong HOME của app (13:43–13:56)**
   - Hiện tượng: Cụm lệch x=532..1096 y=656..832 (thẻ preset CUSTOM), x=552..624 y=675..688 ('Set as new task default: 自定义模式') và x=685..695 y=805..815 (nút 'Let the agent help me create a preset' bị dịch) — app có thêm preset 'custom' mà oracle không có.
   - Gốc rễ: Phép thử plugin ngoài dsh-custom-mode để lại dòng 'agent-presets: default: custom' trong ~/.galaxy/blackhole/settings.yaml; DSH đổi tên thành settings.yaml.imported (dấu vết trơ) nhưng trạng thái đã nạp vào profile nên thẻ preset rỗng vẫn hiện.
   - Cách sửa: Lead xoá settings.yaml.imported; RPC pluginInventory/list còn 216 entry · 4 preset, không còn 'custom'.
   - Sau khi sửa: Đo lại riêng màn này: 0 px ngoài mask, không cần mask trạng thái cho mục CUSTOM.

### 3.2 Cụm pixel lệch còn lại của lượt này

Không có màn hình nào còn cụm pixel lệch ≥ 8 px ngoài vùng mask trạng thái.

## 4. Màn hình KHÔNG chụp được và lý do

Không có màn hình nào bị bỏ.

## 5. Khác biệt cấu trúc DOM (nhãn phần tử chỉ có một bên)

So tập nhãn aria-label/chữ của mọi phần tử tương tác đọc được ở hai bên. Khác biệt ở đây thường là **trạng thái** (tên workspace, session cũ) chứ không phải thiếu thành phần giao diện.

- **Mở session: khung chat + ô soạn tin** — chỉ có ở ref: Request to Say OK Only2h, Respond with OK only1h, Say OK only1h, Say OK only2h, Show 4 more sessions, galaxy · chỉ có ở ours: Request to Say OK1h, Say OK Only1h, Say OK Only2h
- **Plugins → tab Installed** — chỉ có ở ref: Request to Say OK Only2h, Respond with OK only1h, Say OK only1h, Say OK only2h, Show 4 more sessions, galaxy · chỉ có ở ours: Request to Say OK1h, Say OK Only1h, Say OK Only2h
- **Settings → General** — chỉ có ở ref: Request to Say OK Only2h, Respond with OK only1h, Say OK only1h, Say OK only2h, Show 4 more sessions, galaxy · chỉ có ở ours: Request to Say OK1h, Say OK Only1h, Say OK Only2h

### 5.1 Phần tử LẠ (có aria-label/role/data-testid ở một bên mà bên kia KHÔNG có)

Chỉ số này KHÔNG phụ thuộc pixel và KHÔNG phụ thuộc chữ nội dung: nó bắt lớp lỗi 'component render ra phần tử sai chỗ' mà cổng phía server không thấy. Đã kiểm chứng trên dữ liệu cũ: luật này bắt đúng toast placeholder `button|switch|Could not save preference @ 0,0 36x20` (ca 388 px ngày 17/10/2026).

- Không có phần tử lạ nào ở cả hai bên (0/0).

## 6. Nhật ký mạng hai bên (bằng chứng chẩn đoán)

Mỗi màn hình đều có file `net-<id>.json` trong thư mục ảnh, ghi mọi request **không phải asset tĩnh** (document/xhr/fetch/websocket) kèm method, URL, mã trạng thái, thời gian và số byte. Giá trị token/khoá bí mật trong URL đã bị thay bằng ba dấu sao.

Không có màn hình nào cần đối chiếu mạng (mọi màn hình đều PASS).

## 7. Lịch sử đo: cửa sổ KHÔNG HỢP LỆ 13:07–13:40 ngày 17/10/2026

- **Triệu chứng**: app 5439 hiện banner `Failed to load plugins · web boot: 1 entry did not activate` và hộp thoại `Enter your Galaxy API key`; không có sidebar, không có ô soạn tin.
- **Nguyên nhân (đã chứng minh)**: tầng HTTP mới của app trả thân phản hồi là **dãy số thập phân của từng byte** khi client xin `Accept-Encoding: gzip` (Buffer bị đưa qua `String()`). Bằng chứng: 8 byte đầu của mọi phản hồi /api/* là `3132332c33342c31` = chuỗi `123,34,1`, và khi giải mã dãy số đó rồi gunzip thì JSON hợp lệ.
- **Bằng chứng lưu tại**: `.parity/features/2026-10-17T06-27-23/key-dialog-compare/` (ảnh modal che kín màn hình), `.parity/features/2026-10-17T06-22-10/boot-graph-compare.json` (ref 0 lỗi console · ours 6 lỗi), `net-<màn>.json` của các màn trong cửa sổ đó.
- **Hệ quả**: MỌI số liệu ảnh đo trong khoảng 13:07–13:40 đều **KHÔNG HỢP LỆ**, kể cả những lượt ra 0 px — khi hai bên cùng trắng/cùng lỗi thì 0 px là vô nghĩa. Các lượt đó chỉ được giữ làm bằng chứng.
- **Khắc phục**: bản vá `toBuffer()` (giữ đúng byte cho Uint8Array) nạp lúc 13:28; bảng ở mục 1 là bộ số liệu hợp lệ đầu tiên sau khi app lành.
- Rà lại một lượt đã lưu bằng cổng hợp lệ: `bun run tools/features/audit.ts <thư-mục-lần-chạy>` → ghi `validity-audit.json`.

## 8. Tổng hợp

| Hạng mục | Số |
|---|---|
| Màn hình đã đo | 3 |
| Đạt ngưỡng (PASS) | 3 |
| Vượt ngưỡng (FAIL) | 0 |
| Không chụp được (SKIP) | 0 |
| Tổng pixel lệch ngoài mask | 0 |

Ghi chú vận hành:
- Mỗi kịch bản chạy bằng một profile Chrome MỚI dưới thư mục tạm (.parity/tmp) và LUÔN đóng trong finally.
- Cookie phiên mint trong bộ nhớ từ credentials dùng chung; giá trị cookie/secret không được in hay ghi.
- Cổng trạng thái: HTTP 200 + instance đã lên >= 10 giây; không đạt thì SKIP kèm lý do, không tính là khác biệt giao diện.
- Dấu vân tay cây plugin (rev + số entry + hash danh sách entry) đọc từ __DSH_BOOT__ ngay lúc chụp và ghi vào từng màn; lượt nào đổi cây giữa chừng bị đánh dấu NGHI NHIỄM.

Chạy lại: `bun run tools/features/run.ts` (thêm `--ids <id,id>` để chạy một vài màn hình, `--strict` để đỏ khi có FAIL).
