<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README của @galaxy-blackhole/gbh-client-ui-settings-plugin-inventory: nguồn đối chiếu G4, ba phép đối chứng với bản gốc, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-client-ui-settings-plugin-inventory

Bản viết lại của Galaxy Blackhole cho row **ui-settings-plugin-inventory** của DSH. Row **HAI MẶT**: gói
chứa cả hai nửa trong một package — src/index.ts (host) + src/client.ts (browser), theo khuôn §6 của
docs/recipes/HOST-ROW-REWRITE.md.

Tab này là **tab chỉ đọc** trong mục Plugins của Settings: liệt kê plugin theo **preset của phiên** trước,
rồi tới **mặt phẳng global**; mỗi thẻ mở ra được để xem danh tính Loader, cấu hình và trạng thái runtime.

## 1. Nguồn đối chiếu (G4) — hành vi ↔ file gốc

| Hành vi của ta | Nguồn gốc đã đọc (chỉ đọc) | Ghi chú |
|---|---|---|
| Nửa host: export function apply(): void {} | .../lib/index.js | Bản gốc cũng KHÔNG có hành vi host |
| Từ điển 37 khoá × 2 ngôn ngữ | lib/client.js dòng 637-719 · lib/types/client/locales.d.ts | Nguyên văn, kể cả các chuỗi có {name}/{count}/{error} |
| Tên preset có sẵn theo từ điển | lib/client.js dòng 10-55 | standard · ptc · minimal · cordis; preset tự viết giữ metadata |
| Mô hình dữ liệu (nhãn pha, rút gọn tên module, lọc) | lib/client.js dòng 107-170 | Cùng regex rút gọn và cùng cách so ô tìm kiếm |
| Thẻ plugin + dòng chi tiết | lib/client.js dòng 172-248 | Cùng data-* (data-plugin-entry · data-plugin-module · data-failed · data-open · data-loader-entry) |
| Chấm pha + nhãn trạng thái | lib/client.js dòng 249-281 | PHASE_DOT_STATES · TAG_TONES |
| Tab (preset trước, global sau, ô tìm kiếm, xương, lỗi) | lib/client.js dòng 283-635 | Cùng cấu trúc, cùng aria-* và cùng thứ tự |
| CSS | lib/client.js dòng 57 | Giữ nguyên KHAI BÁO, đổi tiền tố lớp qSYn7G_ → gbhInv_ (mỗi gói tự đặt tên lớp) |
| Đăng ký | lib/client.js dòng 720-765 | inject 5 dịch vụ · slot settings.plugins.tab · id all · order 10 |

Câu trả lời cho 5 câu hỏi bắt buộc (mục 0 của công thức):

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row đang BẬT? | **Có** (đo từ --dump-config) |
| 2 | Thuần host hay có mount surface client? | **Hai mặt**: dsh.client.inject = dsh-api-remotes · ui-settings · locale · ui-agent-preset · client-modules |
| 3 | Cần seam nào? | Phía browser: **slots · locale · remote · remote.pluginInventory · modules** (seam của DSH) |
| 4 | Hành vi đo được? | Một occupant slot settings.plugins.tab (id all, order 10) + tab chỉ đọc trong Settings; đo bằng 3 phép đối chứng với bundle gốc + A/B pixel + chỉ số phần tử lạ |
| 5 | Package gốc có dsh.client? | **Có** ⇒ row hai mặt, theo khuôn §6: hai id module + exports["./client"] |

## 2. Vì sao không thêm peer nào

Bản gốc chỉ khai peer cordis và KHÔNG import gì ở nửa host. Nửa client nhận react, react/jsx-runtime và
@galaxy-blackhole/gbh-client-ui-primitives **qua bảng module lúc chạy**, nên gói này không cần khai peer mới.

## 3. Ba phép đối chứng với chính bundle gốc (điểm mạnh của row này)

Bài test nạp **bundle gốc** trong window giả, chạy plugin của nó với một context giả rồi so với ta:

1. **Từ điển**: 74 chuỗi (37 khoá × 2 ngôn ngữ) phải TRÙNG KHỚP từng ký tự.
2. **Đăng ký**: slot · name · id · order · locale · nhãn (đã gọi hàm) · tập khoá của face inject.
3. **CÂY RENDER**: dựng cả hai component bằng cùng một jsx runtime giả + cùng hooks giả ở trạng thái
   đang đọc dữ liệu, chuẩn hoá tên lớp (mỗi gói tự đặt tiền tố) rồi so **từng dòng** — 17 dòng, giống hệt.

Lệnh tái lập:

    bun run packages/client/ui-settings-plugin-inventory/build.ts
    bun test tests/client/ui-settings-plugin-inventory.test.ts     # 7 ca, có 3 ca đối chứng

## 4. Phần CHƯA làm (nói thẳng)

- **Chưa có ca BYTE**: row này không đi qua tầng vận chuyển (không route, không RPC của chính nó), nên không có thân phản hồi để kiểm byte.
- **Chưa phủ cây render ở trạng thái READY**: phép đối chứng cây hiện chạy ở trạng thái đang đọc dữ liệu (nơi không cần Promise giải xong). Trạng thái có preset/entry sẽ được đo bằng A/B pixel + chỉ số phần tử lạ trên app thật.
- **Không mask gì trong phép đo**: vùng nội dung phải khớp 0 px.

## 5. Nhật ký đo (cập nhật sau mỗi lần mount)

| Thời điểm | Việc | Kết quả |
|---|---|---|
| 17/10/2026 15:49 | Build hai nửa + 7 ca test (3 ca đối chứng với bundle gốc) | XANH 7/7 |
| 17/10/2026 15:50 | check:rows + gate | gói này 0 vấn đề · gate **6/6 XANH** |
| 17/10/2026 15:52 | **Mount thật** (Lead restart, `check:app`) | 14 gói của ta đang chạy, trong đó có `gbh-client-ui-settings-plugin-inventory` · trang 49.334 B · `#root` **99.183** · **0 lỗi console** · bố cục 1/80 phần tử lệch 1 px (ĐẠT) · **18 file mount khớp repo** (ĐẠT) |
| 17/10/2026 15:56 | **A/B pixel màn Settings → Built-in plugins** | **PASS 0/1.119.744 = 0,000%** · anchor y hai bên **104/104** · **phần tử lạ: ours +0 · ref +0** · ảnh `.parity/features/2026-10-17T08-55-46/` |
| 17/10/2026 15:56 | Ghi chú quan trọng (Lead nêu trước khi đo) | Tab mới nằm trong mục Plugins của Settings. **Oracle CÓ tab này** (cùng row stock đang bật) nên kỳ vọng 0 px — và kết quả đúng 0 px ⇒ KHÔNG có lệch nào ở dải tab. Nếu oracle thiếu tab thì lệch ở dải tab sẽ là FAIL thật (G1), chứ không phải 'lệch đã dự đoán' |

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-settings-plugin-inventory` (shasum `en 4b87ff7a7af2...` · `zh 1fc7cf1f88e0...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
