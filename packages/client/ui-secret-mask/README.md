<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README của @galaxy-blackhole/gbh-client-ui-secret-mask: nguồn đối chiếu G4, cách đối chứng với bản gốc, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-client-ui-secret-mask

Bản viết lại của Galaxy Blackhole cho row **ui-secret-mask** của DSH
(@deepseek-ai/dsh-client-ui-secret-mask). Row **HAI MẶT**: gói chứa cả hai nửa trong một package —
src/index.ts (host) + src/client.ts (browser), theo khuôn §6 của docs/recipes/HOST-ROW-REWRITE.md.

Row này che (mask) mọi credential nhận ra được trong **chữ người dùng đã gửi**: chỉ đổi phần ĐƯỢC VẼ,
còn chữ gốc, thao tác sao chép và đầu vào của model giữ nguyên ký tự thật.

## 1. Nguồn đối chiếu (G4) — hành vi ↔ file gốc

| Hành vi của ta | Nguồn gốc đã đọc (chỉ đọc) | Ghi chú |
|---|---|---|
| Nửa host: export function apply(): void {} | .../ui-secret-mask/lib/index.js (420 B) | Bản gốc cũng KHÔNG có hành vi host |
| Danh sách định dạng credential | lib/client.js dòng 18-61 · lib/types/client/credential-formats.d.ts | Giữ nguyên 28 định dạng: 26 khoá có tiền tố + khối khoá + password trong URL |
| Bảng lớp ký tự + hằng số | lib/client.js dòng 9-16, 590-601 | Cùng 10 bit lớp (KEY · ALNUM · WORD · ALNUM_DASH · UPPER_ALNUM · LABEL · SCHEME · LOWER · USER · PASSWORD) |
| Bộ quét ứng viên | lib/client.js dòng 331-390, 532-557 | Cùng luật: gộp ứng viên chồng nhau vào ứng viên SỚM NHẤT, lấy mặt nạ của nó |
| Khối khoá riêng tư | lib/client.js dòng 445-475 | Nhãn [A-Z0-9 ]{0,40} rồi "PRIVATE KEY-----"; hết ở dòng END đầu tiên, không có thì hết chuỗi |
| Password trong URL | lib/client.js dòng 477-530 | scheme \b[a-z][a-z0-9+.-]{1,15}, user ≤256, password ≥1 rồi '@' |
| Dựng mặt nạ | lib/client.js dòng 65-160 · lib/types/client/credential-masks.d.ts | Mỗi điểm mã một dấu, GIỮ dấu xuống dòng, cặp surrogate tính là một; khoá có tiền tố để lộ 8 ký tự đầu |
| Thẻ SecretText + nút hiện/che | lib/client.js dòng 181-243 · lib/types/client/SecretText.d.ts | Giữ nguyên hai đường SVG con mắt của DSH; nút chỉ hiện khi văn bản cho tương tác |
| Đăng ký | lib/client.js dòng 668-691 | inject = [locale, slots, uiConversation] · luật "secret" · occupant slot key "secret" priority 100 |

Câu trả lời cho 5 câu hỏi bắt buộc (mục 0 của công thức):

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row đang BẬT? | **Có** (đo từ --dump-config: row ui-secret-mask không bị disabled) |
| 2 | Thuần host hay có mount surface client? | **Hai mặt**: package gốc khai dsh.client (inject locale · ui-conversation · ui-renderer, platform web) |
| 3 | Cần seam nào? | Phía browser: **locale · slots · uiConversation** (seam của DSH). Phía host: không cần seam nào |
| 4 | Hành vi đo được? | Một luật UserText "secret" + một occupant slot conversation.user.text.node; đo bằng **test đối chứng với chính bundle gốc** (4.000+ chuỗi) + ảnh A/B |
| 5 | Package gốc có dsh.client? | **Có** ⇒ row hai mặt, theo khuôn §6: hai id module + exports["./client"] |

## 2. Vì sao không thêm peer nào

