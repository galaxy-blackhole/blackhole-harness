<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 11/11/2026
 desc Chụp lại đường nền bố cục cho chỉ số (9) của check:app ngày 11/11/2026 kèm lý do (drift DỮ LIỆU,
      không phải hồi quy CSS) và bảng bằng chứng đo được; ghi chú độ bền của phép so 80 hộp theo thứ tự DOM.
-->

# Chụp lại đường nền bố cục (9) — 11/11/2026, 09:13

> Chỉ số (9) của `bun run check:app` trượt **8/80** so với đường nền chụp **09/11/2026 23:27**. Tài liệu này
> ghi **ngày chụp mới + lý do chụp lại + bằng chứng phân định** để lần sau không ai phải đoán lại.

## 1. Ngày chụp + công cụ (đúng công cụ của repo)

| Mục | Giá trị |
|---|---|
| Thời điểm chụp | **11/11/2026 09:13** (giờ máy, Asia/Saigon) |
| Lệnh | `bun run tools/check/probe-once.ts "$(cat ~/.galaxy/blackhole/ready-url.txt)" --save --shot` |
| Tệp ghi | `.parity/layout-baseline.json` (80 phần tử) + `.parity/layout-baseline.png` (75.440 B, cùng lượt đo) |
| Hàm đo | `tools/check/page-probe.ts: probeGeometry()` — 80 hộp ĐẦU TIÊN dưới `#root`, Chrome headless `locale: "vi-VN"`, viewport mặc định 1280x720 |
| Đo lại ngay sau chụp | `bun run check:app` ⇒ **(9) 0/80 phần tử khác (0%) — ĐẠT** |

Đường nền cũ (09/11 23:27) đã sao lưu tại `/tmp/layout-baseline.2026-11-09.json` khi chụp lại (bản sao tạm,
không đưa vào repo — repo chỉ giữ MỘT đường nền hiện hành).

⚠️ `.parity/` nằm trong `.gitignore` (dòng 4) ⇒ đường nền là **tạo tác CỤC BỘ của máy này**, KHÔNG đi theo git.
Máy/agent khác vẫn giữ đường nền cũ (hoặc không có) và sẽ thấy (9) trượt 8/80 cho tới khi tự chạy lại lệnh ở §1
trên **cùng trạng thái dữ liệu**. Đây là lý do (9) "trượt" khác nhau giữa các máy — không phải hồi quy CSS.

## 2. Vì sao chụp lại: DRIFT DỮ LIỆU, không phải hồi quy CSS

Đối chiếu từng hộp của 80 hộp (script so khớp `k/x/y/w/h`) cho thấy **8 hộp lệch, tất cả nằm trong danh sách
nhóm workspace ở thanh bên**, và lệch đúng bằng **một nhóm workspace THU GỌN được thêm vào đầu danh sách**:

| # | Đường nền 09/11 23:27 | Hiện tại 11/11 09:13 |
|---|---|---|
| 68 | `div.bhn1Oq_groupSection` (12,246 **261x266**) | `div.bhn1Oq_groupSection` (12,246 **261x34**) — nhóm 1 GẬP |
| 76 | — | `div.bhn1Oq_groupSection` (12,284 **261x266**) — nhóm 2 MỞ |
| 78-79 | `span._root_38jqx_3` / `div.YDXeBa_sessionRow` (261x32) | bị đẩy ra khỏi 80 hộp đầu bởi 2 hộp của nhóm gập |

Đếm theo lớp: `div.bhn1Oq_groupSection` 1 → 2 · `div.YDXeBa_projectRow` 1 → 2 · `span.YDXeBa_slot` 1 → 2 ·
`path` 14 → 12 (hộp thứ 80 dịch đi 2 vị trí nên 2 `path` rơi khỏi cửa sổ 80).

**Khối workspace ĐANG MỞ giữ nguyên hình học tuyệt đối: 261x266 ở cả hai lần đo.** Chênh `y` = +38 px = chiều cao
nhóm gập (34) + `margin-top` 4 px của luật `.bhn1Oq_groupSection + .bhn1Oq_groupSection` — đúng bằng một nhóm
gập được chèn lên trên, không phải kích thước bị bóp méo.

Ba kiểm chứng độc lập loại trừ hồi quy CSS:

1. **Không tệp bố cục/CSS nào đổi sau mốc đường nền**: `find packages/client/ui-workspace/src packages/client/ui-sidebar/src -newermt "2026-11-09 23:27:00" -type f` ⇒ **2 tệp, cả hai là `locales-vi.ts`** (từ điển sinh tự động, không chứa CSS/bố cục).
2. **CSS của nhóm không có chiều cao cố định**: `packages/client/ui-workspace/src/css.ts:68` — `.bhn1Oq_groupSection{position:relative}` + `.bhn1Oq_groupSection+.bhn1Oq_groupSection{margin-top:4px}`; chiều cao do NỘI DUNG quyết định ⇒ thêm/bớt nhóm là đổi số hộp, không đổi hình học của khối đang mở.
3. **Dữ liệu người dùng đã đổi giữa hai mốc**: `~/.galaxy/blackhole/storages/workspace.json` (mtime **11/11 08:57**, sau mốc 09/11 23:27) hiện có **4 workspace** với hàng chục phiên; thanh bên vì thế dựng 2 nhóm (1 gập + 1 mở) thay vì 1 nhóm mở.

Kết luận: **không sửa CSS** — sửa CSS lúc này là sửa cái không hỏng. Việc đúng là chụp lại đường nền.

## 3. Ghi chú độ bền của chỉ số (9) — cảnh báo cho lần sau

(9) so **danh sách 80 hộp theo THỨ TỰ DOM** ⇒ vẫn phụ thuộc dữ liệu người dùng: mỗi lần thêm/gập/mở một nhóm
workspace hay một phiên, danh sách dịch đi và (9) trượt **dù UI đúng**. Đây đúng là lớp báo oan mà chỉ số (8)
đã được sửa ngày 08/11 (đổi từ "đếm slot thô" sang "bất biến cấu trúc": đủ 7/7 slot xương sống + 0 lỗi console).

Đề xuất (CHƯA làm — cần Lead duyệt vì đổi ngữ nghĩa của cổng): chuyển (9) sang bất biến cấu trúc tương tự —
so hình học của **các hộp khung** (frame/sidebarCol/sidebar root/main/composer) thay vì toàn bộ 80 hộp, hoặc so
theo **khoá lớp + kích thước** đã sắp xếp thay vì theo thứ tự DOM.