Bản gốc chỉ khai peerDependencies cordis và KHÔNG import gì ở nửa host. Nửa client nhận react,
react/jsx-runtime và các gói DSH **qua bảng module lúc chạy**, nên gói này không cần khai peer mới.

## 3. Bảng TRƯỚC/SAU và cách kiểm

| Hạng mục | TRƯỚC (row stock) | SAU (row của ta) |
|---|---|---|
| Nửa host export | apply | apply (test so trực tiếp với bản gốc) |
| Id module trong bảng | 1 | **2** (id của ta + id gốc) |
| Kết quả match credential | — | **giống hệt** trên corpus: 4.000+ chuỗi sinh + ca biên viết tay + mọi vị trí truy vấn |
| Hình dạng bundle | script classic đăng ký 1 id | script classic đăng ký **2 id**, 0 cú pháp ESM |

Cách đối chứng (điểm mạnh nhất của row này): bài test nạp **chính bundle gốc** trong window giả,
lấy ra luật "secret" của nó, rồi so từng kết quả match (start · end · chuỗi mặt nạ) với luật của ta
trên cùng corpus — gồm cả đường đi truy vấn tuần tự mà renderer dùng (node.end → truy vấn tiếp).

Lệnh tái lập:

    bun run packages/client/ui-secret-mask/build.ts
    bun test tests/client/ui-secret-mask.test.ts     # 7 ca, có ca đối chứng

## 4. Phần CHƯA làm (nói thẳng)

- **Chưa có ca BYTE**: row này không đi qua tầng vận chuyển (không route, không RPC), nên không có thân phản hồi để kiểm byte.
- **Chưa thử trên app thật**: phải qua lab home cách ly + cổng riêng rồi mới mount (mục 5).
- **Không mask gì trong phép đo**: vùng nội dung phải khớp 0 px; nếu lệch thì đó là lệch thật.

## 5. Nhật ký đo (cập nhật sau mỗi lần mount)

| Thời điểm | Việc | Kết quả |
|---|---|---|
| 17/10/2026 15:34 | Build hai nửa + 7 ca test (có ca đối chứng 4.000+ chuỗi) | XANH 7/7 |
| 17/10/2026 15:36 | check:rows + gate | check:rows: gói này 0 vấn đề · gate **6/6 XANH** |
| 17/10/2026 15:52 | **Kiểm RENDER đầu-cuối trong lab** (tự dựng trạng thái: gõ tin chứa credential bằng bàn phím THẬT rồi gửi) | 1 node `[data-secret]` · textContent `sk-A1b2C***************` (8 ký tự đầu để lộ) · run mặt nạ `**************` trong `span.gbhSecret_mask` · nút `aria-label="Show secret"` `aria-pressed="false"` · **0 lỗi console** |
| 17/10/2026 15:52 | Ghi chú phương pháp cho chỉ số này | Trạng thái do **TA TỰ DỰNG trong lab**, **KHÔNG so với oracle** — không có ảnh A/B pixel cho riêng credential. Với contenteditable phải dùng **bàn phím thật** (sự kiện nhập giả không vào state) và phải **focus bằng JS** vì modal một-lần nuốt sự kiện chuột |
| 17/10/2026 15:46 | **Mount thật** (Lead restart, `check:app` 8 chỉ số) | 13 gói của ta đang chạy, trong đó có `gbh-client-ui-secret-mask` · trang 49.309 B · `#root` 99.183 · **0 lỗi console** · bố cục 1/80 phần tử lệch 1 px (ĐẠT) · 16 file mount khớp repo (ĐẠT) |
| 17/10/2026 15:44 | **A/B pixel màn `session-open`** (khung chat + ô soạn tin) | **PASS 0/1.075.392 = 0,000%** · **phần tử lạ: ours +0 · ref +0** · ảnh `.parity/features/2026-10-17T08-43-56/` |

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-secret-mask` (shasum `en c331aac47f28...` · `zh e3266c92ff0c...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
